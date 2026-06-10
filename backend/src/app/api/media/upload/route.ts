// src/app/api/media/upload/route.ts
// POST /api/media/upload
//
// Uploads a file to Supabase Storage and returns its public URL.
// Used by ContributePOI before a community_pois row exists.
//
// FIX: Accepts multipart/form-data (FormData) instead of base64 JSON.
// base64 JSON was causing "Failed to fetch" for images over ~3 MB because:
//   1. base64 inflates file size by ~33% (3 MB file = 4 MB JSON body)
//   2. Next.js App Router has a 4 MB default JSON body limit
//   3. maxRequestBodySize is NOT a real Next.js export — it is silently ignored
// FormData streams raw binary bytes, has no practical size limit, and is the
// correct transport for file uploads in HTTP.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import {
    uploadToStorage,
    getMediaType,
    validateMediaSizeBytes,
} from "@/lib/location-images/location-media-service";

export async function POST(req: NextRequest) {
    try {
        const auth = await getUserFromRequest(req);
        if (!auth) {
            return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });
        }

        const contentType = req.headers.get("content-type") ?? "";

        let fileBuffer: Buffer;
        let mimeType: string;

        if (contentType.includes("multipart/form-data")) {
            // ── FormData path (new default) ───────────────────────────────
            const form = await req.formData();
            const file = form.get("file");

            if (!file || typeof file === "string") {
                return NextResponse.json(
                    errorResponse("'file' field is required in FormData", "VALIDATION_ERROR"),
                    { status: 400 }
                );
            }

            mimeType = file.type;
            const arrayBuffer = await file.arrayBuffer();
            fileBuffer = Buffer.from(arrayBuffer);

        } else {
            // ── Legacy base64 JSON path (kept for backward compatibility) ─
            const body = await req.json();

            if (!body.media_data || !body.mime_type) {
                return NextResponse.json(
                    errorResponse("'file' in FormData or 'media_data'+'mime_type' in JSON required", "VALIDATION_ERROR"),
                    { status: 400 }
                );
            }

            mimeType = body.mime_type;
            const base64Data: string = body.media_data.replace(/^data:[^;]+;base64,/, "");
            fileBuffer = Buffer.from(base64Data, "base64");
        }

        // Validate MIME type
        try {
            getMediaType(mimeType);
        } catch (err: any) {
            return NextResponse.json(errorResponse(err.message, "VALIDATION_ERROR"), { status: 400 });
        }

        // Validate file size against raw bytes (accurate — no base64 estimation error)
        try {
            validateMediaSizeBytes(fileBuffer.length, mimeType);
        } catch (err: any) {
            return NextResponse.json(errorResponse(err.message, "VALIDATION_ERROR"), { status: 413 });
        }

        const publicUrl = await uploadToStorage(
            fileBuffer,
            mimeType,
            `pending/${auth.id}`,
        );

        return NextResponse.json(successResponse({ url: publicUrl }), { status: 201 });

    } catch (err: any) {
        console.error("[POST /api/media/upload]", err);
        if (err?.code === "STORAGE_ERROR") {
            return NextResponse.json(errorResponse(err.message, "STORAGE_ERROR"), { status: 502 });
        }
        return NextResponse.json(errorResponse("Upload failed", "UPLOAD_ERROR"), { status: 500 });
    }
}

export { OPTIONS } from "@/lib/api/cors";
