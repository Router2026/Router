/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/locations/[id]/images/route.ts — UPDATED
// GET  /locations/:id/images  — list all images for a location (public)
// POST /locations/:id/images  — upload image (authenticated)
//   Body: { image_url: string } OR { image_data: string (base64), mime_type: string }

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import {
  saveLocationImage,
  getLocationImages,
  MAX_IMAGES_PER_USER_PER_LOCATION,
} from "@/lib/location-images/location-images-service";

// GET /locations/:id/images
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const locationId = Number.parseInt(id, 10);
    if (Number.isNaN(locationId)) {
      return NextResponse.json(errorResponse("Invalid location id", "VALIDATION_ERROR"), { status: 400 });
    }
    const images = await getLocationImages(locationId);
    return NextResponse.json(successResponse(images));
  } catch (err) {
    console.error("[GET /api/locations/:id/images]", err);
    return NextResponse.json(errorResponse("Failed to fetch images", "DB_ERROR"), { status: 500 });
  }
}

// POST /locations/:id/images
// Accepts: { image_url: string } OR { image_data: "<base64>", mime_type: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    let imageUrl: string;

    if (body.image_data && body.mime_type) {
      // File upload path — store as data URI
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(body.mime_type)) {
        return NextResponse.json(
          errorResponse("Unsupported image type. Use JPEG, PNG, WEBP or GIF.", "VALIDATION_ERROR"),
          { status: 400 }
        );
      }
      const base64Data: string = body.image_data.replace(/^data:[^;]+;base64,/, "");
      if (base64Data.length > 7 * 1024 * 1024) {
        return NextResponse.json(
          errorResponse("Image too large (max 5 MB)", "VALIDATION_ERROR"),
          { status: 413 }
        );
      }
      imageUrl = `data:${body.mime_type};base64,${base64Data}`;
    } else if (body.image_url) {
      imageUrl = (body.image_url as string).trim();
      if (!imageUrl.startsWith("http")) {
        return NextResponse.json(
          errorResponse("image_url must be a valid URL", "VALIDATION_ERROR"),
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        errorResponse("image_url or image_data+mime_type is required", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }

    const result = await saveLocationImage(auth.id, locationId, imageUrl);
    return NextResponse.json(successResponse({
      image: result.image,
      xp:    result.xp,
      limit: MAX_IMAGES_PER_USER_PER_LOCATION,
    }), { status: 201 });

  } catch (err: any) {
    console.error("[POST /api/locations/:id/images]", err);
    if (err?.code === "LIMIT_REACHED") {
      return NextResponse.json(errorResponse(err.message, "LIMIT_REACHED"), { status: 429 });
    }
    return NextResponse.json(errorResponse("Failed to upload image", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
