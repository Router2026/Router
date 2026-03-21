// src/app/api/routes/[id]/share/route.ts
// POST /routes/:id/share — mark route as shared, award XP once per user per route

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { rawDb } from "@/lib/db/raw-client";
import { awardXp, XP_REWARDS } from "@/lib/xp/xp-service";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });
    }

    const { id } = await params;
    const routeId = parseInt(id, 10);
    if (isNaN(routeId)) {
      return NextResponse.json(errorResponse("Invalid route id", "VALIDATION_ERROR"), { status: 400 });
    }

    // Increment share_count on route
    await rawDb.query(
      `UPDATE routes SET share_count = COALESCE(share_count, 0) + 1 WHERE id = $1`,
      [routeId]
    );

    // Award XP only once per user-route pair
    const { rows } = await rawDb.query(
      `INSERT INTO trip_shares (user_id, route_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, route_id) DO NOTHING
       RETURNING id`,
      [auth.id, routeId]
    );

    const xpAwarded = rows.length > 0;
    let xpResult = null;
    if (xpAwarded) {
      xpResult = await awardXp(auth.id, XP_REWARDS.TRIP_SHARED);
    }

    return NextResponse.json(successResponse({
      shared:      true,
      xp_awarded:  xpAwarded,
      xp:          xpResult,
    }));
  } catch (err) {
    console.error("[POST /api/routes/:id/share]", err);
    return NextResponse.json(errorResponse("Failed to share trip", "DB_ERROR"), { status: 500 });
  }
}
