import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { successResponse, errorResponse } from "@/lib/api/response";
import { sendPasswordResetEmail } from "@/lib/email/mailer";

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
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    // Always return success to avoid email enumeration
    if (!rows[0]) {
      return NextResponse.json(successResponse({ sent: true }));
    }

    const token = generateToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await rawDb.query(
      "UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3",
      [token, expires, rows[0].id]
    );

    await sendPasswordResetEmail(normalizedEmail, token);

    return NextResponse.json(successResponse({ sent: true }));
  } catch (err) {
    console.error("[POST /api/auth/forgot-password]", err);
    return NextResponse.json(errorResponse("Failed to send reset email", "SERVER_ERROR"), { status: 500 });
  }
}
