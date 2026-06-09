// src/app/api/locations/[id]/images/[imageId]/route.ts
// PATCH /locations/:id/images/:imageId  — approve or reject an image (admin only)
// DELETE /locations/:id/images/:imageId — delete an image (admin or owner)

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import {
  approveLocationImage,
  rejectLocationImage,
} from "@/lib/location-images/location-images-service";
import { rawDb } from "@/lib/db/raw-client";

type RouteParams = { params: Promise<{ id: string; imageId: string }> };

// PATCH — approve or reject
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth?.is_admin) {
      return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });
    }

    const { imageId } = await params;
    const id = Number.parseInt(imageId, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json(errorResponse("Invalid image id", "VALIDATION_ERROR"), { status: 400 });
    }

    const { action } = await req.json() as { action: "approve" | "reject" };

    if (action === "approve") {
      const image = await approveLocationImage(id, auth.id);
      return NextResponse.json(successResponse(image));
    } else if (action === "reject") {
      await rejectLocationImage(id);
      return NextResponse.json(successResponse({ rejected: true }));
    } else {
      return NextResponse.json(
        errorResponse("action must be 'approve' or 'reject'", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }
  } catch (err: any) {
    console.error("[PATCH /api/locations/:id/images/:imageId]", err);
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json(errorResponse("Image not found", "NOT_FOUND"), { status: 404 });
    }
    return NextResponse.json(errorResponse("Failed to update image", "DB_ERROR"), { status: 500 });
  }
}

// DELETE — remove image (admin or the original uploader)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });
    }

    const { imageId } = await params;
    const id = Number.parseInt(imageId, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json(errorResponse("Invalid image id", "VALIDATION_ERROR"), { status: 400 });
    }

    // Admins can delete any image; users can only delete their own
    if (auth.is_admin) {
      await rawDb.query("DELETE FROM location_images WHERE id = $1", [id]);
    } else {
      await rawDb.query(
        "DELETE FROM location_images WHERE id = $1 AND user_id = $2",
        [id, auth.id]
      );
    }

    return NextResponse.json(successResponse({ deleted: true }));
  } catch (err) {
    console.error("[DELETE /api/locations/:id/images/:imageId]", err);
    return NextResponse.json(errorResponse("Failed to delete image", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
