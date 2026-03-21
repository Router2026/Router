// src/app/api/trips/public/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getPublicTripById } from "@/lib/public-trips/public-trips-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tripId = parseInt(id, 10);
    if (isNaN(tripId)) {
      return NextResponse.json(errorResponse("Invalid trip id", "VALIDATION_ERROR"), { status: 400 });
    }
    const trip = await getPublicTripById(tripId);
    if (!trip) {
      return NextResponse.json(errorResponse("Trip not found", "NOT_FOUND"), { status: 404 });
    }
    return NextResponse.json(successResponse(trip));
  } catch (err) {
    console.error("[GET /api/trips/public/:id]", err);
    return NextResponse.json(errorResponse("Failed to fetch trip", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
