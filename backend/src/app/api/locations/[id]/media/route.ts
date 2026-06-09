/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/locations/[id]/media/route.ts
// POST /locations/:id/media — receives base64 media_data, uploads to Supabase Storage,
// then stores the resulting public URL in location_media.media_url.
//
// Previously stored raw data URIs in the DB (broken: bloated rows, CSP issues,
// no Supabase image transforms). Now stores proper https:// Storage URLs.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import {
  saveLocationMedia,
  uploadToStorage,
  getLocationMedia,
  approveMedia,
  rejectMedia,
  deleteMedia,
  getMediaType,
  validateMediaSize,
} from "@/lib/location-images/location-media-service";

type RouteParams = { params: Promise<{ id: string }> };

// ── POST body resolution helpers ──────────────────────────────────────────────

interface ResolvedMedia {
  mediaUrl: string;
  mediaType: "image" | "video";
  thumbnailUrl?: string;
}

async function resolveBase64Upload(
  body: { media_data: string; mime_type: string; thumbnail_url?: string },
  locationId: number,
): Promise<ResolvedMedia | NextResponse> {
  let mediaType: "image" | "video";
  try {
    mediaType = getMediaType(body.mime_type);
  } catch (err: any) {
    return NextResponse.json(errorResponse(err.message, "VALIDATION_ERROR"), { status: 400 });
  }

  const base64Data = body.media_data.replace(/^data:[^;]+;base64,/, "");
  try {
    validateMediaSize(base64Data, body.mime_type);
  } catch (err: any) {
    return NextResponse.json(errorResponse(err.message, "VALIDATION_ERROR"), { status: 413 });
  }

  let mediaUrl: string;
  try {
    mediaUrl = await uploadToStorage(base64Data, body.mime_type, `locations/${locationId}`);
  } catch (err: any) {
    console.error("[POST /api/locations/:id/media] storage upload failed:", err);
    return NextResponse.json(errorResponse("Failed to upload file to storage", "STORAGE_ERROR"), { status: 502 });
  }

  return { mediaUrl, mediaType, thumbnailUrl: body.thumbnail_url ?? undefined };
}

function resolveUrlUpload(
  body: { media_url: string; media_type?: string; thumbnail_url?: string },
): ResolvedMedia | NextResponse {
  const mediaUrl = body.media_url.trim();
  if (!mediaUrl.startsWith("http")) {
    return NextResponse.json(errorResponse("media_url must be a valid URL", "VALIDATION_ERROR"), { status: 400 });
  }
  const mediaType: "image" | "video" =
    body.media_type === "video" || /\.(mp4|webm|mov|avi)(\?|$)/i.test(mediaUrl)
      ? "video"
      : "image";
  return { mediaUrl, mediaType, thumbnailUrl: body.thumbnail_url ?? undefined };
}

// GET /locations/:id/media
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const locationId = Number.parseInt(id, 10);
    if (Number.isNaN(locationId)) {
      return NextResponse.json(errorResponse("Invalid location id", "VALIDATION_ERROR"), { status: 400 });
    }

    const url = new URL(req.url);
    const approvedOnly = url.searchParams.get("approved") === "true";

    const media = await getLocationMedia(locationId, approvedOnly);
    return NextResponse.json(successResponse(media));
  } catch (err) {
    console.error("[GET /api/locations/:id/media]", err);
    return NextResponse.json(errorResponse("Failed to fetch media", "DB_ERROR"), { status: 500 });
  }
}

// POST /locations/:id/media
// Body: { media_data: string (base64 data URI or raw base64), mime_type: string, caption?: string }
//    OR { media_url: string (already-public https URL), media_type?: string }
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
    let resolved: ResolvedMedia | NextResponse;

    if (body.media_data && body.mime_type) {
      resolved = await resolveBase64Upload(body, locationId);
    } else if (body.media_url) {
      resolved = resolveUrlUpload(body);
    } else {
      return NextResponse.json(
        errorResponse("media_url or media_data+mime_type is required", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }

    // If a helper returned a NextResponse (error), forward it
    if (resolved instanceof NextResponse) { return resolved; }

    const result = await saveLocationMedia(
      auth.id,
      locationId,
      resolved.mediaUrl,
      resolved.mediaType,
      resolved.thumbnailUrl,
      body.caption || undefined,
    );

    return NextResponse.json(successResponse({
      media: result.media,
      xp: result.xp,
    }), { status: 201 });

  } catch (err: any) {
    console.error("[POST /api/locations/:id/media]", err);
    if (err?.code === "LIMIT_REACHED") {
      return NextResponse.json(errorResponse(err.message, "LIMIT_REACHED"), { status: 429 });
    }
    if (err?.code === "VALIDATION_ERROR") {
      return NextResponse.json(errorResponse(err.message, "VALIDATION_ERROR"), { status: 400 });
    }
    return NextResponse.json(errorResponse("Failed to upload media", "DB_ERROR"), { status: 500 });
  }
}

// PATCH /locations/:id/media  — approve or reject (admin only)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth?.is_admin) {
      return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });
    }

    const body = await req.json();
    const { media_id, action } = body;

    if (!media_id || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        errorResponse("media_id and action (approve|reject) required", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }

    if (action === "approve") {
      const media = await approveMedia(media_id, auth.id);
      return NextResponse.json(successResponse(media));
    } else {
      await rejectMedia(media_id);
      return NextResponse.json(successResponse({ rejected: true }));
    }
  } catch (err: any) {
    console.error("[PATCH /api/locations/:id/media]", err);
    return NextResponse.json(errorResponse("Failed to update media", "DB_ERROR"), { status: 500 });
  }
}

// DELETE /locations/:id/media  — delete own media (or admin)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });
    }

    const body = await req.json();
    const { media_id } = body;
    if (!media_id) {
      return NextResponse.json(errorResponse("media_id is required", "VALIDATION_ERROR"), { status: 400 });
    }

    await deleteMedia(media_id, auth.id, auth.is_admin ?? false);
    return NextResponse.json(successResponse({ deleted: true }));
  } catch (err: any) {
    console.error("[DELETE /api/locations/:id/media]", err);
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json(errorResponse(err.message, "NOT_FOUND"), { status: 404 });
    }
    return NextResponse.json(errorResponse("Failed to delete media", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";