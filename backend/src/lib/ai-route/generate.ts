// Orchestrates AI route planning:
//   candidates (DB) -> LLM selects keys (time-boxed, one repair retry)
//   -> validate against candidates -> fallback/top-up -> order -> schedule.
// The returned route contains ONLY places from the `locations` table.

import { resolveCategories } from "./categories";
import { fetchCandidatesWithFallback, type CandidateQuery } from "./candidates";
import { selectFallbackStops, topUpStops } from "./fallback";
import { SelectorError, type StopSelector, type SelectorErrorKind } from "./groq";
import { computeTargetStops, MIN_STOPS, type RoutePreferences } from "./plan-input";
import { buildRepairPrompt, buildSystemPrompt, buildUserPrompt } from "./prompt";
import { buildSchedule, orderStops } from "./sequence";
import type { Candidate, ScheduledStop, ValidatedStop } from "./types";
import { InvalidPlanShapeError, validatePlan } from "./validate";

/** Total time allowed for LLM work, leaving headroom under the 60s route limit. */
export const DEFAULT_AI_BUDGET_MS = 25_000;
/** Per-call timeout. Groq usually answers in 1-4s; anything near this is an outage. */
export const DEFAULT_ATTEMPT_TIMEOUT_MS = 15_000;
/** Do not start an attempt with less time than this left. */
export const MIN_ATTEMPT_MS = 3_000;
const MAX_ATTEMPTS = 2;

export class NoCandidatesError extends Error {
  constructor() {
    super("No locations found for this region");
    this.name = "NoCandidatesError";
  }
}

export type RouteSource = "ai" | "ai_partial" | "fallback";

export interface PlanRouteInput {
  regionId: number;
  prefs: RoutePreferences;
  seed?: string;
  /** Aborted when the client disconnects, so we stop paying for the LLM call. */
  signal?: AbortSignal;
}

export interface PlanRouteDeps {
  /** `null` disables the LLM (e.g. missing API key); the fallback planner is used. */
  selector: StopSelector | null;
  fetchCandidates?: (q: CandidateQuery) => Promise<{ candidates: Candidate[]; usedFallback: boolean }>;
  budgetMs?: number;
  attemptTimeoutMs?: number;
  now?: () => number;
}

export interface PlanDiagnostics {
  candidateCount: number;
  usedCategoryFallback: boolean;
  targetStops: number;
  aiAttempts: number;
  aiError: SelectorErrorKind | "invalid_shape" | "too_few_valid" | "disabled" | null;
  rejectedIds: number;
  matchedByName: number;
  droppedForTime: number;
  aiMs: number;
}

export interface PlannedRoute {
  title: string;
  source: RouteSource;
  stops: ScheduledStop[];
  totalDriveMinutes: number;
  totalDistanceKm: number;
  endTime: string;
  diagnostics: PlanDiagnostics;
}

interface AiOutcome {
  stops: ValidatedStop[] | null;
  title: string | null;
  attempts: number;
  error: PlanDiagnostics["aiError"];
  rejectedIds: number;
  matchedByName: number;
}

async function runAiSelection(
  selector: StopSelector,
  prefs: RoutePreferences,
  candidates: Candidate[],
  target: number,
  deps: Required<Pick<PlanRouteDeps, "budgetMs" | "attemptTimeoutMs" | "now">>,
  signal: AbortSignal | undefined,
): Promise<AiOutcome> {
  const startedAt = deps.now();
  const system = buildSystemPrompt();
  const user = buildUserPrompt(prefs, candidates, target);
  const allowedKeys = candidates.map((c) => c.key);

  const outcome: AiOutcome = { stops: null, title: null, attempts: 0, error: null, rejectedIds: 0, matchedByName: 0 };
  let repair: { previousRaw: string; prompt: string } | undefined;

  while (outcome.attempts < MAX_ATTEMPTS) {
    const remaining = deps.budgetMs - (deps.now() - startedAt);
    if (remaining < MIN_ATTEMPT_MS || signal?.aborted) break;
    outcome.attempts++;

    let raw = "";
    try {
      const res = await selector.selectStops(
        { system, user, allowedKeys, repair },
        { timeoutMs: Math.min(deps.attemptTimeoutMs, remaining), signal },
      );
      raw = res.raw;
      const result = validatePlan(res.json, candidates, { maxStops: target });
      outcome.rejectedIds += result.rejected.length;
      outcome.matchedByName += result.matchedByName;

      if (result.stops.length >= MIN_STOPS) {
        outcome.stops = result.stops;
        outcome.title = result.title;
        outcome.error = null;
        return outcome;
      }
      outcome.error = "too_few_valid";
      repair = {
        previousRaw: raw,
        prompt: buildRepairPrompt(`only ${result.stops.length} valid ids; ${result.rejected.length} ids were not in the list`),
      };
    } catch (err) {
      if (err instanceof InvalidPlanShapeError) {
        outcome.error = "invalid_shape";
        repair = { previousRaw: raw, prompt: buildRepairPrompt('the JSON must be an object with a "stops" array') };
        continue;
      }
      if (err instanceof SelectorError) {
        outcome.error = err.kind;
        // Server-side only; the client just sees source="fallback".
        console.warn(`[ai-route] AI attempt ${outcome.attempts} failed: ${err.kind}: ${err.message}`);
        // Only a malformed answer is worth repairing; timeouts and rate limits are not.
        if (err.kind !== "parse") break;
        repair = { previousRaw: err.raw ?? "", prompt: buildRepairPrompt("the answer was not valid JSON") };
        continue;
      }
      throw err;
    }
  }
  return outcome;
}

function defaultTitle(regionName: string): string {
  return `יום טבע ב${regionName}`;
}

export async function planRoute(input: PlanRouteInput, deps: PlanRouteDeps): Promise<PlannedRoute> {
  const { prefs } = input;
  const now = deps.now ?? Date.now;
  const fetchCandidates = deps.fetchCandidates ?? fetchCandidatesWithFallback;

  const { candidates, usedFallback } = await fetchCandidates({
    regionId: input.regionId,
    categories: resolveCategories(prefs.styles),
    start: prefs.start ?? null,
    seed: input.seed,
  });
  if (candidates.length === 0) throw new NoCandidatesError();

  const target = computeTargetStops(prefs, candidates);

  const aiStart = now();
  const ai: AiOutcome = deps.selector
    ? await runAiSelection(deps.selector, prefs, candidates, target, {
        budgetMs: deps.budgetMs ?? DEFAULT_AI_BUDGET_MS,
        attemptTimeoutMs: deps.attemptTimeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS,
        now,
      }, input.signal)
    : { stops: null, title: null, attempts: 0, error: "disabled", rejectedIds: 0, matchedByName: 0 };
  const aiMs = now() - aiStart;

  let source: RouteSource;
  let selected: ValidatedStop[];
  if (ai.stops) {
    // If hallucinated ids were dropped, refill with nearby DB places.
    const needsTopUp = ai.rejectedIds > 0 && ai.stops.length < target;
    selected = needsTopUp ? topUpStops(ai.stops, candidates, target) : ai.stops;
    source = needsTopUp ? "ai_partial" : "ai";
  } else {
    selected = selectFallbackStops(candidates, target, new Set(), prefs.start ?? null);
    source = "fallback";
  }

  const origin = prefs.start ?? null;
  const ordered = orderStops(selected, { origin, roundTrip: !!origin });
  const schedule = buildSchedule(ordered, {
    dayStart: prefs.dayStart,
    dayEnd: prefs.dayEnd,
    origin,
    returnToOrigin: !!origin,
  });

  return {
    title: ai.title || defaultTitle(prefs.regionName),
    source,
    stops: schedule.stops,
    totalDriveMinutes: schedule.totalDriveMinutes,
    totalDistanceKm: schedule.totalDistanceKm,
    endTime: schedule.endTime,
    diagnostics: {
      candidateCount: candidates.length,
      usedCategoryFallback: usedFallback,
      targetStops: target,
      aiAttempts: ai.attempts,
      aiError: ai.error,
      rejectedIds: ai.rejectedIds,
      matchedByName: ai.matchedByName,
      droppedForTime: schedule.dropped.length,
      aiMs,
    },
  };
}
