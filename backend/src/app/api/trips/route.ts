import { NextRequest, NextResponse } from "next/server";
import { TripInputSchema } from "@/lib/trips/schemas";
import { generateTrip } from "@/lib/trips/trip-service";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { checkRateLimit } from "@/lib/auth/rate-limit";

// Trip generation calls the LLM, so it is both an auth-gated and a
// rate-limited operation: 5 trips per user per 10 minutes, shared across all
// serverless instances via Upstash (see lib/auth/rate-limit.ts).
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json(errorResponse("Authentication required", "AUTH_ERROR"), { status: 401 });
  }

  if (!(await checkRateLimit(`trip-generate:${auth.id}`, RATE_LIMIT, RATE_WINDOW_MS))) {
    return NextResponse.json(
      errorResponse("Too many requests — please wait before generating another trip", "RATE_LIMITED"),
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = TripInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        errorResponse("Invalid input", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }

    const { uuid, plan } = await generateTrip(parsed.data);

    return NextResponse.json(successResponse({ tripId: uuid, plan }), {
      status: 201,
    });
  } catch (err) {
    console.error("[POST /api/trips]", err);
    return NextResponse.json(
      errorResponse(
        err instanceof Error ? err.message : "Plan generation failed — please try again",
        "GENERATION_ERROR"
      ),
      { status: 500 }
    );
  }
}

export { OPTIONS } from "@/lib/api/cors";
