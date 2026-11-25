// POST /api/ai/trip-agents — free-text request → full day plan by the six trip agents.
// Admin-only while the agents are being tuned.
//
// Response: NDJSON stream (one JSON object per line), so the UI can show progress during the
// ~25 s run:
//   {"type":"step","step":"conditions","phase":"start"}
//   ...
//   {"type":"result","data":{"plan":ClientPlan,"debug":{...}}}
//   or {"type":"error","code":"...","message":"..."}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { MAX_QUERY_CHARS } from "@/lib/trip-agents/intent-agent";

export const maxDuration = 60;

/** One request = ~5 model calls + weather + DB searches. */
const RATE_LIMIT_PER_MIN = 6;

const BodySchema = z.object({ query: z.string().trim().min(3).max(MAX_QUERY_CHARS) });

export async function POST(req: NextRequest) {
  const { getUserFromRequest } = await import("@/lib/auth/tokens");
  const user = await getUserFromRequest(req);
  if (!user?.is_admin) {
    return NextResponse.json(errorResponse("Admin access required", "FORBIDDEN"), { status: 403 });
  }
  if (!(await checkRateLimit(`trip-agents:${user.id}`, RATE_LIMIT_PER_MIN, 60_000))) {
    return NextResponse.json(errorResponse("Too many requests, try again in a minute", "RATE_LIMITED"), {
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
    return NextResponse.json(errorResponse(`query must be 3-${MAX_QUERY_CHARS} characters`, "VALIDATION_ERROR"), { status: 400 });
  }
  const query = parsed.data.query;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (obj: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          open = false; // client went away; the run finishes server-side
        }
      };
      try {
        const [{ runTripPipeline }, { toClientPlan, toDebug }] = await Promise.all([
          import("@/lib/trip-agents/pipeline"),
          import("@/lib/trip-agents/client"),
        ]);
        const result = await runTripPipeline(query, { onStep: (step, phase) => send({ type: "step", step, phase }) });
        if (result.plan.stops.length === 0) {
          send({ type: "error", code: "NO_PLACES", message: "לא מצאנו מקומות שמתאימים לבקשה. נסו לנסח אחרת או להרחיב את האזור." });
        } else {
          send({ type: "result", data: { plan: toClientPlan(result), debug: toDebug(result) } });
        }
      } catch (err) {
        console.error("[POST /api/ai/trip-agents]", err);
        send({ type: "error", code: "GENERATION_ERROR", message: "לא הצלחנו לבנות מסלול כרגע. נסו שוב בעוד רגע." });
      } finally {
        if (open) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export { OPTIONS } from "@/lib/api/cors";
