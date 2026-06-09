// src/app/api/trips/public/[id]/images/[imageId]/route.ts
// DELETE /trips/public/:id/images/:imageId — delete a specific image (owner only)

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { deleteRouteImage } from "@/lib/public-trips/route-social-service";

type Params = { params: Promise<{ id: string; imageId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    const { id, imageId } = await params;
    const routeId  = Number.parseInt(id, 10);
    const imgId    = Number.parseInt(imageId, 10);
    if (Number.isNaN(routeId) || Number.isNaN(imgId)) {
      return NextResponse.json(errorResponse("Invalid id", "VALIDATION_ERROR"), { status: 400 });
    }

    await deleteRouteImage(routeId, imgId, auth.id);
    return NextResponse.json(successResponse({ deleted: true }));
  } catch (err: any) {
    if (err?.code === "NOT_FOUND") return NextResponse.json(errorResponse("Image not found or not authorized", "NOT_FOUND"), { status: 404 });
    console.error("[DELETE /trips/public/:id/images/:imageId]", err);
    return NextResponse.json(errorResponse("Failed", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
