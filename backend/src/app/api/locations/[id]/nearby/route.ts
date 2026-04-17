// src/app/api/locations/[id]/nearby/route.ts
// GET /locations/:id/nearby?limit=6&radius=25000
// Returns nearby locations sorted by geographic distance using PostGIS.

import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getNearbyLocations } from "@/lib/locations/location-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const locationId = parseInt(id, 10);
    if (isNaN(locationId)) {
      return NextResponse.json(errorResponse("Invalid location id", "VALIDATION_ERROR"), { status: 400 });
    }

    const url = new URL(req.url);
    const limit  = Math.min(parseInt(url.searchParams.get("limit") || "6", 10), 20);
    const radius = Math.min(parseInt(url.searchParams.get("radius") || "25000", 10), 100000);

    const nearby = await getNearbyLocations(locationId, limit, radius);
    return NextResponse.json(successResponse(nearby));
  } catch (err: any) {
    console.error("[GET /api/locations/:id/nearby]", err);
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json(errorResponse("Location not found", "NOT_FOUND"), { status: 404 });
    }
    return NextResponse.json(errorResponse("Failed to fetch nearby locations", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
