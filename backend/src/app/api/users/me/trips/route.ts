import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { rawDb } from "@/lib/db/raw-client";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json(errorResponse("Unauthorized","AUTH_ERROR"),{status:401});
  const { rows } = await rawDb.query(
    `SELECT pt.id, pt.title, pt.description, pt.is_public, pt.created_at,
            COUNT(tl.id)::int AS location_count
     FROM public_trips pt LEFT JOIN trip_locations tl ON tl.trip_id=pt.id
     WHERE pt.user_id=$1 GROUP BY pt.id ORDER BY pt.created_at DESC`,
    [auth.id]
  );
  return NextResponse.json(successResponse(rows));
}
