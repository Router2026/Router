import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { rawDb } from "@/lib/db/raw-client";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json(errorResponse("Unauthorized","AUTH_ERROR"),{status:401});
  const { rows } = await rawDb.query(
    `SELECT cr.id, cr.location_id, cr.poi_name, cr.report_type,
            cr.severity, cr.content, cr.reporter_name, cr.upvotes, cr.created_at,
            l.name AS location_name
     FROM community_reports cr LEFT JOIN locations l ON l.id=cr.location_id
     WHERE cr.user_id=$1 ORDER BY cr.created_at DESC LIMIT 50`,
    [auth.id]
  );
  return NextResponse.json(successResponse(rows));
}
