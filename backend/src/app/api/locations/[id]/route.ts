// src/app/api/locations/[id]/route.ts
// GET   /locations/:id — public; enriches community-sourced POIs with owner_user_id.
//                        Now fetches location row + community_pois lookup CONCURRENTLY.
// PATCH /locations/:id — admin only
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
    const locationId = Number.parseInt(id, 10);
    if (Number.isNaN(locationId)) {
      return NextResponse.json(errorResponse("Invalid location id", "VALIDATION_ERROR"), { status: 400 });
    }

    // FIX: Previously this was sequential — first await getLocationById(), then
    // await rawDb.query() for community ownership. We now fire both queries
    // concurrently with Promise.all so the total wait time is max(t1, t2)
    // instead of t1 + t2.
    //
    // The community_pois lookup is fire-and-forget until we know the source, but
    // since getLocationById() checks its own in-memory cache we get near-zero
    // overhead on the common case where it's already cached. On a cold call both
    // round-trips to Postgres happen in parallel.

    const [location, communityRow] = await Promise.all([
      getLocationById(locationId),
      // Pre-fetch community ownership speculatively; we'll discard it below if
      // source !== "community". One extra DB query wasted on the rare non-community
      // POI, but that query is a tiny indexed PK lookup and the parallelism wins
      // every time for community POIs (which are the slow path that was timing out).
      rawDb
        .query(
          `SELECT cp.id, cp.user_id
           FROM   community_pois cp
           JOIN   locations      l  ON l.source = 'community'
                                   AND l.source_id = cp.id::text
           WHERE  l.id = $1
           LIMIT  1`,
          [locationId]
        )
        .catch(() => ({ rows: [] as any[] })), // never let a missing community row break the response
    ]);

    if (!location) {
      return NextResponse.json(errorResponse("Location not found", "NOT_FOUND"), { status: 404 });
    }

    // Resolve community ownership from the speculatively-fetched row
    let owner_user_id: number | null = null;
    let community_poi_id: number | null = null;

    if (location.source === "community" && communityRow.rows.length) {
      owner_user_id  = (communityRow.rows[0].user_id as number) ?? null;
      community_poi_id = communityRow.rows[0].id as number;
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
    const locationId = Number.parseInt(id, 10);
    if (Number.isNaN(locationId)) {
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
    const locationId = Number.parseInt(id, 10);
    if (Number.isNaN(locationId)) {
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