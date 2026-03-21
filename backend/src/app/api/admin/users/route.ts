import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";

const unauth = () =>
  NextResponse.json(errorResponse("Unauthorized", "UNAUTHORIZED"), { status: 401 });

async function requireAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req);
  return user?.is_admin ? user : null;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauth();
  try {
    const { rows } = await rawDb.query(
      `SELECT id, email, full_name, username, is_admin, xp_points, level,
              reports_count, reviews_count, trips_count, created_at
       FROM users ORDER BY created_at DESC`
    );
    return NextResponse.json(successResponse(rows));
  } catch (err) {
    console.error("[GET /api/admin/users]", err);
    return NextResponse.json(errorResponse("Failed to fetch users", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
