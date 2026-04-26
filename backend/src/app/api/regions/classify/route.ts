// src/app/api/regions/classify/route.ts
// GET /api/regions/classify?lat=XX&lng=YY
// Returns the best-matching region from the DB for the given coordinates.

import { NextRequest, NextResponse } from "next/server";
import { classifyRegion } from "@/lib/community-poi/community-poi-service";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get("lat") ?? "");
    const lng = parseFloat(searchParams.get("lng") ?? "");

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        errorResponse("lat and lng query params are required", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }

    const region = await classifyRegion(lat, lng);

    if (!region) {
      return NextResponse.json(
        errorResponse("No region found", "NOT_FOUND"),
        { status: 404 }
      );
    }

    return NextResponse.json(
      successResponse({ name: region.region_name, id: region.region_id })
    );
  } catch (err) {
    console.error("[GET /api/regions/classify]", err);
    return NextResponse.json(
      errorResponse("Failed to classify region", "DB_ERROR"),
      { status: 500 }
    );
  }
}

export { OPTIONS } from "@/lib/api/cors";
