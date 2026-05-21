// src/app/api/locations/meta/route.ts  ← NEW FILE
// Returns distinct categories, difficulties, and total count for filter dropdowns.
// Replaces the expensive Array.from(new Set(allPois.map(p => p.category))) in Explore.tsx.
// Cached 1 hour server-side; also instructs CDN to cache for 10 minutes.

import { NextResponse } from "next/server";
import { getLocationMeta } from "@/lib/locations/location-service";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET() {
    try {
        const meta = await getLocationMeta();
        return NextResponse.json(successResponse(meta), {
            headers: {
                "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
            },
        });
    } catch (err) {
        console.error("[GET /api/locations/meta]", err);
        return NextResponse.json(
            errorResponse("Failed to fetch location meta", "DB_ERROR"),
            { status: 500 }
        );
    }
}

export { OPTIONS } from "@/lib/api/cors";