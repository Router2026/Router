// POST /api/ai/trip-agents — free-text request → full day plan by the six trip agents.
// Any signed-in user. Non-admins share the route planner's hourly quota (consumeRouteQuota), on
// top of a per-minute limit; the tuning data (`debug`) goes to admins only.
//
// Response: NDJSON stream (one JSON object per line), so the UI can show progress during the
// ~25 s run:
//   {"type":"step","step":"search","phase":"done","detail":"מצאתי 8 מקומות מתאימים..."}
//   ...
//   {"type":"result","data":{"plan":ClientPlan,"debug"?:{...}}}
//   or {"type":"error","code":"...","message":"..."}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api/response";
import { ndjsonResponse } from "@/lib/api/ndjson";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { consumeRouteQuota } from "@/lib/ai-route/rate-limit";
import { MAX_QUERY_CHARS } from "@/lib/trip-agents/intent-agent";

export const maxDuration = 60;

/** One request = ~5 model calls + weather + DB searches. */
const RATE_LIMIT_PER_MIN = 6;

const BodySchema = z.object({ query: z.string().trim().min(3).max(MAX_QUERY_CHARS) });

export async function POST(req: NextRequest) {
  const { getUserFromRequest } = await import("@/lib/auth/tokens");
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(errorResponse("יש להתחבר כדי לתכנן מסלול", "AUTH_REQUIRED"), { status: 401 });
  }
  const isAdmin = !!user.is_admin;
  if (!(await checkRateLimit(`trip-agents:${user.id}`, RATE_LIMIT_PER_MIN, 60_000))) {
    return NextResponse.json(errorResponse("יותר מדי בקשות, נסו שוב בעוד דקה", "RATE_LIMITED"), {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(errorResponse("Invalid JSON body", "VALIDATION_ERROR"), { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(errorResponse(`הבקשה צריכה להיות באורך 3-${MAX_QUERY_CHARS} תווים`, "VALIDATION_ERROR"), { status: 400 });
  }
  const query = parsed.data.query;

  // Counted only for valid requests. Admins tune the agents and aren't capped hourly.
  if (!isAdmin) {
    const quota = await consumeRouteQuota(user.id);
    if (!quota.allowed) {
      const retryAfter = Math.max(1, Math.ceil((quota.resetAt.getTime() - Date.now()) / 1000));
      return NextResponse.json(errorResponse("הגעת למספר המסלולים המרבי לשעה. נסו שוב מאוחר יותר", "RATE_LIMITED"), {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      });
    }
  }

  return ndjsonResponse(async (send) => {
    try {
      const [{ runTripPipeline }, { toClientPlan, toDebug }] = await Promise.all([
        import("@/lib/trip-agents/pipeline"),
        import("@/lib/trip-agents/client"),
      ]);
      const result = await runTripPipeline(query, {
        onStep: (step, phase, detail) => send({ type: "step", step, phase, ...(detail ? { detail } : {}) }),
      });
      if (result.plan.stops.length === 0) {
        send({ type: "error", code: "NO_PLACES", message: "לא מצאנו מקומות שמתאימים לבקשה. נסו לנסח אחרת או להרחיב את האזור." });
      } else {
        send({ type: "result", data: { plan: toClientPlan(result), ...(isAdmin ? { debug: toDebug(result) } : {}) } });
      }
    } catch (err) {
      console.error("[POST /api/ai/trip-agents]", err);
      send({ type: "error", code: "GENERATION_ERROR", message: "לא הצלחנו לבנות מסלול כרגע. נסו שוב בעוד רגע." });
    }
  });
}

export { OPTIONS } from "@/lib/api/cors";
