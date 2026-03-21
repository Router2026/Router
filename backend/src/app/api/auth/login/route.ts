import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { supabase } from "@/lib/db/supabase";
import { verifyPassword } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password)
      return NextResponse.json(errorResponse("Email and password are required", "VALIDATION_ERROR"), { status: 400 });

    const normalizedEmail = email.trim().toLowerCase();

    // Try Supabase Auth first
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (!error && data.session) {
      if (!data.user.email_confirmed_at)
        return NextResponse.json(errorResponse("Please verify your email before logging in", "EMAIL_NOT_VERIFIED"), { status: 403 });
      let { rows } = await rawDb.query(
        "SELECT id, email, full_name, username, is_admin, xp_points, level, reports_count, reviews_count, trips_count FROM users WHERE email = $1",
        [normalizedEmail]
      );
      // User exists in Supabase Auth but not in router.users — create profile
      if (!rows.length) {
        const meta = data.user.user_metadata ?? {};
        const result = await rawDb.query(
          `INSERT INTO users (email, full_name, username, is_admin, xp_points, level, email_verified)
           VALUES ($1, $2, $3, false, 0, 'מטייל מתחיל', true)
           RETURNING id, email, full_name, username, is_admin, xp_points, level, reports_count, reviews_count, trips_count`,
          [normalizedEmail, meta.full_name || normalizedEmail, meta.username || normalizedEmail.split('@')[0]]
        );
        rows = result.rows;
      }
      return NextResponse.json(successResponse({ user: rows[0], token: data.session.access_token }));
    }

    // Fallback: legacy password_hash check (migrate on first login)
    const { rows } = await rawDb.query(
      "SELECT id, email, full_name, username, password_hash, is_admin, xp_points, level, reports_count, reviews_count, trips_count, email_verified FROM users WHERE email = $1",
      [normalizedEmail]
    );
    const user = rows[0];
    if (!user || !user.password_hash)
      return NextResponse.json(errorResponse("Invalid email or password", "AUTH_ERROR"), { status: 401 });

    const valid = await verifyPassword(password, user.password_hash as string);
    if (!valid)
      return NextResponse.json(errorResponse("Invalid email or password", "AUTH_ERROR"), { status: 401 });

    if (!user.email_verified)
      return NextResponse.json(errorResponse("Please verify your email before logging in", "EMAIL_NOT_VERIFIED"), { status: 403 });

    // Migrate user to Supabase Auth
    const { data: signUpData } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: { full_name: user.full_name, username: user.username } },
    });

    // If signUp returns a session the email confirmation is not required (or already confirmed)
    if (signUpData?.session) {
      const { password_hash: _, email_verified: __, ...safeUser } = user;
      return NextResponse.json(successResponse({ user: safeUser, token: signUpData.session.access_token }));
    }

    // signUp created the account but needs email confirmation — try signing in again
    const { data: retried } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (retried?.session) {
      const { password_hash: _, email_verified: __, ...safeUser } = user;
      return NextResponse.json(successResponse({ user: safeUser, token: retried.session.access_token }));
    }

    return NextResponse.json(errorResponse("Invalid email or password", "AUTH_ERROR"), { status: 401 });
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    return NextResponse.json(errorResponse("Login failed", "AUTH_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
