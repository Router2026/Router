import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { supabase } from "@/lib/db/supabase";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer "))
      return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    const token = authHeader.slice(7);

    // Try Supabase token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user?.email) {
      const { rows } = await rawDb.query(
        "SELECT id, email, full_name, username, is_admin, xp_points, level, reports_count, reviews_count, trips_count FROM users WHERE email = $1",
        [user.email]
      );
      if (!rows.length) return NextResponse.json(errorResponse("User not found", "NOT_FOUND"), { status: 404 });
      return NextResponse.json(successResponse(rows[0]));
    }

    // Fallback: legacy JWT
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });
    const { rows } = await rawDb.query(
      "SELECT id, email, full_name, username, is_admin, xp_points, level, reports_count, reviews_count, trips_count FROM users WHERE id = $1",
      [auth.id]
    );
    if (!rows.length) return NextResponse.json(errorResponse("User not found", "NOT_FOUND"), { status: 404 });
    return NextResponse.json(successResponse(rows[0]));
  } catch (err) {
    console.error("[GET /api/auth/me]", err);
    return NextResponse.json(errorResponse("Failed to fetch user", "AUTH_ERROR"), { status: 500 });
  }
}

export { GET as POST };

export { OPTIONS } from "@/lib/api/cors";
