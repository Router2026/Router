import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });
    }

    const { rows } = await rawDb.query(
      "SELECT id, email, full_name, username, is_admin, xp_points, level, reports_count, reviews_count, trips_count FROM users WHERE id = $1",
      [auth.id]
    );
    if (!rows.length) {
      return NextResponse.json(errorResponse("User not found", "NOT_FOUND"), { status: 404 });
    }

    return NextResponse.json(successResponse(rows[0]));
  } catch (err) {
    console.error("[GET /api/auth/me]", err);
    return NextResponse.json(errorResponse("Failed to fetch user", "AUTH_ERROR"), { status: 500 });
  }
}

// POST also works (AuthContext calls me() which uses the token in header)
export { GET as POST };
