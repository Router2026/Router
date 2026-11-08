import { NextRequest, NextResponse } from "next/server";
import { getTripByUuid, regenerateStop } from "@/lib/trips/trip-service";
import { successResponse, errorResponse } from "@/lib/api/response";
import { RegenerateStopSchema } from "@/lib/trips/schemas";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { checkRateLimit } from "@/lib/auth/rate-limit";

const REGEN_LIMIT = 20;
const REGEN_WINDOW_MS = 10 * 60 * 1000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const trip = await getTripByUuid(id);

    if (!trip) {
      return NextResponse.json(errorResponse("Trip not found", "NOT_FOUND"), {
        status: 404,
      });
    }

    return NextResponse.json(successResponse(trip));
  } catch (err) {
    console.error("[GET /api/trips/[id]]", err);
    return NextResponse.json(
      errorResponse("Failed to fetch trip", "SERVER_ERROR"),
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Regenerating a stop calls the LLM and overwrites the stored plan. Trips
  // have no owner column yet, so nobody but an admin can be authorised to
  // mutate one. Once trips.user_id exists, allow `trip.userId === auth.id` too.
  const auth = await getUserFromRequest(req);
  if (!auth) {
    return NextResponse.json(errorResponse("Authentication required", "AUTH_ERROR"), { status: 401 });
  }
  if (!auth.is_admin) {
    return NextResponse.json(errorResponse("Forbidden", "FORBIDDEN"), { status: 403 });
  }
  if (!(await checkRateLimit(`trip-regenerate:${auth.id}`, REGEN_LIMIT, REGEN_WINDOW_MS))) {
    return NextResponse.json(
      errorResponse("Too many requests — please wait before regenerating again", "RATE_LIMITED"),
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = RegenerateStopSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }

    const { dayIndex, stopIndex } = parsed.data;
    const result = await regenerateStop(id, dayIndex, stopIndex);

    return NextResponse.json(successResponse(result));
  } catch (err) {
    console.error("[PATCH /api/trips/[id]]", err);
    const status = (err as { status?: number }).status === 400 ? 400 : 500;
    const code = status === 400 ? "VALIDATION_ERROR" : "SERVER_ERROR";
    return NextResponse.json(
      errorResponse(err instanceof Error ? err.message : "Failed to regenerate stop", code),
      { status }
    );
  }
}

export { OPTIONS } from "@/lib/api/cors";
