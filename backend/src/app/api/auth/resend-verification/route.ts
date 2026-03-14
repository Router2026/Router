import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { successResponse, errorResponse } from "@/lib/api/response";
import { sendVerificationEmail } from "@/lib/email/mailer";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json(errorResponse("Email required", "VALIDATION_ERROR"), { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { rows } = await rawDb.query(
      "SELECT id, email_verified FROM users WHERE email = $1",
      [normalizedEmail]
    );
    const user = rows[0];

    // Don't reveal whether email exists — always return success
    if (!user || user.email_verified) {
      return NextResponse.json(successResponse({ sent: true }));
    }

    const token = generateToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await rawDb.query(
      "UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3",
      [token, expires, user.id]
    );

    await sendVerificationEmail(normalizedEmail, token);

    return NextResponse.json(successResponse({ sent: true }));
  } catch (err) {
    console.error("[POST /api/auth/resend-verification]", err);
    return NextResponse.json(errorResponse("Failed to resend verification email", "SERVER_ERROR"), { status: 500 });
  }
}
