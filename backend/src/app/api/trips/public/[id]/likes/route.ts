// src/app/api/trips/public/[id]/likes/route.ts
// POST /trips/public/:id/likes — toggle like (authenticated)
// GET  /trips/public/:id/likes — get like status

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { toggleRouteLike, getRouteLikeStatus } from "@/lib/public-trips/route-social-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const routeId = parseInt(id, 10);
    if (isNaN(routeId)) return NextResponse.json(errorResponse("Invalid id", "VALIDATION_ERROR"), { status: 400 });

    const auth = await getUserFromRequest(req).catch(() => null);
    const result = await getRouteLikeStatus(routeId, auth?.id ?? null);
    return NextResponse.json(successResponse(result));
  } catch (err) {
    console.error("[GET /trips/public/:id/likes]", err);
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

    const result = await toggleRouteLike(routeId, auth.id);
    return NextResponse.json(successResponse(result));
  } catch (err) {
    console.error("[POST /trips/public/:id/likes]", err);
    return NextResponse.json(errorResponse("Failed", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
