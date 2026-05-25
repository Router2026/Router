// src/app/api/community-pois/[id]/route.ts
// GET    /api/community-pois/:id  — public, fetch a single community POI
// PATCH  /api/community-pois/:id  — owner-only edit (text fields + photos)
// DELETE /api/community-pois/:id  — owner-only delete (only pending POIs)
//
// Authorization rules:
//  • Only the user who submitted the POI may edit or delete it.
//  • Admins may edit/delete via the existing /api/admin/community-pois/:id route.
//  • A POI that has already been approved cannot be edited by its owner
//    (it is now part of the public map); the admin route must be used instead.

import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { supabase } from "@/lib/db/supabase";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getCommunityPoi, editCommunityPoi } from "@/lib/community-poi/community-poi-service";

type RouteParams = { params: Promise<{ id: string }> };

// ── Auth helper ────────────────────────────────────────────────────────────────

async function resolveUserId(req: NextRequest): Promise<number | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  const {
    data: { user: sbUser },
  } = await supabase.auth.getUser(token);

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

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const poiId = parseInt(id, 10);
    if (isNaN(poiId)) {
      return NextResponse.json(
        errorResponse("Invalid community POI id", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }

    const poi = await getCommunityPoi(poiId);
    if (!poi) {
      return NextResponse.json(
        errorResponse("Community POI not found", "NOT_FOUND"),
        { status: 404 }
      );
    }

    return NextResponse.json(successResponse(poi));
  } catch (err) {
    console.error("[GET /api/community-pois/[id]]", err);
    return NextResponse.json(
      errorResponse("Failed to fetch community POI", "DB_ERROR"),
      { status: 500 }
    );
  }
}

// ── PATCH ──────────────────────────────────────────────────────────────────────
// Allowed body fields: name, category, description, latitude, longitude, photos,
//   difficulty, duration_minutes, has_water, has_shade, accessible, photo_credit

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json(
        errorResponse("Authentication required", "AUTH_ERROR"),
        { status: 401 }
      );
    }

    const { id } = await params;
    const poiId = parseInt(id, 10);
    if (isNaN(poiId)) {
      return NextResponse.json(
        errorResponse("Invalid community POI id", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }

    // Fetch the existing POI to check ownership
    const existing = await getCommunityPoi(poiId);
    if (!existing) {
      return NextResponse.json(
        errorResponse("Community POI not found", "NOT_FOUND"),
        { status: 404 }
      );
    }

    // Ownership check — only the submitter may edit
    if (existing.user_id !== userId) {
      return NextResponse.json(
        errorResponse("You can only edit your own places", "FORBIDDEN"),
        { status: 403 }
      );
    }

    // Approved POIs are locked for owner editing (they're on the public map)
    if (existing.status === "approved") {
      return NextResponse.json(
        errorResponse(
          "Approved places cannot be edited directly. Please contact an admin.",
          "FORBIDDEN"
        ),
        { status: 403 }
      );
    }

    const body = await req.json();

    // Use the shared editCommunityPoi service (same as admin edit)
    const updated = await editCommunityPoi(poiId, {
      name: body.name,
      category: body.category,
      description: body.description,
      latitude: body.latitude,
      longitude: body.longitude,
      photos: body.photos,
    });

    // Also update the extra detail fields that editCommunityPoi doesn't cover yet
    const extraFields: string[] = [];
    const extraParams: (string | number | boolean | null)[] = [];
    let paramIdx = 2; // $1 is reserved for poiId

    if (body.difficulty !== undefined) {
      extraFields.push(`difficulty = $${paramIdx++}`);
      extraParams.push(body.difficulty ?? null);
    }
    if (body.duration_minutes !== undefined) {
      extraFields.push(`duration_minutes = $${paramIdx++}`);
      extraParams.push(body.duration_minutes != null ? parseInt(body.duration_minutes) : null);
    }
    if (body.has_water !== undefined) {
      extraFields.push(`has_water = $${paramIdx++}`);
      extraParams.push(body.has_water != null ? Boolean(body.has_water) : null);
    }
    if (body.has_shade !== undefined) {
      extraFields.push(`has_shade = $${paramIdx++}`);
      extraParams.push(body.has_shade != null ? Boolean(body.has_shade) : null);
    }
    if (body.accessible !== undefined) {
      extraFields.push(`accessible = $${paramIdx++}`);
      extraParams.push(body.accessible != null ? Boolean(body.accessible) : null);
    }
    if (body.photo_credit !== undefined) {
      extraFields.push(`photo_credit = $${paramIdx++}`);
      extraParams.push(body.photo_credit ?? null);
    }

    if (extraFields.length > 0) {
      extraFields.push(`updated_at = NOW()`);
      await rawDb.query(
        `UPDATE community_pois SET ${extraFields.join(", ")} WHERE id = $1`,
        [poiId, ...extraParams]
      );
    }

    // Re-fetch to return the fully updated record
    const final = await getCommunityPoi(poiId);
    return NextResponse.json(successResponse(final));
  } catch (err) {
    console.error("[PATCH /api/community-pois/[id]]", err);
    return NextResponse.json(
      errorResponse("Failed to update community POI", "DB_ERROR"),
      { status: 500 }
    );
  }
}

// ── DELETE ─────────────────────────────────────────────────────────────────────
// Owners may only delete their own pending/rejected POIs.

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json(
        errorResponse("Authentication required", "AUTH_ERROR"),
        { status: 401 }
      );
    }

    const { id } = await params;
    const poiId = parseInt(id, 10);
    if (isNaN(poiId)) {
      return NextResponse.json(
        errorResponse("Invalid community POI id", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }

    const existing = await getCommunityPoi(poiId);
    if (!existing) {
      return NextResponse.json(
        errorResponse("Community POI not found", "NOT_FOUND"),
        { status: 404 }
      );
    }

    if (existing.user_id !== userId) {
      return NextResponse.json(
        errorResponse("You can only delete your own places", "FORBIDDEN"),
        { status: 403 }
      );
    }

    if (existing.status === "approved") {
      return NextResponse.json(
        errorResponse(
          "Approved places cannot be deleted by their owner. Please contact an admin.",
          "FORBIDDEN"
        ),
        { status: 403 }
      );
    }

    await rawDb.query(`DELETE FROM community_pois WHERE id = $1`, [poiId]);
    return NextResponse.json(successResponse({ deleted: true }));
  } catch (err) {
    console.error("[DELETE /api/community-pois/[id]]", err);
    return NextResponse.json(
      errorResponse("Failed to delete community POI", "DB_ERROR"),
      { status: 500 }
    );
  }
}

export { OPTIONS } from "@/lib/api/cors";