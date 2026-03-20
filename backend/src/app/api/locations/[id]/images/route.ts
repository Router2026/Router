// src/app/api/locations/[id]/images/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import {
  saveLocationImage,
  getLocationImages,
  MAX_IMAGES_PER_USER_PER_LOCATION,
} from "@/lib/location-images/location-images-service";

// GET /locations/:id/images  — public, list all images for a location
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const locationId = parseInt(id, 10);
    if (isNaN(locationId)) {
      return NextResponse.json(errorResponse("Invalid location id", "VALIDATION_ERROR"), { status: 400 });
    }
    const images = await getLocationImages(locationId);
    return NextResponse.json(successResponse(images));
  } catch (err) {
    console.error("[GET /api/locations/:id/images]", err);
    return NextResponse.json(errorResponse("Failed to fetch images", "DB_ERROR"), { status: 500 });
  }
}

// POST /locations/:id/images  — authenticated, upload image URL
// Body: { image_url: string }
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
    const locationId = parseInt(id, 10);
    if (isNaN(locationId)) {
      return NextResponse.json(errorResponse("Invalid location id", "VALIDATION_ERROR"), { status: 400 });
    }

    const body = await req.json();
    const imageUrl: string = body.image_url?.trim();
    if (!imageUrl) {
      return NextResponse.json(
        errorResponse("image_url is required", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }
    if (!imageUrl.startsWith("http")) {
      return NextResponse.json(
        errorResponse("image_url must be a valid URL", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }

    const result = await saveLocationImage(auth.id, locationId, imageUrl);

    return NextResponse.json(successResponse({
      image:      result.image,
      xp:         result.xp,
      limit:      MAX_IMAGES_PER_USER_PER_LOCATION,
    }), { status: 201 });

  } catch (err: any) {
    console.error("[POST /api/locations/:id/images]", err);
    if (err?.code === "LIMIT_REACHED") {
      return NextResponse.json(errorResponse(err.message, "LIMIT_REACHED"), { status: 429 });
    }
    return NextResponse.json(errorResponse("Failed to upload image", "DB_ERROR"), { status: 500 });
  }
}
