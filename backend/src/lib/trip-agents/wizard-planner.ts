// Route planner switch for POST /api/ai/generate-route (kept out of route.ts: a Next.js route
// file may only export handlers and route config).

import type { ApiRoute, ParsedRouteRequest } from "@/lib/ai-route/http";

/** "groq" forces the old planner; anything else (default) tries the agents first. */
export function routePlanner(): "agents" | "groq" {
  return process.env.ROUTE_PLANNER?.trim().toLowerCase() === "groq" ? "groq" : "agents";
}

/**
 * Time the agents get inside the route's 60 s limit (they usually take 25-38 s). After a timeout the
 * route uses the deterministic planner (~1 s), not Groq's model, so the request still ends in time.
 * A late agents run keeps going in the background; its result is discarded.
 */
export const AGENTS_BUDGET_MS = 45_000;

export class AgentsTimeoutError extends Error {
  constructor() { super(`trip agents took longer than ${AGENTS_BUDGET_MS} ms`); this.name = "AgentsTimeoutError"; }
}

/** The trip agents for the form. Returns null when they found nothing usable (→ Groq backup). */
export async function planWithAgents(
  input: ParsedRouteRequest,
  region: { id: number; name: string; slug: string },
  budgetMs: number = AGENTS_BUDGET_MS,
): Promise<ApiRoute | null> {
  const [{ runTripPipelineFromIntent }, { wizardIntent, wizardRequestText, agentsToApiRoute }] = await Promise.all([
    import("@/lib/trip-agents/pipeline"),
    import("@/lib/trip-agents/wizard"),
  ]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new AgentsTimeoutError()), budgetMs); });
  try {
    const result = await Promise.race([
      runTripPipelineFromIntent(wizardIntent(input, region.slug), wizardRequestText(input, region.name)),
      timeout,
    ]);
    if (result.plan.stops.length < 2) return null;
    return agentsToApiRoute(result, input, region);
  } finally {
    clearTimeout(timer);
  }
}

