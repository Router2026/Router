// GET /users/:id — public profile + that user's public trips
// Uses getPublicTrips(user_id) to avoid fetching all trips and JS-filtering

import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getProfile } from "@/lib/users/profile-service";
import { getPublicTrips } from "@/lib/public-trips/public-trips-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json(errorResponse("Invalid user id", "VALIDATION_ERROR"), { status: 400 });
    }

    // Run profile + trips concurrently — no sequential waterfall
    const [profile, trips] = await Promise.all([
      getProfile(userId),
      getPublicTrips({ user_id: userId, limit: 50 }),
    ]);

    if (!profile) {
      return NextResponse.json(errorResponse("User not found", "NOT_FOUND"), { status: 404 });
    }

    return NextResponse.json(successResponse({ profile, trips }));
  } catch (err) {
    console.error("[GET /api/users/:id]", err);
    return NextResponse.json(errorResponse("Failed", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
