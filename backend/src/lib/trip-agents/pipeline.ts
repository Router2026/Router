// Orchestrator: runs the six trip agents in order.
//   1 intent (LLM) → 2 search (LLM + tools) → 3 conditions (code) → 4 planner (code)
//   → 6 review (LLM + tools, may revise once via 3+4) → 5 summary (LLM)
// Agent 6 runs before 5 so the summary describes the final plan.
// Failures in the optional model steps (review, summary) degrade gracefully; failures in
// intent/search/planning surface as errors (the route handler returns 5xx / falls back).

import type Anthropic from "@anthropic-ai/sdk";
import { runConditionsAgent, type ConditionsReport, type WeatherFetcher } from "./conditions-agent";
import { runIntentAgent, type TripIntent } from "./intent-agent";
import { emptyUsage, israelToday, tripAgentsModel, type AgentUsage } from "./llm";
import { runPlannerAgent, type DayPlan, type PlannerDeps } from "./planner-agent";
import { runReviewAgent, type ReviewResult } from "./review-agent";
import { runSearchAgent, type SearchAgentDeps } from "./search-agent";
import { fallbackSummary, runSummaryAgent, type TripSummary } from "./summary-agent";

export type AgentStep = "intent" | "search" | "conditions" | "planner" | "review" | "summary";

export interface PipelineResult {
  intent: TripIntent;
  plan: DayPlan;
  summary: TripSummary;
  review: Omit<ReviewResult, "plan">;
  conditions: Pick<ConditionsReport, "date" | "forecastAvailable" | "sunrise" | "sunset"> & {
    rejected: { id: number; name: string; codes: string[] }[];
  };
  meta: {
    model: string;
    usage: AgentUsage;
    timingsMs: Partial<Record<AgentStep, number>>;
    searchUsedFallback: boolean;
  };
}

export interface PipelineDeps extends Pick<SearchAgentDeps, "postgis" | "semantic"> {
  client?: Pick<Anthropic, "messages">;
  model?: string;
  now?: Date;
  fetchWeather?: WeatherFetcher;
  planner?: PlannerDeps;
  /** Progress callback, e.g. to stream "agent 3 is checking the weather" to the UI. */
  onStep?: (step: AgentStep, phase: "start" | "done") => void;
}

export async function runTripPipeline(query: string, deps: PipelineDeps = {}): Promise<PipelineResult> {
  const usage = emptyUsage();
  const timings: PipelineResult["meta"]["timingsMs"] = {};
  const model = deps.model ?? tripAgentsModel();
  const llm = { client: deps.client, model, usage };
  const today = israelToday(deps.now ?? new Date()).date;

  async function step<T>(name: AgentStep, fn: () => Promise<T>): Promise<T> {
    deps.onStep?.(name, "start");
    const t = Date.now();
    try {
      return await fn();
    } finally {
      timings[name] = Date.now() - t;
      deps.onStep?.(name, "done");
    }
  }

  const intent = await step("intent", () => runIntentAgent(query, { ...llm, now: deps.now }));
  const search = await step("search", () =>
    runSearchAgent(intent, { ...llm, postgis: deps.postgis, semantic: deps.semantic }));
  const conditions = await step("conditions", () =>
    runConditionsAgent(intent, search.candidates, search.pool, { today, fetchWeather: deps.fetchWeather }));
  const firstPlan = await step("planner", () =>
    runPlannerAgent({ intent, places: conditions.approved, spares: conditions.approvedSpares, sunset: conditions.sunset }, deps.planner));

  const review = await step("review", async (): Promise<ReviewResult> => {
    try {
      return await runReviewAgent(
        { query, intent, plan: firstPlan, conditions, pool: search.pool, today },
        { ...llm, postgis: deps.postgis, semantic: deps.semantic, fetchWeather: deps.fetchWeather, planner: deps.planner },
      );
    } catch (err) {
      console.error("[trip-agents] review failed; keeping the planner's plan", err);
      return { plan: firstPlan, verdict: "skipped", notes: "review unavailable", issuesBefore: [], issuesAfter: [], added: [], removed: [] };
    }
  });
  const plan = review.plan;

  const summary = await step("summary", async () => {
    try {
      return await runSummaryAgent(query, intent, plan, llm);
    } catch (err) {
      console.error("[trip-agents] summary failed; using plain summary", err);
      return fallbackSummary(intent, plan);
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { plan: _omit, ...reviewMeta } = review;
  console.info(
    `[trip-agents] model=${model} calls=${usage.calls} tokens=${usage.inputTokens}/${usage.outputTokens} ` +
      `stops=${plan.stops.length} review=${review.verdict} timings=${JSON.stringify(timings)}`,
  );

  return {
    intent,
    plan,
    summary,
    review: reviewMeta,
    conditions: {
      date: conditions.date,
      forecastAvailable: conditions.forecastAvailable,
      sunrise: conditions.sunrise,
      sunset: conditions.sunset,
      rejected: conditions.rejected.map((r) => ({ id: r.place.id, name: r.place.name, codes: r.notes.map((n) => n.code) })),
    },
    meta: { model, usage, timingsMs: timings, searchUsedFallback: search.usedFallback },
  };
}
