// src/app/api/trips/public/[id]/media/route.ts
// GET  /trips/public/:id/media    — list all media (images + videos)
// POST /trips/public/:id/media    — upload image or video (authenticated)
//
// POST body options:
//   { media_url: string, media_type?: "image"|"video" }
//   { media_data: string (base64), mime_type: string, caption?: string }

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import {
  saveLocationMedia,
  getLocationMedia,
  approveMedia,
  rejectMedia,
  deleteMedia,
  getMediaType,
  validateMediaSize,
} from "@/lib/location-images/location-media-service";

type RouteParams = { params: Promise<{ id: string }> };

// GET /trips/public/:id/media
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
    console.error("[GET /api/trips/public/:id/media]", err);
    return NextResponse.json(errorResponse("Failed to fetch media", "DB_ERROR"), { status: 500 });
  }
}

// Next.js App Router: disable body size limit for this route (needed for large file uploads)
export const config = {
  api: { bodyParser: false },
};

// POST /trips/public/:id/media — upload image or video (multipart/form-data OR JSON)
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

    let mediaUrl: string;
    let mediaType: "image" | "video";
    let thumbnailUrl: string | undefined;
    let caption: string | undefined;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // ── Multipart file upload (used for actual file uploads to avoid base64 overhead) ──
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      caption = (formData.get("caption") as string) || undefined;

      if (!file) {
        return NextResponse.json(errorResponse("file field is required for multipart upload", "VALIDATION_ERROR"), { status: 400 });
      }

      try {
        mediaType = getMediaType(file.type);
      } catch (err: any) {
        return NextResponse.json(errorResponse(err.message, "VALIDATION_ERROR"), { status: 400 });
      }

      // Read file as buffer and convert to base64 data URL for storage
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Data = buffer.toString("base64");

      try {
        validateMediaSize(base64Data, file.type);
      } catch (err: any) {
        return NextResponse.json(errorResponse(err.message, "VALIDATION_ERROR"), { status: 413 });
      }

      mediaUrl = `data:${file.type};base64,${base64Data}`;
      thumbnailUrl = undefined;

    } else {
      // ── JSON body (URL submission or legacy base64) ──
      const body = await req.json();
      caption = body.caption || undefined;

      if (body.media_data && body.mime_type) {
        // Legacy base64 JSON upload
        try {
          mediaType = getMediaType(body.mime_type);
        } catch (err: any) {
          return NextResponse.json(errorResponse(err.message, "VALIDATION_ERROR"), { status: 400 });
        }

        const base64Data: string = body.media_data.replace(/^data:[^;]+;base64,/, "");

        try {
          validateMediaSize(base64Data, body.mime_type);
        } catch (err: any) {
          return NextResponse.json(errorResponse(err.message, "VALIDATION_ERROR"), { status: 413 });
        }

        mediaUrl = `data:${body.mime_type};base64,${base64Data}`;
        thumbnailUrl = body.thumbnail_url || undefined;

      } else if (body.media_url) {
        mediaUrl = (body.media_url as string).trim();
        if (!mediaUrl.startsWith("http")) {
          return NextResponse.json(
            errorResponse("media_url must be a valid URL", "VALIDATION_ERROR"),
            { status: 400 }
          );
        }
        if (body.media_type === "video" || /\.(mp4|webm|mov|avi)(\?|$)/i.test(mediaUrl)) {
          mediaType = "video";
        } else {
          mediaType = "image";
        }
        thumbnailUrl = body.thumbnail_url || undefined;

      } else {
        return NextResponse.json(
          errorResponse("file (multipart), media_url, or media_data+mime_type is required", "VALIDATION_ERROR"),
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
    console.error("[POST /api/trips/public/:id/media]", err);
    if (err?.code === "LIMIT_REACHED") {
      return NextResponse.json(errorResponse(err.message, "LIMIT_REACHED"), { status: 429 });
    }
    if (err?.code === "VALIDATION_ERROR") {
      return NextResponse.json(errorResponse(err.message, "VALIDATION_ERROR"), { status: 400 });
    }
    return NextResponse.json(errorResponse("Failed to upload media", "DB_ERROR"), { status: 500 });
  }
}

// PATCH /trips/public/:id/media  — approve or reject (admin only)
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
    console.error("[PATCH /api/trips/public/:id/media]", err);
    return NextResponse.json(errorResponse("Failed to update media", "DB_ERROR"), { status: 500 });
  }
}

// DELETE /trips/public/:id/media  — delete own media (or admin)
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
    console.error("[DELETE /api/trips/public/:id/media]", err);
    if (err?.code === "NOT_FOUND") {
      return NextResponse.json(errorResponse(err.message, "NOT_FOUND"), { status: 404 });
    }
    return NextResponse.json(errorResponse("Failed to delete media", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";