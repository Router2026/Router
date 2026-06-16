// src/app/api/users/me/reports/route.ts
// OPTIMIZATION: Added short-lived in-memory cache (30s TTL) + HTTP Cache-Control.
// Profile page only shows the 3 most recent; fetching 50 then slicing in the
// client wastes bandwidth. Capped at 10 server-side.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { rawDb } from "@/lib/db/raw-client";
import { successResponse, errorResponse } from "@/lib/api/response";
import { cacheGet, cacheSet } from "@/lib/cache/mem-cache";

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

  const cacheKey = `user-reports:${auth.id}`;
  const cached = cacheGet<unknown[]>(cacheKey);
  if (cached) {
    return NextResponse.json(successResponse(cached), {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  }

  const { rows } = await rawDb.query(
    `SELECT cr.id, cr.location_id, cr.poi_name, cr.report_type,
            cr.severity, cr.content, cr.reporter_name, cr.upvotes, cr.created_at,
            l.name AS location_name
     FROM community_reports cr LEFT JOIN locations l ON l.id=cr.location_id
     WHERE cr.user_id=$1 ORDER BY cr.created_at DESC LIMIT 10`,
    [auth.id]
  );

  cacheSet(cacheKey, rows, 30);

  return NextResponse.json(successResponse(rows), {
    headers: { "Cache-Control": "private, max-age=30" },
  });
}

export { OPTIONS } from "@/lib/api/cors";
