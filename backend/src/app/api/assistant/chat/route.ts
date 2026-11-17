// POST /api/assistant/chat — AI trip-planning chat (admin-only during development).
// Stateless: the client sends the conversation, its Trip Bucket and (optionally) its location;
// the response carries the reply, place cards, and route actions for the client to apply.

import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { AssistantRequestSchema } from "@/lib/assistant/types";

export const maxDuration = 60;

/** Each message can trigger several paid model calls. */
const RATE_LIMIT_PER_MIN = 20;

export async function POST(req: NextRequest) {
  const { getUserFromRequest } = await import("@/lib/auth/tokens");
  const user = await getUserFromRequest(req);
  if (!user?.is_admin) {
    return NextResponse.json(errorResponse("Admin access required", "FORBIDDEN"), { status: 403 });
  }

  if (!(await checkRateLimit(`assistant:${user.id}`, RATE_LIMIT_PER_MIN, 60_000))) {
    return NextResponse.json(errorResponse("Too many messages, try again in a minute", "RATE_LIMITED"), {
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
  const parsed = AssistantRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    return NextResponse.json(errorResponse(message, "VALIDATION_ERROR"), { status: 400 });
  }

  try {
    const { runAssistant } = await import("@/lib/assistant/agent");
    return NextResponse.json(successResponse(await runAssistant(parsed.data)));
  } catch (err) {
    console.error("[POST /api/assistant/chat]", err);
    return NextResponse.json(errorResponse("Assistant failed", "INTERNAL_ERROR"), { status: 500 });
  }
}
