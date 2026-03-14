import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { hashPassword } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { sendVerificationEmail } from "@/lib/email/mailer";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, full_name, username } = await req.json();
    if (!email || !password || !full_name || !username) {
      return NextResponse.json(errorResponse("Email, password, full name, and username are required", "VALIDATION_ERROR"), { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(errorResponse("Password must be at least 6 characters", "VALIDATION_ERROR"), { status: 400 });
    }
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(errorResponse("Username must be 3-20 characters: letters, numbers, underscores only", "VALIDATION_ERROR"), { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    const { rows: existing } = await rawDb.query(
      "SELECT id FROM users WHERE email = $1 OR username = $2",
      [normalizedEmail, normalizedUsername]
    );
    if (existing.length > 0) {
      return NextResponse.json(errorResponse("Email or username already in use", "CONFLICT"), { status: 409 });
    }

    const password_hash = await hashPassword(password);
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const { rows } = await rawDb.query(
      `INSERT INTO users (email, full_name, username, password_hash, is_admin, xp_points, level, email_verified, email_verification_token, email_verification_expires)
       VALUES ($1, $2, $3, $4, false, 0, 'מטייל מתחיל', false, $5, $6)
       RETURNING id, email, full_name, username, is_admin, xp_points, level, email_verified`,
      [normalizedEmail, full_name.trim(), normalizedUsername, password_hash, verificationToken, verificationExpires]
    );
    const user = rows[0];

    // Non-blocking — don't fail registration if email fails
    sendVerificationEmail(normalizedEmail, verificationToken).catch(err =>
      console.error("[register] failed to send verification email:", err)
    );

    return NextResponse.json(successResponse({ user, requiresVerification: true }), { status: 201 });
  } catch (err) {
    console.error("[POST /api/auth/register]", err);
    return NextResponse.json(errorResponse("Registration failed", "DB_ERROR"), { status: 500 });
  }
}
