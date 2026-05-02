// src/app/api/trips/public/route.ts
// GET /trips/public — list public trips with optional filters
// POST /trips/public — create a new trip (authenticated)

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getPublicTrips, createTrip, publishRoute } from "@/lib/public-trips/public-trips-service";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const userIdParam = sp.get("user_id") ? parseInt(sp.get("user_id")!, 10) : undefined;
    const trips = await getPublicTrips({
      user_id:    userIdParam && !isNaN(userIdParam) ? userIdParam : undefined,
      region:     sp.get("region")     || undefined,
      difficulty: sp.get("difficulty") || undefined,
      style:      sp.get("style")      || undefined,
      group_type: sp.get("group_type") || undefined,
      limit:      sp.get("limit")  ? parseInt(sp.get("limit")!)  : undefined,
      offset:     sp.get("offset") ? parseInt(sp.get("offset")!) : undefined,
    });
    return NextResponse.json(successResponse(trips));
  } catch (err) {
    console.error("[GET /api/trips/public]", err);
    return NextResponse.json(errorResponse("Failed to fetch trips", "DB_ERROR"), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    const body = await req.json();
    if (!body.title?.trim()) {
      return NextResponse.json(errorResponse("title is required", "VALIDATION_ERROR"), { status: 400 });
    }

    const { trip, xp } = await createTrip(auth.id, {
      title:          body.title.trim(),
      description:    body.description?.trim() || undefined,
      route_geojson:  body.route_geojson || undefined,
      is_public:      body.is_public ?? false,
      location_ids:   Array.isArray(body.location_ids) ? body.location_ids : [],
    });

    return NextResponse.json(successResponse({ ...trip, xp_awarded: xp }), { status: 201 });
  } catch (err) {
    console.error("[POST /api/trips/public]", err);
    return NextResponse.json(errorResponse("Failed to create trip", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
