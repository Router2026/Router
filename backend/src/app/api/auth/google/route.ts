import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { supabase } from "@/lib/db/supabase";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const { access_token } = await req.json();
    if (!access_token)
      return NextResponse.json(errorResponse("access_token is required", "VALIDATION_ERROR"), { status: 400 });

    // Verify the Google token with Supabase
    const { data, error } = await supabase.auth.getUser(access_token);
    if (error || !data.user)
      return NextResponse.json(errorResponse("Invalid Google token", "AUTH_ERROR"), { status: 401 });

    const user = data.user;
    const email = user.email?.toLowerCase();
    if (!email)
      return NextResponse.json(errorResponse("No email from Google", "AUTH_ERROR"), { status: 400 });

    const meta = user.user_metadata ?? {};
    const fullName = meta.full_name || meta.name || email.split('@')[0];
    const baseUsername = email.split('@')[0].replace(/\W/g, '_').slice(0, 15);

    // Upsert user in our DB
    let { rows } = await rawDb.query(
      "SELECT id, email, full_name, username, is_admin, xp_points, level, reports_count, reviews_count, trips_count FROM users WHERE email = $1",
      [email]
    );

    if (!rows.length) {
      let username = baseUsername;
      let suffix = 1;
      while (true) {
        const { rows: exists } = await rawDb.query("SELECT id FROM users WHERE username = $1", [username]);
        if (!exists.length) break;
        username = `${baseUsername}${suffix++}`;
      }
      const result = await rawDb.query(
        `INSERT INTO users (email, full_name, username, is_admin, xp_points, level, email_verified)
         VALUES ($1, $2, $3, false, 0, 'מטייל מתחיל', true)
         RETURNING id, email, full_name, username, is_admin, xp_points, level, reports_count, reviews_count, trips_count`,
        [email, fullName, username]
      );
      rows = result.rows;
    }

    return NextResponse.json(successResponse({ user: rows[0], token: access_token }));
  } catch (err) {
    console.error("[POST /api/auth/google]", err);
    return NextResponse.json(errorResponse("Google login failed", "AUTH_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
