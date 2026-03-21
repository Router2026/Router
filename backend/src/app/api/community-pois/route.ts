// src/app/api/community-pois/route.ts
// POST: authenticated user submits a new community POI.
// GET:  public listing of approved community POIs.

import { NextRequest, NextResponse } from "next/server";
import {
  createCommunityPoi,
  listAllCommunityPois,
} from "@/lib/community-poi/community-poi-service";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { rawDb } from "@/lib/db/raw-client";
import { supabase } from "@/lib/db/supabase";

/** Resolve the DB user id from either a Supabase JWT or a legacy JWT */
async function resolveUserId(req: NextRequest): Promise<number | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  const { data: { user: sbUser } } = await supabase.auth.getUser(token);
  if (sbUser?.email) {
    const { rows } = await rawDb.query(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [sbUser.email]
    );
    return rows.length ? (rows[0].id as number) : null;
  }

  const auth = await getUserFromRequest(req);
  return auth?.id ? (auth.id as number) : null;
}

export async function GET(req: NextRequest) {
  try {
    // Public endpoint returns only approved pois
    const pois = await listAllCommunityPois("approved");
    return NextResponse.json(successResponse(pois));
  } catch (err) {
    console.error("[GET /api/community-pois]", err);
    return NextResponse.json(
      errorResponse("Failed to fetch community POIs", "DB_ERROR"),
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Authentication is required
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json(
        errorResponse("Authentication required", "AUTH_ERROR"),
        { status: 401 }
      );
    }

    const body = await req.json();

    // Validate required fields
    if (!body.name || !body.latitude || !body.longitude) {
      return NextResponse.json(
        errorResponse("name, latitude, and longitude are required", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }

    const poi = await createCommunityPoi({
      userId,
      name:        body.name,
      category:    body.category    ?? "טבע",
      description: body.description ?? undefined,
      latitude:    parseFloat(body.latitude),
      longitude:   parseFloat(body.longitude),
      photos:      Array.isArray(body.photos) ? body.photos : [],
    });

    return NextResponse.json(successResponse(poi), { status: 201 });
  } catch (err) {
    console.error("[POST /api/community-pois]", err);
    return NextResponse.json(
      errorResponse("Failed to create community POI", "DB_ERROR"),
      { status: 500 }
    );
  }
}

export { OPTIONS } from "@/lib/api/cors";
