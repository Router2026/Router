// Server-side gatekeeper for LLM output. The LLM only returns candidate keys
// plus a short reasoning; every stop is rebuilt from the Candidate (DB) data.
// Anything that does not resolve to a candidate is dropped, never "repaired".

import { z } from "zod";
import { normalizeName, sanitizeForPrompt } from "./text";
import type { Candidate, ValidatedStop } from "./types";

export const MIN_VISIT_MINUTES = 15;
export const MAX_VISIT_MINUTES = 480;
export const REASONING_MAX_CHARS = 280;
export const TITLE_MAX_CHARS = 80;

// Lenient on shape (open models sometimes rename fields), strict on content.
const RawStopSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  key: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  reasoning: z.string().optional(),
  reason: z.string().optional(),
  visitMinutes: z.number().optional(),
  visit_minutes: z.number().optional(),
});

const RawOutputSchema = z.object({
  title: z.string().optional(),
  stops: z.array(z.unknown()),
});

export type RejectReason =
  | "malformed"
  | "unknown_id"
  | "duplicate"
  | "over_limit";

export interface RejectedStop {
  raw: unknown;
  reason: RejectReason;
}

export interface ValidationResult {
  stops: ValidatedStop[];
  rejected: RejectedStop[];
  title: string | null;
  /** How many stops were resolved by name instead of key (a sign of model drift). */
  matchedByName: number;
}

export interface ValidateOptions {
  maxStops?: number;
}

export class InvalidPlanShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPlanShapeError";
  }
}

/**
 * Validates parsed LLM JSON against the candidate list.
 * Throws InvalidPlanShapeError only when the top-level shape is wrong;
 * individual bad stops are collected in `rejected`.
 */
export function validatePlan(
  output: unknown,
  candidates: readonly Candidate[],
  options: ValidateOptions = {},
): ValidationResult {
  const parsed = RawOutputSchema.safeParse(output);
  if (!parsed.success) {
    throw new InvalidPlanShapeError(`LLM output is not { stops: [...] }: ${parsed.error.message}`);
  }

  const byKey = new Map(candidates.map((c) => [c.key.toUpperCase(), c]));
  const byName = new Map(candidates.map((c) => [normalizeName(c.name), c]));
  const maxStops = options.maxStops ?? Number.POSITIVE_INFINITY;

  const stops: ValidatedStop[] = [];
  const rejected: RejectedStop[] = [];
  const usedIds = new Set<number>();
  let matchedByName = 0;

  for (const raw of parsed.data.stops) {
    const stop = RawStopSchema.safeParse(raw);
    if (!stop.success) {
      rejected.push({ raw, reason: "malformed" });
      continue;
    }

    const rawKey = stop.data.id ?? stop.data.key;
    let candidate = rawKey !== undefined ? byKey.get(String(rawKey).trim().toUpperCase()) : undefined;

    // Fallback: models sometimes echo the place name instead of the key.
    // Still closed-world, because we only accept names from the candidate list.
    if (!candidate && stop.data.name) {
      candidate = byName.get(normalizeName(stop.data.name));
      if (candidate) matchedByName++;
    }

    if (!candidate) {
      rejected.push({ raw, reason: "unknown_id" });
      continue;
    }
    if (usedIds.has(candidate.locationId)) {
      rejected.push({ raw, reason: "duplicate" });
      continue;
    }
    if (stops.length >= maxStops) {
      rejected.push({ raw, reason: "over_limit" });
      continue;
    }

    usedIds.add(candidate.locationId);
    stops.push({
      candidate,
      reasoning: sanitizeForPrompt(stop.data.reasoning ?? stop.data.reason, REASONING_MAX_CHARS),
      visitMinutes: clampVisitMinutes(stop.data.visitMinutes ?? stop.data.visit_minutes, candidate.durationMinutes),
    });
  }

  const title = sanitizeForPrompt(parsed.data.title, TITLE_MAX_CHARS) || null;
  return { stops, rejected, title, matchedByName };
}

/** Clamps a suggested visit length; falls back to the DB duration when missing or invalid. */
export function clampVisitMinutes(value: number | undefined, fallback: number): number {
  const v = value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
  return Math.max(MIN_VISIT_MINUTES, Math.min(MAX_VISIT_MINUTES, Math.round(v)));
}
