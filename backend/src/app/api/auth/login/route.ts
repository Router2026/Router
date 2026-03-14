import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { verifyPassword, signJWT } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json(errorResponse("Email and password are required", "VALIDATION_ERROR"), { status: 400 });
    }

    const { rows } = await rawDb.query(
      "SELECT id, email, full_name, username, password_hash, is_admin, xp_points, level, reports_count, reviews_count, trips_count, email_verified FROM users WHERE email = $1",
      [email.trim().toLowerCase()]
    );
    const user = rows[0];
    if (!user || !user.password_hash) {
      return NextResponse.json(errorResponse("Invalid email or password", "AUTH_ERROR"), { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json(errorResponse("Invalid email or password", "AUTH_ERROR"), { status: 401 });
    }

    if (!user.email_verified) {
      return NextResponse.json(errorResponse("Please verify your email before logging in", "EMAIL_NOT_VERIFIED"), { status: 403 });
    }

    const token = await signJWT({ id: user.id, email: user.email, is_admin: user.is_admin });
    const { password_hash: _, ...safeUser } = user;

    return NextResponse.json(successResponse({ user: safeUser, token }));
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    return NextResponse.json(errorResponse("Login failed", "AUTH_ERROR"), { status: 500 });
  }
}
