// src/app/api/trips/public/[id]/rating/route.ts
// GET  /trips/public/:id/rating — get rating status for current user
// POST /trips/public/:id/rating — set / update rating (authenticated)

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { setRouteRating, getRouteRatingStatus } from "@/lib/public-trips/route-social-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const routeId = parseInt(id, 10);
    if (isNaN(routeId)) return NextResponse.json(errorResponse("Invalid id", "VALIDATION_ERROR"), { status: 400 });

    const auth = await getUserFromRequest(req).catch(() => null);
    const result = await getRouteRatingStatus(routeId, auth?.id ?? null);
    return NextResponse.json(successResponse(result));
  } catch (err) {
    console.error("[GET /trips/public/:id/rating]", err);
    return NextResponse.json(errorResponse("Failed", "DB_ERROR"), { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    const { id } = await params;
    const routeId = parseInt(id, 10);
    if (isNaN(routeId)) return NextResponse.json(errorResponse("Invalid id", "VALIDATION_ERROR"), { status: 400 });

    const body = await req.json();
    const rating = parseInt(body.rating, 10);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(errorResponse("Rating must be 1-5", "VALIDATION_ERROR"), { status: 400 });
    }

    const result = await setRouteRating(routeId, auth.id, rating);
    return NextResponse.json(successResponse(result));
  } catch (err) {
    console.error("[POST /trips/public/:id/rating]", err);
    return NextResponse.json(errorResponse("Failed", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
