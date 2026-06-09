// src/app/api/locations/[id]/rating/route.ts
// POST /locations/:id/rating  — authenticated user rates a location (1-5)
// GET  /locations/:id/rating  — public summary (avg, count); if auth, includes user's rating

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { rateLocation, getRatingSummary } from "@/lib/ratings/rating-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const locationId = Number.parseInt(id, 10);
    if (Number.isNaN(locationId)) {
      return NextResponse.json(errorResponse("Invalid location id", "VALIDATION_ERROR"), { status: 400 });
    }

    const auth = await getUserFromRequest(req).catch(() => null);
    const summary = await getRatingSummary(locationId, auth?.id);
    return NextResponse.json(successResponse(summary));
  } catch (err) {
    console.error("[GET /api/locations/:id/rating]", err);
    return NextResponse.json(errorResponse("Failed to fetch rating", "DB_ERROR"), { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });
    }

    const { id } = await params;
    const locationId = Number.parseInt(id, 10);
    if (Number.isNaN(locationId)) {
      return NextResponse.json(errorResponse("Invalid location id", "VALIDATION_ERROR"), { status: 400 });
    }

    const body = await req.json();
    const rating = Number.parseInt(body.rating, 10);
    if (Number.isNaN(rating)) {
      return NextResponse.json(errorResponse("rating must be a number 1-5", "VALIDATION_ERROR"), { status: 400 });
    }

    const summary = await rateLocation(locationId, auth.id, rating);
    return NextResponse.json(successResponse(summary), { status: 200 });
  } catch (err: any) {
    console.error("[POST /api/locations/:id/rating]", err);
    if (err?.code === "VALIDATION_ERROR") {
      return NextResponse.json(errorResponse(err.message, "VALIDATION_ERROR"), { status: 400 });
    }
    return NextResponse.json(errorResponse("Failed to save rating", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
