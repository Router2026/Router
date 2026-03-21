import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { rawDb } from "@/lib/db/raw-client";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json(errorResponse("Unauthorized","AUTH_ERROR"),{status:401});
  const { rows } = await rawDb.query(
    `SELECT rv.id, rv.location_id, rv.poi_name, rv.reviewer_name,
            rv.rating, rv.content, rv.created_at, l.name AS location_name
     FROM reviews rv LEFT JOIN locations l ON l.id=rv.location_id
     WHERE rv.user_id=$1 ORDER BY rv.created_at DESC LIMIT 50`,
    [auth.id]
  );
  return NextResponse.json(successResponse(rows));
}
