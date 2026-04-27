// src/app/api/trips/public/[id]/media/route.ts
// PATCH /trips/public/:id/media — update route description, image_url, video_url (owner only)

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { updateRouteMedia } from "@/lib/public-trips/route-social-service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    const { id } = await params;
    const routeId = parseInt(id, 10);
    if (isNaN(routeId)) return NextResponse.json(errorResponse("Invalid id", "VALIDATION_ERROR"), { status: 400 });

    const body = await req.json();
    await updateRouteMedia(routeId, auth.id, {
      user_description: body.user_description,
      image_url:        body.image_url,
      video_url:        body.video_url,
    });

    return NextResponse.json(successResponse({ updated: true }));
  } catch (err: any) {
    if (err?.code === "NOT_FOUND") return NextResponse.json(errorResponse("Not found or not authorized", "NOT_FOUND"), { status: 404 });
    console.error("[PATCH /trips/public/:id/media]", err);
    return NextResponse.json(errorResponse("Failed", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
