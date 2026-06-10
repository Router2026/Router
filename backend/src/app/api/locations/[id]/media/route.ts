// src/app/api/locations/[id]/media/route.ts
// POST /locations/:id/media — upload a file to Supabase Storage,
// then store the resulting public URL in location_media.media_url.
//
// FIX: Accepts multipart/form-data (FormData) instead of base64 JSON.
// Same root cause as /api/media/upload — base64 JSON exceeds Next.js's
// 4 MB default body limit for images over ~3 MB, causing "Failed to fetch".

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
  validateMediaSizeBytes,
} from "@/lib/location-images/location-media-service";

type RouteParams = { params: Promise<{ id: string }> };

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

    const contentType = req.headers.get("content-type") ?? "";

    let mediaUrl: string;
    let mediaType: "image" | "video";
    let thumbnailUrl: string | undefined;
    let caption: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      // ── FormData path (new default) ─────────────────────────────────────
      const form = await req.formData();
      const file = form.get("file");
      caption = form.get("caption")?.toString() || undefined;

      if (!file || typeof file === "string") {
        return NextResponse.json(
          errorResponse("'file' field is required in FormData", "VALIDATION_ERROR"),
          { status: 400 }
        );
      }

      const mimeType = file.type;

      try {
        mediaType = getMediaType(mimeType);
      } catch (err: any) {
        return NextResponse.json(errorResponse(err.message, "VALIDATION_ERROR"), { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      try {
        validateMediaSizeBytes(fileBuffer.length, mimeType);
      } catch (err: any) {
        return NextResponse.json(errorResponse(err.message, "VALIDATION_ERROR"), { status: 413 });
      }

      try {
        mediaUrl = await uploadToStorage(fileBuffer, mimeType, `locations/${locationId}`);
      } catch (err: any) {
        console.error("[POST /api/locations/:id/media] storage upload failed:", err);
        return NextResponse.json(
          errorResponse("Failed to upload file to storage", "STORAGE_ERROR"),
          { status: 502 }
        );
      }

    } else {
      // ── JSON path: either a pre-uploaded URL or legacy base64 ────────────
      const body = await req.json();

      if (body.media_url) {
        // Already-public URL (e.g. pasted from external CDN)
        mediaUrl = (body.media_url as string).trim();
        if (!mediaUrl.startsWith("http")) {
          return NextResponse.json(
            errorResponse("media_url must be a valid URL", "VALIDATION_ERROR"),
            { status: 400 }
          );
        }
        mediaType = body.media_type === "video" || /\.(mp4|webm|mov|avi)(\?|$)/i.test(mediaUrl)
          ? "video"
          : "image";
        thumbnailUrl = body.thumbnail_url || undefined;
        caption = body.caption || undefined;

      } else if (body.media_data && body.mime_type) {
        // Legacy base64 JSON — still supported for backward compat
        try {
          mediaType = getMediaType(body.mime_type);
        } catch (err: any) {
          return NextResponse.json(errorResponse(err.message, "VALIDATION_ERROR"), { status: 400 });
        }

        const base64Data: string = body.media_data.replace(/^data:[^;]+;base64,/, "");
        const fileBuffer = Buffer.from(base64Data, "base64");

        try {
          validateMediaSizeBytes(fileBuffer.length, body.mime_type);
        } catch (err: any) {
          return NextResponse.json(errorResponse(err.message, "VALIDATION_ERROR"), { status: 413 });
        }

        try {
          mediaUrl = await uploadToStorage(fileBuffer, body.mime_type, `locations/${locationId}`);
        } catch (err: any) {
          console.error("[POST /api/locations/:id/media] storage upload failed:", err);
          return NextResponse.json(
            errorResponse("Failed to upload file to storage", "STORAGE_ERROR"),
            { status: 502 }
          );
        }

        thumbnailUrl = body.thumbnail_url || undefined;
        caption = body.caption || undefined;
      } else {
        return NextResponse.json(
          errorResponse("Provide 'file' in FormData, 'media_url' in JSON, or 'media_data'+'mime_type' in JSON", "VALIDATION_ERROR"),
          { status: 400 }
        );
      }
    }

    const result = await saveLocationMedia(
      auth.id,
      locationId,
      mediaUrl,
      mediaType,
      thumbnailUrl,
      caption,
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

// PATCH /locations/:id/media — approve or reject (admin only)
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

// DELETE /locations/:id/media — delete own media (or admin)
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
