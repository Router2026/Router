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
import { successResponse, errorResponse } from "@/lib/api/response";
import { getCommunityPoi, editCommunityPoi } from "@/lib/community-poi/community-poi-service";
import { CommunityPoiRow } from "@/lib/community-poi/types";
import { AuthUser, resolvePoiAuthUser } from "@/lib/auth/resolve-user";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Returns true when the authenticated user owns this community POI.
 * Handles two cases:
 *  1. Normal: community_pois.user_id matches the caller's DB user id.
 *  2. Admin-submitted-on-behalf: user_id is null but the corresponding
 *     locations row has uploaded_by matching the caller's username.
 */
async function isOwner(poi: CommunityPoiRow, auth: AuthUser): Promise<boolean> {
  if (poi.user_id != null) return poi.user_id === auth.id;
  // Fallback: check uploaded_by on the locations row
  const { rows } = await rawDb.query(
    `SELECT uploaded_by FROM locations WHERE source = 'community' AND source_id = $1 LIMIT 1`,
    [String(poi.id)]
  );
  if (!rows.length) return false;
  return (rows[0].uploaded_by as string | null) === auth.username;
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const poiId = Number.parseInt(id, 10);
    if (Number.isNaN(poiId)) {
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

type PoiFieldValue = string | number | boolean | null;

function buildExtraPoiFields(body: any): { fields: string[]; params: PoiFieldValue[] } {
  const fields: string[] = [];
  const params: PoiFieldValue[] = [];
  let idx = 2; // $1 = poiId

  const add = (col: string, val: PoiFieldValue) => {
    fields.push(`${col} = $${idx++}`);
    params.push(val);
  };

  if (body.difficulty !== undefined)       add("difficulty", body.difficulty ?? null);
  if (body.duration_minutes !== undefined) add("duration_minutes", body.duration_minutes == null ? null : Number.parseInt(body.duration_minutes));
  if (body.has_water !== undefined)        add("has_water", body.has_water == null ? null : Boolean(body.has_water));
  if (body.has_shade !== undefined)        add("has_shade", body.has_shade == null ? null : Boolean(body.has_shade));
  if (body.accessible !== undefined)       add("accessible", body.accessible == null ? null : Boolean(body.accessible));
  if (body.photo_credit !== undefined)     add("photo_credit", body.photo_credit ?? null);

  return { fields, params };
}

// ── PATCH ──────────────────────────────────────────────────────────────────────
// Allowed body fields: name, category, description, latitude, longitude, photos,
//   difficulty, duration_minutes, has_water, has_shade, accessible, photo_credit

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await resolvePoiAuthUser(req);
    if (!auth) {
      return NextResponse.json(
        errorResponse("Authentication required", "AUTH_ERROR"),
        { status: 401 }
      );
    }

    const { id } = await params;
    const poiId = Number.parseInt(id, 10);
    if (Number.isNaN(poiId)) {
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

    // Ownership check — handles normal (user_id match) and admin-submitted-on-behalf (uploaded_by match)
    if (!(await isOwner(existing, auth))) {
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
    await editCommunityPoi(poiId, {
      name: body.name,
      category: body.category,
      description: body.description,
      latitude: body.latitude,
      longitude: body.longitude,
      photos: body.photos,
    });

    const { fields: extraFields, params: extraParams } = buildExtraPoiFields(body);
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
    const auth = await resolvePoiAuthUser(req);
    if (!auth) {
      return NextResponse.json(
        errorResponse("Authentication required", "AUTH_ERROR"),
        { status: 401 }
      );
    }

    const { id } = await params;
    const poiId = Number.parseInt(id, 10);
    if (Number.isNaN(poiId)) {
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

    if (!(await isOwner(existing, auth))) {
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