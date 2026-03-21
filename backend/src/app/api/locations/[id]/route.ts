// src/app/api/locations/[id]/route.ts — UPDATED
// GET   /locations/:id — public, get a single location (with approved image fallback)
// PATCH /locations/:id — admin only, edit location details incl. image

import { NextRequest, NextResponse } from "next/server";
import { getLocationById, updateLocation } from "@/lib/locations/location-service";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const location = await getLocationById(parseInt(id));
    if (!location) {
      return NextResponse.json(errorResponse("Location not found", "NOT_FOUND"), { status: 404 });
    }
    return NextResponse.json(successResponse(location));
  } catch (err) {
    console.error("[GET /api/locations/[id]]", err);
    return NextResponse.json(errorResponse("Failed to fetch location", "DB_ERROR"), { status: 500 });
  }
}

// PATCH — admin edit of a location
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
