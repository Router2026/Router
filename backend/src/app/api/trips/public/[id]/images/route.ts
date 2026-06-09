// src/app/api/trips/public/[id]/images/route.ts
// GET  /trips/public/:id/images — list all images for a route
// POST /trips/public/:id/images — add an image (owner only)

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { addRouteImage, getRouteImages } from "@/lib/public-trips/route-social-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const routeId = Number.parseInt(id, 10);
    if (Number.isNaN(routeId)) return NextResponse.json(errorResponse("Invalid id", "VALIDATION_ERROR"), { status: 400 });

    const images = await getRouteImages(routeId);
    return NextResponse.json(successResponse(images));
  } catch (err) {
    console.error("[GET /trips/public/:id/images]", err);
    return NextResponse.json(errorResponse("Failed", "DB_ERROR"), { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    const { id } = await params;
    const routeId = Number.parseInt(id, 10);
    if (Number.isNaN(routeId)) return NextResponse.json(errorResponse("Invalid id", "VALIDATION_ERROR"), { status: 400 });

    const body = await req.json();
    if (!body.image_url) return NextResponse.json(errorResponse("image_url is required", "VALIDATION_ERROR"), { status: 400 });

    const image = await addRouteImage(routeId, auth.id, body.image_url, body.caption);
    return NextResponse.json(successResponse(image), { status: 201 });
  } catch (err: any) {
    if (err?.code === "NOT_FOUND") return NextResponse.json(errorResponse("Not authorized", "NOT_FOUND"), { status: 403 });
    console.error("[POST /trips/public/:id/images]", err);
    return NextResponse.json(errorResponse("Failed", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
