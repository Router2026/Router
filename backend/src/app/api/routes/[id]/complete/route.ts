// POST /api/routes/:id/complete { stops_done } — a member finished the trip in live mode.
// Awards TRIP_COMPLETED XP once per user per route (migration 0016). Repeat calls are fine
// and award nothing.

import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { successResponse, errorResponse } from "@/lib/api/response";
import { authorizeRoute } from "@/lib/trip-collab/authorize";
import { awardXp, XP_REWARDS } from "@/lib/xp/xp-service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authz = await authorizeRoute(req, (await params).id, "member");
    if ("error" in authz) return authz.error;

    const body = await req.json().catch(() => ({}));
    const stopsDone = Number(body?.stops_done);
    const { rows: countRows } = await rawDb.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM route_stops WHERE route_id = $1`,
      [authz.routeId],
    );
    const stopCount = countRows[0]?.n ?? 0;
    if (!Number.isInteger(stopsDone) || stopsDone < 1 || stopsDone > stopCount) {
      return NextResponse.json(errorResponse("stops_done must be between 1 and the number of stops", "VALIDATION_ERROR"), { status: 400 });
    }

    const { rows } = await rawDb.query(
      `INSERT INTO trip_completions (route_id, user_id, stops_done) VALUES ($1, $2, $3)
       ON CONFLICT (route_id, user_id) DO NOTHING
       RETURNING 1`,
      [authz.routeId, authz.userId, stopsDone],
    );
    const firstTime = rows.length > 0;
    const xp = firstTime ? await awardXp(authz.userId, XP_REWARDS.TRIP_COMPLETED) : null;
    return NextResponse.json(successResponse({ completed: true, xp_awarded: firstTime, xp }));
  } catch (err) {
    console.error("[POST /api/routes/[id]/complete]", err);
    return NextResponse.json(errorResponse("Failed to record completion", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
