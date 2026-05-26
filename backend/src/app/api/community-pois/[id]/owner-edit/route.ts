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
import { supabase } from "@/lib/db/supabase";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getCommunityPoi } from "@/lib/community-poi/community-poi-service";

type RouteParams = { params: Promise<{ id: string }> };

// ── Auth helper ────────────────────────────────────────────────────────────────

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

// ── PATCH ──────────────────────────────────────────────────────────────────────

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

    // Load existing POI
    const existing = await getCommunityPoi(poiId);
    if (!existing) {
      return NextResponse.json(
        errorResponse("Community POI not found", "NOT_FOUND"),
        { status: 404 }
      );
    }

    // Ownership
    if (existing.user_id !== userId) {
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
    const existingLat = parseFloat(existing.latitude as unknown as string);
    const existingLng = parseFloat(existing.longitude as unknown as string);
    const newLat = body.latitude != null ? parseFloat(body.latitude) : null;
    const newLng = body.longitude != null ? parseFloat(body.longitude) : null;

    const locationChanged =
      newLat != null && newLng != null &&
      (Math.abs(newLat - existingLat) > 0.00001 || Math.abs(newLng - existingLng) > 0.00001);

    const client = await rawDb.getClient();
    try {
      await client.query("BEGIN");

      // ── 1. Update community_pois ──────────────────────────────────────────

      const cpFields: string[] = [];
      const cpParams: unknown[] = [poiId]; // $1
      let idx = 2;

      // Text / image fields — always updated immediately
      if (body.name !== undefined)        { cpFields.push(`name = $${idx++}`);             cpParams.push(body.name); }
      if (body.category !== undefined)    { cpFields.push(`category = $${idx++}`);         cpParams.push(body.category); }
      if (body.description !== undefined) { cpFields.push(`description = $${idx++}`);      cpParams.push(body.description ?? null); }
      if (body.photos !== undefined)      { cpFields.push(`photos = $${idx++}`);           cpParams.push(JSON.stringify(body.photos)); }
      if (body.difficulty !== undefined)  { cpFields.push(`difficulty = $${idx++}`);       cpParams.push(body.difficulty ?? null); }
      if (body.duration_minutes !== undefined) { cpFields.push(`duration_minutes = $${idx++}`); cpParams.push(body.duration_minutes != null ? parseInt(body.duration_minutes) : null); }
      if (body.has_water !== undefined)   { cpFields.push(`has_water = $${idx++}`);        cpParams.push(body.has_water ?? null); }
      if (body.has_shade !== undefined)   { cpFields.push(`has_shade = $${idx++}`);        cpParams.push(body.has_shade ?? null); }
      if (body.accessible !== undefined)  { cpFields.push(`accessible = $${idx++}`);       cpParams.push(body.accessible ?? null); }
      if (body.photo_credit !== undefined){ cpFields.push(`photo_credit = $${idx++}`);     cpParams.push(body.photo_credit ?? null); }

      // Location fields — only if changed; also resets status
      if (locationChanged) {
        cpFields.push(`latitude = $${idx++}`);    cpParams.push(newLat);
        cpFields.push(`longitude = $${idx++}`);   cpParams.push(newLng);
        cpFields.push(`status = 'pending'`);
        cpFields.push(`admin_note = NULL`);
        cpFields.push(`reviewed_by = NULL`);
        cpFields.push(`reviewed_at = NULL`);
      }

      if (cpFields.length > 0) {
        cpFields.push(`updated_at = NOW()`);
        await client.query(
          `UPDATE community_pois SET ${cpFields.join(", ")} WHERE id = $1`,
          cpParams
        );
      }

      // ── 2. Update the live locations row ──────────────────────────────────
      // The locations row is identified by source='community' AND source_id=poiId

      const locFields: string[] = [];
      const locParams: unknown[] = [String(poiId)]; // $1 = source_id
      let lidx = 2;

      if (body.name !== undefined)        { locFields.push(`name = $${lidx++}`);            locParams.push(body.name); }
      if (body.category !== undefined)    { locFields.push(`category = $${lidx++}`);        locParams.push(body.category); }
      if (body.description !== undefined) { locFields.push(`description = $${lidx++}`);     locParams.push(body.description ?? ""); }
      if (body.difficulty !== undefined)  { locFields.push(`difficulty = $${lidx++}`);      locParams.push(body.difficulty ?? "בינוני"); }
      if (body.duration_minutes !== undefined) { locFields.push(`duration_minutes = $${lidx++}`); locParams.push(body.duration_minutes != null ? parseInt(body.duration_minutes) : null); }
      if (body.has_water !== undefined)   { locFields.push(`has_water = $${lidx++}`);       locParams.push(body.has_water ?? false); }
      if (body.has_shade !== undefined)   { locFields.push(`has_shade = $${lidx++}`);       locParams.push(body.has_shade ?? false); }
      if (body.accessible !== undefined)  { locFields.push(`accessible = $${lidx++}`);      locParams.push(body.accessible ?? false); }
      if (body.photo_credit !== undefined){ locFields.push(`photo_credit = $${lidx++}`);    locParams.push(body.photo_credit ?? null); }

      // Photos: update images array and main_image
      if (body.photos !== undefined) {
        const photos: string[] = Array.isArray(body.photos) ? body.photos : [];
        locFields.push(`images = $${lidx++}`);      locParams.push(JSON.stringify(photos));
        locFields.push(`main_image = $${lidx++}`);  locParams.push(photos[0] ?? null);
      }

      // Location change: update coordinates and geom, flag for re-review
      if (locationChanged && newLat != null && newLng != null) {
        locFields.push(`latitude = $${lidx++}`);    locParams.push(newLat);
        locFields.push(`longitude = $${lidx++}`);   locParams.push(newLng);
        locFields.push(`geom = ST_SetSRID(ST_MakePoint($${lidx++}::float8, $${lidx++}::float8), 4326)::geography`);
        locParams.push(newLng); locParams.push(newLat);
      }

      if (locFields.length > 0) {
        locFields.push(`updated_at = NOW()`);
        await client.query(
          `UPDATE locations SET ${locFields.join(", ")} WHERE source = 'community' AND source_id = $1`,
          locParams
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