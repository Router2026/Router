// src/app/api/locations/route.ts  ← REPLACE existing file
// Changes vs original:
//  • Passes search param through (was missing — caused FTS to be skipped)
//  • Returns X-Total-Count header so Explore.tsx knows total without a second request
//  • Adds Cache-Control headers (CDN caches list for 2 min, stale-while-revalidate 5 min)
//  • Clamps limit to 100 (defence-in-depth on top of service-layer cap)

import { NextRequest, NextResponse } from "next/server";
import { getLocations, getFilteredCount } from "@/lib/locations/location-service";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;

    const userLat = sp.get("user_lat") ? parseFloat(sp.get("user_lat")!) : undefined;
    const userLng = sp.get("user_lng") ? parseFloat(sp.get("user_lng")!) : undefined;
    const validCoords =
      userLat !== undefined && userLng !== undefined &&
      !isNaN(userLat) && !isNaN(userLng) &&
      userLat >= -90 && userLat <= 90 &&
      userLng >= -180 && userLng <= 180;

    const rawLimit = sp.get("limit") ? parseInt(sp.get("limit")!) : 40;
    const limit = Math.min(rawLimit, 100); // never allow >100 per request

    const query = {
      region: sp.get("region") || undefined,
      category: sp.get("category") || undefined,
      difficulty: sp.get("difficulty") || undefined,
      search: sp.get("search") || undefined,
      has_water: sp.get("has_water") === "true",
      has_shade: sp.get("has_shade") === "true",
      accessible: sp.get("accessible") === "true",
      limit,
      offset: sp.get("offset") ? parseInt(sp.get("offset")!) : undefined,
      user_lat: validCoords ? userLat : undefined,
      user_lng: validCoords ? userLng : undefined,
    };

    // Run data + count in parallel — count is cheap (uses index) and cached separately
    const [data, total] = await Promise.all([
      getLocations(query),
      getFilteredCount(query),
    ]);

    // Determine if responses are personalised (coords = no CDN cache)
    const isPersonalised = validCoords;

    return NextResponse.json(successResponse(data), {
      headers: {
        // Tell Explore.tsx the total so it can show "X אתרים" without over-fetching
        "X-Total-Count": String(total),
        "Cache-Control": isPersonalised
          ? "private, no-store"
          : "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("[GET /api/locations]", err);
    return NextResponse.json(
      errorResponse("Failed to fetch locations", "DB_ERROR"),
      { status: 500 }
    );
  }
}

export { OPTIONS } from "@/lib/api/cors";