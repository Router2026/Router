// src/app/api/locations/[id]/route.ts — UPDATED
// GET   /locations/:id — public; enriches community-sourced POIs with owner_user_id
//                        so the frontend can decide whether to show the owner edit button.
// PATCH /locations/:id — admin only, edit location details incl. image
// DELETE /locations/:id — admin only

import { NextRequest, NextResponse } from "next/server";
import { getLocationById, updateLocation, deleteLocation } from "@/lib/locations/location-service";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { rawDb } from "@/lib/db/raw-client";

type RouteParams = { params: Promise<{ id: string }> };

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const locationId = parseInt(id, 10);
    if (isNaN(locationId)) {
      return NextResponse.json(errorResponse("Invalid location id", "VALIDATION_ERROR"), { status: 400 });
    }
    const location = await getLocationById(locationId);
    if (!location) {
      return NextResponse.json(errorResponse("Location not found", "NOT_FOUND"), { status: 404 });
    }

    // For community-submitted POIs, look up the original submitter's user_id so
    // the client can show an owner-edit button when the viewing user owns this place.
    let owner_user_id: number | null = null;
    let community_poi_id: number | null = null;
    if (location.source === "community" && location.source_id) {
      const { rows } = await rawDb.query(
        `SELECT id, user_id FROM community_pois WHERE id = $1 LIMIT 1`,
        [parseInt(location.source_id, 10)]
      );
      if (rows.length) {
        owner_user_id = (rows[0].user_id as number) ?? null;
        community_poi_id = rows[0].id as number;
      }
    }

    return NextResponse.json(successResponse({ ...location, owner_user_id, community_poi_id }));
  } catch (err) {
    console.error("[GET /api/locations/[id]]", err);
    return NextResponse.json(errorResponse("Failed to fetch location", "DB_ERROR"), { status: 500 });
  }
}

// ── PATCH — admin edit ─────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth?.is_admin) {
      return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });
    }

    const { id } = await params;
    const locationId = parseInt(id, 10);
    if (isNaN(locationId)) {
      return NextResponse.json(errorResponse("Invalid location id", "VALIDATION_ERROR"), { status: 400 });
    }

    const body = await req.json();
    const updated = await updateLocation(locationId, body);
    return NextResponse.json(successResponse(updated));
  } catch (err: any) {
    console.error("[PATCH /api/locations/[id]]", err);
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json(errorResponse("Location not found", "NOT_FOUND"), { status: 404 });
    }
    return NextResponse.json(errorResponse("Failed to update location", "DB_ERROR"), { status: 500 });
  }
}

// ── DELETE — admin delete ──────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth?.is_admin) {
      return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });
    }

    const { id } = await params;
    const locationId = parseInt(id, 10);
    if (isNaN(locationId)) {
      return NextResponse.json(errorResponse("Invalid location id", "VALIDATION_ERROR"), { status: 400 });
    }

    const deleted = await deleteLocation(locationId);
    if (!deleted) {
      return NextResponse.json(errorResponse("Location not found", "NOT_FOUND"), { status: 404 });
    }
    return NextResponse.json(successResponse({ deleted: true }));
  } catch (err) {
    console.error("[DELETE /api/locations/[id]]", err);
    return NextResponse.json(errorResponse("Failed to delete location", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";