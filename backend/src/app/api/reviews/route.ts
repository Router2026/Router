// src/app/api/reviews/route.ts
// Updated: extracts authenticated user_id and location_id from the request body.

import { NextRequest, NextResponse } from "next/server";
import { getReviews, createReview } from "@/lib/reviews/review-service";
import { successResponse, errorResponse } from "@/lib/api/response";
import { rawDb } from "@/lib/db/raw-client";
import { resolveContributorUser } from "@/lib/auth/resolve-user";

export async function GET(req: NextRequest) {
  try {
    const locationId = req.nextUrl.searchParams.get("location_id");
    const data = await getReviews(locationId ? Number.parseInt(locationId) : undefined);
    return NextResponse.json(successResponse(data));
  } catch (err) {
    console.error("[GET /api/reviews]", err);
    return NextResponse.json(
      errorResponse("Failed to fetch reviews", "DB_ERROR"),
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { userId: resolvedUserId, name: resolvedReviewerName } = await resolveContributorUser(
      req,
      body.reviewer_name ?? "אנונימי"
    );

    // ── Resolve location_id from the locations table ────────────────────────
    // The client may send either a numeric location_id or only a poi_name.
    let resolvedLocationId: number | null = body.location_id
      ? Number.parseInt(body.location_id)
      : null;

    if (!resolvedLocationId && body.poi_name) {
      const { rows } = await rawDb.query(
        `SELECT id FROM locations WHERE name = $1 LIMIT 1`,
        [body.poi_name]
      );
      if (rows.length) {
        resolvedLocationId = rows[0].id as number;
      }
    }

    const data = await createReview({
      user_id:       resolvedUserId,
      location_id:   resolvedLocationId,
      poi_name:      body.poi_name     ?? null,
      reviewer_name: resolvedReviewerName,
      rating:        body.rating,
      content:       body.content,
    });

    return NextResponse.json(successResponse(data), { status: 201 });
  } catch (err) {
    console.error("[POST /api/reviews]", err);
    return NextResponse.json(
      errorResponse("Failed to create review", "DB_ERROR"),
      { status: 500 }
    );
  }
}

export { OPTIONS } from "@/lib/api/cors";
