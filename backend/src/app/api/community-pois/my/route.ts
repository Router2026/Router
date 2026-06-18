// src/app/api/community-pois/my/route.ts
// GET /api/community-pois/my — returns all community POIs submitted by the authenticated user.
// Supports all statuses (pending / approved / rejected) so the owner can see their submission history.

import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { supabase } from "@/lib/db/supabase";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { CommunityPoiRow } from "@/lib/community-poi/types";

/** Resolve the authenticated DB user id from either a Supabase JWT or a legacy JWT */
async function resolveUserId(req: NextRequest): Promise<number | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  const {
    data: { user: sbUser },
  } = await supabase.auth.getUser(token);

  if (sbUser?.email) {
    const { rows } = await rawDb.query<{ id: number }>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [sbUser.email]
    );
    return rows.length ? rows[0].id : null;
  }

  const auth = await getUserFromRequest(req);
  return auth?.id ? auth.id : null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json(
        errorResponse("Authentication required", "AUTH_ERROR"),
        { status: 401 }
      );
    }

    const { rows } = await rawDb.query(
      `SELECT cp.*,
              u.username AS submitter_username,
              u.email    AS submitter_email
       FROM   community_pois cp
       LEFT JOIN users u ON u.id = cp.user_id
       WHERE  cp.user_id = $1
       ORDER BY cp.created_at DESC`,
      [userId]
    );

    return NextResponse.json(successResponse(rows as unknown as CommunityPoiRow[]));
  } catch (err) {
    console.error("[GET /api/community-pois/my]", err);
    return NextResponse.json(
      errorResponse("Failed to fetch your community POIs", "DB_ERROR"),
      { status: 500 }
    );
  }
}

export { OPTIONS } from "@/lib/api/cors";