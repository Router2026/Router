import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { signJWT } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json(errorResponse("Token required", "VALIDATION_ERROR"), { status: 400 });
  }

  const { rows } = await rawDb.query(
    `SELECT id, email, full_name, username, is_admin, xp_points, level, email_verified, email_verification_expires
     FROM users WHERE email_verification_token = $1`,
    [token]
  );
  const user = rows[0];

  if (!user) {
    return NextResponse.json(errorResponse("Invalid or expired verification link", "INVALID_TOKEN"), { status: 400 });
  }
  if (user.email_verified) {
    // Already verified — just log them in
    const jwt = await signJWT({ id: user.id, email: user.email, is_admin: user.is_admin });
    const { email_verification_expires: _, ...safeUser } = user;
    return NextResponse.json(successResponse({ user: safeUser, token: jwt, alreadyVerified: true }));
  }
  if (new Date(user.email_verification_expires) < new Date()) {
    return NextResponse.json(errorResponse("Verification link has expired. Please request a new one.", "TOKEN_EXPIRED"), { status: 400 });
  }

  await rawDb.query(
    `UPDATE users SET email_verified = true, email_verification_token = NULL, email_verification_expires = NULL WHERE id = $1`,
    [user.id]
  );

  const jwt = await signJWT({ id: user.id, email: user.email, is_admin: user.is_admin });
  return NextResponse.json(successResponse({ user: { ...user, email_verified: true }, token: jwt }));
}
