import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { hashPassword, signJWT } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) {
      return NextResponse.json(errorResponse("Token and password required", "VALIDATION_ERROR"), { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(errorResponse("Password must be at least 6 characters", "VALIDATION_ERROR"), { status: 400 });
    }

    const { rows } = await rawDb.query(
      `SELECT id, email, is_admin, password_reset_expires
       FROM users WHERE password_reset_token = $1`,
      [token]
    );
    const user = rows[0];

    if (!user) {
      return NextResponse.json(errorResponse("Invalid or expired reset link", "INVALID_TOKEN"), { status: 400 });
    }
    if (new Date(user.password_reset_expires) < new Date()) {
      return NextResponse.json(errorResponse("Reset link has expired. Please request a new one.", "TOKEN_EXPIRED"), { status: 400 });
    }

    const password_hash = await hashPassword(password);

    await rawDb.query(
      "UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE id = $2",
      [password_hash, user.id]
    );

    const jwt = await signJWT({ id: user.id, email: user.email, is_admin: user.is_admin });
    return NextResponse.json(successResponse({ token: jwt, message: "Password reset successfully" }));
  } catch (err) {
    console.error("[POST /api/auth/reset-password]", err);
    return NextResponse.json(errorResponse("Failed to reset password", "SERVER_ERROR"), { status: 500 });
  }
}
