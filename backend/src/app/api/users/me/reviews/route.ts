// src/app/api/users/me/reviews/route.ts
// OPTIMIZATION: Added short-lived in-memory cache (30s TTL) + HTTP Cache-Control.
// Capped at 10 rows server-side (Profile page only needs 3).

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { rawDb } from "@/lib/db/raw-client";
import { successResponse, errorResponse } from "@/lib/api/response";
import { cacheGet, cacheSet } from "@/lib/cache/mem-cache";

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

  const cacheKey = `user-reviews:${auth.id}`;
  const cached = cacheGet<unknown[]>(cacheKey);
  if (cached) {
    return NextResponse.json(successResponse(cached), {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  }

  const { rows } = await rawDb.query(
    `SELECT rv.id, rv.location_id, rv.poi_name, rv.reviewer_name,
            rv.rating, rv.content, rv.created_at, l.name AS location_name
     FROM reviews rv LEFT JOIN locations l ON l.id=rv.location_id
     WHERE rv.user_id=$1 ORDER BY rv.created_at DESC LIMIT 10`,
    [auth.id]
  );

  cacheSet(cacheKey, rows, 30);

  return NextResponse.json(successResponse(rows), {
    headers: { "Cache-Control": "private, max-age=30" },
  });
}

export { OPTIONS } from "@/lib/api/cors";
