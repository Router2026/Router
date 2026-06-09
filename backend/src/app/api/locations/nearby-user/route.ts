// src/app/api/locations/nearby-user/route.ts
// GET /api/locations/nearby-user?lat=32.1&lng=34.9&limit=8&radius=30000
// Returns locations near the user's coordinates using PostGIS ST_DWithin.

import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getNearbyUserLocations } from "@/lib/locations/location-service";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;

    const lat = Number.parseFloat(sp.get("lat") || "");
    const lng = Number.parseFloat(sp.get("lng") || "");

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json(
        errorResponse("lat and lng query params are required", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }

    // Basic sanity bounds for Israel + surroundings
    if (lat < 29 || lat > 34 || lng < 34 || lng > 36) {
      return NextResponse.json(
        errorResponse("Coordinates out of supported range", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }

    const limit  = Math.min(Number.parseInt(sp.get("limit")  || "8",     10), 20);
    const radius = Math.min(Number.parseInt(sp.get("radius") || "30000", 10), 100000);

    const nearby = await getNearbyUserLocations(lat, lng, limit, radius);
    return NextResponse.json(successResponse(nearby));
  } catch (err) {
    console.error("[GET /api/locations/nearby-user]", err);
    return NextResponse.json(
      errorResponse("Failed to fetch nearby locations", "DB_ERROR"),
      { status: 500 }
    );
  }
}

export { OPTIONS } from "@/lib/api/cors";
