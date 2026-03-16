// src/app/api/reviews/route.ts
// Updated: extracts authenticated user_id and location_id from the request body.

import { NextRequest, NextResponse } from "next/server";
import { getReviews, createReview } from "@/lib/reviews/review-service";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { rawDb } from "@/lib/db/raw-client";
import { supabase } from "@/lib/db/supabase";

export async function GET(req: NextRequest) {
  try {
    const locationId = req.nextUrl.searchParams.get("location_id");
    const data = await getReviews(
      locationId ? parseInt(locationId) : undefined,
    );
    return NextResponse.json(successResponse(data));
  } catch (err) {
    console.error("[GET /api/reviews]", err);
    return NextResponse.json(
      errorResponse("Failed to fetch reviews", "DB_ERROR"),
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ── Resolve authenticated user ──────────────────────────────────────────
    let resolvedUserId: number | null = null;
    let resolvedReviewerName: string = body.reviewer_name ?? "אנונימי";

    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      // Try Supabase token first
      const {
        data: { user: sbUser },
      } = await supabase.auth.getUser(token);
      if (sbUser?.email) {
        const { rows } = await rawDb.query(
          `SELECT id, username, full_name FROM users WHERE email = $1 LIMIT 1`,
          [sbUser.email],
        );
        if (rows.length) {
          resolvedUserId = rows[0].id as number;
          resolvedReviewerName =
            (rows[0].full_name as string) ||
            (rows[0].username as string) ||
            resolvedReviewerName;
        }
      } else {
        // Fallback: legacy JWT
        const auth = await getUserFromRequest(req);
        if (auth?.id) {
          const { rows } = await rawDb.query(
            `SELECT id, username, full_name FROM users WHERE id = $1 LIMIT 1`,
            [auth.id],
          );
          if (rows.length) {
            resolvedUserId = rows[0].id as number;
            resolvedReviewerName =
              (rows[0].full_name as string) ||
              (rows[0].username as string) ||
              resolvedReviewerName;
          }
        }
      }
    }

    // ── Resolve location_id from the locations table ────────────────────────
    // The client may send either a numeric location_id or only a poi_name.
    let resolvedLocationId: number | null = body.location_id
      ? parseInt(body.location_id)
      : null;

    if (!resolvedLocationId && body.poi_name) {
      const { rows } = await rawDb.query(
        `SELECT id FROM locations WHERE name = $1 LIMIT 1`,
        [body.poi_name],
      );
      if (rows.length) {
        resolvedLocationId = rows[0].id as number;
      }
    }

    const data = await createReview({
      user_id: resolvedUserId,
      location_id: resolvedLocationId,
      poi_name: body.poi_name ?? null,
      reviewer_name: resolvedReviewerName,
      rating: body.rating,
      content: body.content,
    });

    return NextResponse.json(successResponse(data), { status: 201 });
  } catch (err) {
    console.error("[POST /api/reviews]", err);
    return NextResponse.json(
      errorResponse("Failed to create review", "DB_ERROR"),
      { status: 500 },
    );
  }
}
