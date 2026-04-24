// src/app/api/locations/featured/route.ts
// GET /api/locations/featured?limit=10
// Returns locations flagged as is_featured = TRUE, ordered by rating.

import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getFeaturedLocations } from "@/lib/locations/location-service";

export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(
      parseInt(req.nextUrl.searchParams.get("limit") || "10", 10),
      50
    );
    const featured = await getFeaturedLocations(limit);
    return NextResponse.json(successResponse(featured));
  } catch (err) {
    console.error("[GET /api/locations/featured]", err);
    return NextResponse.json(
      errorResponse("Failed to fetch featured locations", "DB_ERROR"),
      { status: 500 }
    );
  }
}

export { OPTIONS } from "@/lib/api/cors";
