// GET /users/:id — public profile + that user's public trips + approved community POIs
// Uses getPublicTrips(user_id) to avoid fetching all trips and JS-filtering
// Added: community_pois — the approved places submitted by this user (public view)

import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getProfile } from "@/lib/users/profile-service";
import { getPublicTrips } from "@/lib/public-trips/public-trips-service";
import { rawDb } from "@/lib/db/raw-client";
import { CommunityPoiRow } from "@/lib/community-poi/types";

type Params = { params: Promise<{ id: string }> };

async function getApprovedCommunityPoisForUser(userId: number): Promise<CommunityPoiRow[]> {
  const { rows } = await rawDb.query(
    `SELECT cp.*,
            u.username AS submitter_username
     FROM   community_pois cp
     LEFT JOIN users u ON u.id = cp.user_id
     WHERE  cp.user_id = $1
       AND  cp.status  = 'approved'
     ORDER BY cp.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = Number.parseInt(id, 10);
    if (Number.isNaN(userId)) {
      return NextResponse.json(errorResponse("Invalid user id", "VALIDATION_ERROR"), { status: 400 });
    }

    // Run all three queries concurrently — no sequential waterfall
    const [profile, trips, community_pois] = await Promise.all([
      getProfile(userId),
      getPublicTrips({ user_id: userId, limit: 50 }),
      getApprovedCommunityPoisForUser(userId),
    ]);

    if (!profile) {
      return NextResponse.json(errorResponse("User not found", "NOT_FOUND"), { status: 404 });
    }

    return NextResponse.json(successResponse({ profile, trips, community_pois }));
  } catch (err) {
    console.error("[GET /api/users/:id]", err);
    return NextResponse.json(errorResponse("Failed", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";