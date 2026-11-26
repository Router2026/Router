// POST /api/ai/generate-route
// Plans a one-day nature route for any signed-in user (the TripPlanner form). All stops come
// from the `locations` table.
//
// Planner: the trip agents (src/lib/trip-agents/, agents 2–6; the form replaces agent 1) by
// default. The older Groq planner (src/lib/ai-route/) is the backup: it runs when the agents
// fail or find nothing, and always when ROUTE_PLANNER=groq (switchable on Vercel without a deploy).

import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { rawDb } from "@/lib/db/raw-client";
import { planRoute, NoCandidatesError } from "@/lib/ai-route/generate";
import { createSelector } from "@/lib/ai-route/create-selector";
import type { StopSelector } from "@/lib/ai-route/groq";
import { parseRouteRequest, toApiRoute } from "@/lib/ai-route/http";
import { consumeRouteQuota } from "@/lib/ai-route/rate-limit";
import { AgentsTimeoutError, planWithAgents, routePlanner } from "@/lib/trip-agents/wizard-planner";

// The agents take ~25-30 s; the Groq backup is capped at ~25 s. Vercel Hobby allows up to 60 s.
export const maxDuration = 60;

// Module scope: one instance per server process, so the fallback selector's
// post-429 cooldown applies to every request, not just the one that hit it.
const selector: StopSelector | null = createSelector();

function fail(status: number, code: string, message: string, headers?: HeadersInit) {
  return NextResponse.json(errorResponse(message, code), { status, headers });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return fail(401, "AUTH_REQUIRED", "יש להתחבר כדי ליצור מסלול");

  const body = await req.json().catch(() => null);
  const parsed = parseRouteRequest(body);
  if (!parsed.ok) return fail(400, "VALIDATION_ERROR", parsed.message);
  const input = parsed.value;

  try {
    const { rows: regionRows } = await rawDb.query<{ id: number; name: string; slug: string }>(
      `SELECT id, name, slug FROM regions WHERE name = $1 OR slug = $1 LIMIT 1`,
      [input.region],
    );
    const region = regionRows[0];
    if (!region) return fail(400, "UNKNOWN_REGION", "האזור שנבחר לא נמצא");

    // Counted only after the request is valid, so typos do not burn quota.
    const quota = await consumeRouteQuota(user.id);
    const rateHeaders = {
      "X-RateLimit-Limit": String(quota.limit),
      "X-RateLimit-Remaining": String(quota.remaining),
      "X-RateLimit-Reset": String(Math.floor(quota.resetAt.getTime() / 1000)),
    };
    if (!quota.allowed) {
      const retryAfter = Math.max(1, Math.ceil((quota.resetAt.getTime() - Date.now()) / 1000));
      return fail(429, "RATE_LIMITED", "הגעת למספר המסלולים המרבי לשעה. נסו שוב מאוחר יותר", {
        ...rateHeaders,
        "Retry-After": String(retryAfter),
      });
    }

    // 1. Trip agents (default). Any failure falls through to the Groq planner below.
    let agentsTimedOut = false;
    if (routePlanner() === "agents") {
      const started = Date.now();
      try {
        const agentRoute = await planWithAgents(input, region);
        if (agentRoute) {
          console.info("[ai-route] planned", JSON.stringify({
            userId: user.id, regionId: region.id, planner: "agents", stops: agentRoute.stops.length, ms: Date.now() - started,
          }));
          return NextResponse.json(successResponse(agentRoute), { status: 200, headers: rateHeaders });
        }
        console.warn("[ai-route] agents found fewer than 2 stops; using the Groq planner");
      } catch (err) {
        agentsTimedOut = err instanceof AgentsTimeoutError;
        console.error(`[ai-route] agents ${agentsTimedOut ? "timed out; using the quick deterministic planner" : "failed; using the Groq planner"}`, err);
      }
    }

    // 2. Groq planner (backup, or forced with ROUTE_PLANNER=groq).
    const route = await planRoute(
      {
        regionId: region.id,
        prefs: {
          regionName: region.name,
          groupType: input.groupType,
          styles: input.styles,
          dayStart: input.dayStart,
          dayEnd: input.dayEnd,
          start: input.start,
          maxStops: input.maxStops,
        },
        seed: crypto.randomUUID(),
        signal: req.signal,
      },
      // After an agents timeout there's no time left for Groq's model: plan deterministically.
      { selector: agentsTimedOut ? null : selector },
    );

    // Structured log for monitoring AI quality (no PII beyond the numeric user id).
    console.info("[ai-route] planned", JSON.stringify({
      userId: user.id, regionId: region.id, planner: "groq", source: route.source, stops: route.stops.length, ...route.diagnostics,
    }));

    return NextResponse.json(successResponse(toApiRoute(route, input, region)), { status: 200, headers: rateHeaders });
  } catch (err) {
    if (err instanceof NoCandidatesError) {
      return fail(404, "NO_LOCATIONS", "לא נמצאו מקומות באזור שנבחר");
    }
    // Details stay in server logs; the client gets a generic message.
    console.error("[POST /api/ai/generate-route]", err);
    return fail(500, "GENERATION_ERROR", "יצירת המסלול נכשלה. נסו שוב בעוד רגע");
  }
}

export { OPTIONS } from "@/lib/api/cors";
