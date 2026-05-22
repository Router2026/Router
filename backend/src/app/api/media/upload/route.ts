// src/app/api/media/upload/route.ts
// POST /api/media/upload
//
// Uploads a base64-encoded file directly to Supabase Storage and returns its
// public URL. This is used by the "Contribute POI" flow so that images can be
// stored in proper object storage *before* the community_pois row is created —
// avoiding the ID-mismatch bug where ContributePOI tried to attach media to a
// /locations/:id route using a community_pois.id that had no matching locations row.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import {
    uploadToStorage,
    getMediaType,
    validateMediaSize,
} from "@/lib/location-images/location-media-service";

export async function POST(req: NextRequest) {
    try {
        const auth = await getUserFromRequest(req);
        if (!auth) {
            return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });
        }

        const body = await req.json();

        if (!body.media_data || !body.mime_type) {
            return NextResponse.json(
                errorResponse("media_data and mime_type are required", "VALIDATION_ERROR"),
                { status: 400 }
            );
        }

        try {
            getMediaType(body.mime_type); // validates type
        } catch (err: any) {
            return NextResponse.json(errorResponse(err.message, "VALIDATION_ERROR"), { status: 400 });
        }

        const base64Data: string = body.media_data.replace(/^data:[^;]+;base64,/, "");

        try {
            validateMediaSize(base64Data, body.mime_type);
        } catch (err: any) {
            return NextResponse.json(errorResponse(err.message, "VALIDATION_ERROR"), { status: 413 });
        }

        const publicUrl = await uploadToStorage(
            base64Data,
            body.mime_type,
            `pending/${auth.id}`, // scoped per user; easy to audit/clean up
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