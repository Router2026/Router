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

type ParsedMedia = {
  mediaUrl: string;
  mediaType: "image" | "video";
  thumbnailUrl?: string;
  caption?: string;
};

/** Narrow an unknown caught value to an object with message and optional code */
function asAppError(err: unknown): { message: string; code?: string } {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    return {
      message: typeof e.message === "string" ? e.message : "Unknown error",
      code: typeof e.code === "string" ? e.code : undefined,
    };
  }
  return { message: String(err) };
}

/** Parse and validate a multipart/form-data upload request. Returns ParsedMedia or a NextResponse error. */
async function parseFormDataUpload(
  req: NextRequest,
  locationId: number,
): Promise<ParsedMedia | NextResponse> {
  const form = await req.formData();
  const file = form.get("file");
  const captionRaw = form.get("caption");
  const caption = (typeof captionRaw === 'string' ? captionRaw : '') || undefined;

  if (!file || typeof file === "string") {
    return NextResponse.json(
      errorResponse("'file' field is required in FormData", "VALIDATION_ERROR"),
      { status: 400 }
    );
  }

  const mimeType = file.type;
  let mediaType: "image" | "video";
  try {
    mediaType = getMediaType(mimeType);
  } catch (err: unknown) {
    return NextResponse.json(errorResponse(asAppError(err).message, "VALIDATION_ERROR"), { status: 400 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  try {
    validateMediaSizeBytes(fileBuffer.length, mimeType);
  } catch (err: unknown) {
    return NextResponse.json(errorResponse(asAppError(err).message, "VALIDATION_ERROR"), { status: 413 });
  }

  let mediaUrl: string;
  try {
    mediaUrl = await uploadToStorage(fileBuffer, mimeType, `locations/${locationId}`);
  } catch (err: unknown) {
    console.error("[POST /api/locations/:id/media] storage upload failed:", err);
    return NextResponse.json(
      errorResponse("Failed to upload file to storage", "STORAGE_ERROR"),
      { status: 502 }
    );
  }

  return { mediaUrl, mediaType, caption };
}

/** Parse a JSON body with a pre-uploaded public URL. Returns ParsedMedia or a NextResponse error. */
function parseJsonPublicUrl(body: Record<string, unknown>): ParsedMedia | NextResponse {
  const mediaUrl = String(body.media_url).trim();
  if (!mediaUrl.startsWith("http")) {
    return NextResponse.json(
      errorResponse("media_url must be a valid URL", "VALIDATION_ERROR"),
      { status: 400 }
    );
  }
  const mediaType: "image" | "video" =
    body.media_type === "video" || /\.(mp4|webm|mov|avi)(\?|$)/i.test(mediaUrl)
      ? "video"
      : "image";
  return {
    mediaUrl,
    mediaType,
    thumbnailUrl: typeof body.thumbnail_url === 'string' ? body.thumbnail_url : undefined,
    caption: typeof body.caption === 'string' ? body.caption : undefined,
  };
}

/** Parse a JSON body with legacy base64-encoded media. Returns ParsedMedia or a NextResponse error. */
async function parseJsonBase64Upload(
  body: Record<string, unknown>,
  locationId: number,
): Promise<ParsedMedia | NextResponse> {
  let mediaType: "image" | "video";
  try {
    mediaType = getMediaType(String(body.mime_type));
  } catch (err: unknown) {
    return NextResponse.json(errorResponse(asAppError(err).message, "VALIDATION_ERROR"), { status: 400 });
  }

  const base64Data = String(body.media_data).replace(/^data:[^;]+;base64,/, "");
  const fileBuffer = Buffer.from(base64Data, "base64");

  try {
    validateMediaSizeBytes(fileBuffer.length, String(body.mime_type));
  } catch (err: unknown) {
    return NextResponse.json(errorResponse(asAppError(err).message, "VALIDATION_ERROR"), { status: 413 });
  }

  let mediaUrl: string;
  try {
    mediaUrl = await uploadToStorage(fileBuffer, String(body.mime_type), `locations/${locationId}`);
  } catch (err: unknown) {
    console.error("[POST /api/locations/:id/media] storage upload failed:", err);
    return NextResponse.json(
      errorResponse("Failed to upload file to storage", "STORAGE_ERROR"),
      { status: 502 }
    );
  }

  return {
    mediaUrl,
    mediaType,
    thumbnailUrl: typeof body.thumbnail_url === 'string' ? body.thumbnail_url : undefined,
    caption: typeof body.caption === 'string' ? body.caption : undefined,
  };
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
    let parsed: ParsedMedia | NextResponse;

    if (contentType.includes("multipart/form-data")) {
      parsed = await parseFormDataUpload(req, locationId);
    } else {
      const body = await req.json() as Record<string, unknown>;
      if (body.media_url) {
        parsed = parseJsonPublicUrl(body);
      } else if (body.media_data && body.mime_type) {
        parsed = await parseJsonBase64Upload(body, locationId);
      } else {
        return NextResponse.json(
          errorResponse("Provide 'file' in FormData, 'media_url' in JSON, or 'media_data'+'mime_type' in JSON", "VALIDATION_ERROR"),
          { status: 400 }
        );
      }
    }

    // If any helper returned an error response, forward it
    if (parsed instanceof NextResponse) return parsed;

    const result = await saveLocationMedia(
      auth.id,
      locationId,
      parsed.mediaUrl,
      parsed.mediaType,
      parsed.thumbnailUrl,
      parsed.caption,
    );

    return NextResponse.json(successResponse({
      media: result.media,
      xp: result.xp,
    }), { status: 201 });

  } catch (err: unknown) {
    console.error("[POST /api/locations/:id/media]", err);
    if (asAppError(err).code === "LIMIT_REACHED") {
      return NextResponse.json(errorResponse(asAppError(err).message, "LIMIT_REACHED"), { status: 429 });
    }
    if (asAppError(err).code === "VALIDATION_ERROR") {
      return NextResponse.json(errorResponse(asAppError(err).message, "VALIDATION_ERROR"), { status: 400 });
    }
    return NextResponse.json(errorResponse("Failed to upload media", "DB_ERROR"), { status: 500 });
  }
}

// PATCH /locations/:id/media — approve or reject (admin only)
export async function PATCH(req: NextRequest) {
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
  } catch (err: unknown) {
    console.error("[PATCH /api/locations/:id/media]", err);
    return NextResponse.json(errorResponse("Failed to update media", "DB_ERROR"), { status: 500 });
  }
}

// DELETE /locations/:id/media — delete own media (or admin)
export async function DELETE(req: NextRequest) {
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
  } catch (err: unknown) {
    console.error("[DELETE /api/locations/:id/media]", err);
    if (asAppError(err).code === "NOT_FOUND") {
      return NextResponse.json(errorResponse(asAppError(err).message, "NOT_FOUND"), { status: 404 });
    }
    return NextResponse.json(errorResponse("Failed to delete media", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
