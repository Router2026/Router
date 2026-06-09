/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/community-pois/[id]/owner-edit/route.ts
//
// PATCH /api/community-pois/:id/owner-edit
//
// Owner-only edit for an APPROVED community POI (i.e. it is already live on the map).
//
// Split approval logic:
//   • Text / image changes  (name, description, category, photos, difficulty,
//     duration_minutes, has_water, has_shade, accessible, photo_credit)
//     → applied immediately to BOTH community_pois AND the locations row.
//       No re-approval required. Place stays live.
//
//   • Location change (latitude / longitude)
//     → community_pois status reset to 'pending', locations row is updated
//       with the new coordinates BUT marked is_featured = false and a
//       pending_relocation flag so admins know to re-verify.
//       The place stays visible on the map but is flagged for review.
//       (Alternatively you could remove from locations — see note below.)
//
// Authorization:
//   • Must be authenticated.
//   • community_pois.user_id must match the resolved user.
//   • Status must be 'approved' (pending/rejected use the existing PATCH /community-pois/:id).

import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getCommunityPoi } from "@/lib/community-poi/community-poi-service";
import { AuthUser, resolvePoiAuthUser } from "@/lib/auth/resolve-user";

type RouteParams = { params: Promise<{ id: string }> };

async function checkOwnership(poi: any, auth: AuthUser): Promise<boolean> {
  if (poi.user_id != null) return poi.user_id === auth.id;
  // Admin-submitted-on-behalf: match via uploaded_by on the locations row
  const { rows } = await rawDb.query(
    `SELECT uploaded_by FROM locations WHERE source = 'community' AND source_id = $1 LIMIT 1`,
    [String(poi.id)]
  );
  if (!rows.length) return false;
  return (rows[0].uploaded_by as string | null) === auth.username;
}

// ── Field-set builders ─────────────────────────────────────────────────────────

function buildCommunityPoiPatch(
  body: any,
  locationChanged: boolean,
  newLat: number | null,
  newLng: number | null,
): { fields: string[]; params: unknown[] } {
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 2; // $1 = poiId

  const add = (col: string, val: unknown) => { fields.push(`${col} = $${idx++}`); params.push(val); };

  if (body.name !== undefined)             add("name", body.name);
  if (body.category !== undefined)         add("category", body.category);
  if (body.description !== undefined)      add("description", body.description ?? null);
  if (body.photos !== undefined)           add("photos", JSON.stringify(body.photos));
  if (body.difficulty !== undefined)       add("difficulty", body.difficulty ?? null);
  if (body.duration_minutes !== undefined) add("duration_minutes", body.duration_minutes == null ? null : Number.parseInt(body.duration_minutes));
  if (body.has_water !== undefined)        add("has_water", body.has_water ?? null);
  if (body.has_shade !== undefined)        add("has_shade", body.has_shade ?? null);
  if (body.accessible !== undefined)       add("accessible", body.accessible ?? null);
  if (body.photo_credit !== undefined)     add("photo_credit", body.photo_credit ?? null);

  if (locationChanged && newLat != null && newLng != null) {
    add("latitude", newLat);
    add("longitude", newLng);
    fields.push("status = 'pending'", "admin_note = NULL", "reviewed_by = NULL", "reviewed_at = NULL");
  }

  return { fields, params };
}

function buildLocationPatch(
  body: any,
  locationChanged: boolean,
  newLat: number | null,
  newLng: number | null,
): { fields: string[]; params: unknown[] } {
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 2; // $1 = source_id

  const add = (col: string, val: unknown) => { fields.push(`${col} = $${idx++}`); params.push(val); };

  if (body.name !== undefined)             add("name", body.name);
  if (body.category !== undefined)         add("category", body.category);
  if (body.description !== undefined)      add("description", body.description ?? "");
  if (body.difficulty !== undefined)       add("difficulty", body.difficulty ?? "בינוני");
  if (body.duration_minutes !== undefined) add("duration_minutes", body.duration_minutes == null ? null : Number.parseInt(body.duration_minutes));
  if (body.has_water !== undefined)        add("has_water", body.has_water ?? false);
  if (body.has_shade !== undefined)        add("has_shade", body.has_shade ?? false);
  if (body.accessible !== undefined)       add("accessible", body.accessible ?? false);
  if (body.photo_credit !== undefined)     add("photo_credit", body.photo_credit ?? null);

  const photos: string[] = Array.isArray(body.photos) ? body.photos : [];
  if (body.photos !== undefined) {
    add("images", JSON.stringify(photos));
    add("main_image", photos[0] ?? null);
  }

  if (locationChanged) {
    add("latitude", newLat);
    add("longitude", newLng);
    fields.push(`geom = ST_SetSRID(ST_MakePoint($${idx++}::float8, $${idx++}::float8), 4326)::geography`);
    params.push(newLng, newLat);
  }

  return { fields, params };
}

// ── PATCH ──────────────────────────────────────────────────────────────────────

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

    // Load existing POI
    const existing = await getCommunityPoi(poiId);
    if (!existing) {
      return NextResponse.json(
        errorResponse("Community POI not found", "NOT_FOUND"),
        { status: 404 }
      );
    }

    // Ownership — handles normal (user_id) and admin-submitted-on-behalf (uploaded_by)
    if (!(await checkOwnership(existing, auth))) {
      return NextResponse.json(
        errorResponse("You can only edit your own places", "FORBIDDEN"),
        { status: 403 }
      );
    }

    // This endpoint is only for approved POIs
    // (pending/rejected are handled by PATCH /community-pois/:id)
    if (existing.status !== "approved") {
      return NextResponse.json(
        errorResponse(
          "This endpoint is for approved places only. Use PATCH /community-pois/:id for pending/rejected.",
          "VALIDATION_ERROR"
        ),
        { status: 400 }
      );
    }

    const body = await req.json();

    // Detect location change
    const existingLat = Number.parseFloat(String(existing.latitude));
    const existingLng = Number.parseFloat(String(existing.longitude));
    const newLat = body.latitude == null ? null : Number.parseFloat(body.latitude);
    const newLng = body.longitude == null ? null : Number.parseFloat(body.longitude);

    const locationChanged =
      newLat != null && newLng != null &&
      (Math.abs(newLat - existingLat) > 0.00001 || Math.abs(newLng - existingLng) > 0.00001);

    const client = await rawDb.getClient();
    try {
      await client.query("BEGIN");

      // ── 1. Update community_pois ──────────────────────────────────────────
      const { fields: cpFields, params: cpExtraParams } = buildCommunityPoiPatch(body, locationChanged, newLat, newLng);
      if (cpFields.length > 0) {
        cpFields.push(`updated_at = NOW()`);
        await client.query(
          `UPDATE community_pois SET ${cpFields.join(", ")} WHERE id = $1`,
          [poiId, ...cpExtraParams]
        );
      }

      // ── 2. Update the live locations row ──────────────────────────────────
      const { fields: locFields, params: locExtraParams } = buildLocationPatch(body, locationChanged, newLat, newLng);
      if (locFields.length > 0) {
        locFields.push(`updated_at = NOW()`);
        await client.query(
          `UPDATE locations SET ${locFields.join(", ")} WHERE source = 'community' AND source_id = $1`,
          [String(poiId), ...locExtraParams]
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    // Return updated community_pois row
    const updated = await getCommunityPoi(poiId);
    return NextResponse.json(
      successResponse({
        poi: updated,
        location_changed: locationChanged,
        pending_review: locationChanged,
      })
    );
  } catch (err: any) {
    console.error("[PATCH /api/community-pois/[id]/owner-edit]", err);
    return NextResponse.json(
      errorResponse("Failed to update place", "DB_ERROR"),
      { status: 500 }
    );
  }
}

export { OPTIONS } from "@/lib/api/cors";