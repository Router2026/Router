/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/trips/public/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getPublicTripById, updateRouteStops, publishRoute } from "@/lib/public-trips/public-trips-service";
import { getUserFromRequest } from "@/lib/auth/tokens";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tripId = Number.parseInt(id, 10);
    if (Number.isNaN(tripId)) {
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    const { id } = await params;
    const tripId = Number.parseInt(id, 10);
    if (Number.isNaN(tripId)) return NextResponse.json(errorResponse("Invalid trip id", "VALIDATION_ERROR"), { status: 400 });

    const body = await req.json();

    // Publish: flip is_public flag and award XP
    if (body.is_public === true) {
      const { trip, xp } = await publishRoute(tripId, auth.id);
      return NextResponse.json(successResponse({ ...trip, xp_awarded: xp }));
    }

    if (!Array.isArray(body.location_ids)) {
      return NextResponse.json(errorResponse("location_ids array or is_public required", "VALIDATION_ERROR"), { status: 400 });
    }
    await updateRouteStops(tripId, auth.id, body.location_ids);
    const updated = await getPublicTripById(tripId);
    return NextResponse.json(successResponse(updated));
  } catch (err: any) {
    if (err?.code === "NOT_FOUND") return NextResponse.json(errorResponse("Not authorized", "NOT_FOUND"), { status: 403 });
    console.error("[PATCH /api/trips/public/:id]", err);
    return NextResponse.json(errorResponse("Failed", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
