import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { supabase } from "@/lib/db/supabase";
import { successResponse, errorResponse } from "@/lib/api/response";
import { checkRateLimit, clientIp } from "@/lib/auth/rate-limit";

const USERNAME_RE = /^\w{3,20}$/;
// Minimum 8 characters with at least one letter and one number/symbol
const PASSWORD_RE = /^(?=.*[a-zA-Z])(?=.*[\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

export async function POST(req: NextRequest) {
  try {
    // 5 registrations per IP per hour — prevents spam account creation
    const ip = clientIp(req);
    if (!await checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000)) {
      return NextResponse.json(
        errorResponse("Too many registration attempts. Please try again later.", "RATE_LIMITED"),
        { status: 429 }
      );
    }

    const { email, password, full_name, username } = await req.json();
    if (!email || !password || !full_name || !username)
      return NextResponse.json(errorResponse("Email, password, full name, and username are required", "VALIDATION_ERROR"), { status: 400 });
    if (!PASSWORD_RE.test(password))
      return NextResponse.json(errorResponse("Password must be at least 8 characters and include a letter plus a number or symbol", "VALIDATION_ERROR"), { status: 400 });
    if (!USERNAME_RE.test(username))
      return NextResponse.json(errorResponse("Username must be 3-20 characters: letters, numbers, underscores only", "VALIDATION_ERROR"), { status: 400 });

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    const { rows: existing } = await rawDb.query(
      "SELECT id FROM users WHERE email = $1 OR username = $2",
      [normalizedEmail, normalizedUsername]
    );
    if (existing.length > 0)
      return NextResponse.json(errorResponse("Email or username already in use", "CONFLICT"), { status: 409 });

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { full_name: full_name.trim(), username: normalizedUsername },
        emailRedirectTo: `${process.env.FRONTEND_URL}/VerifyEmail`,
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes("already registered"))
        return NextResponse.json(errorResponse("Email or username already in use", "CONFLICT"), { status: 409 });
      return NextResponse.json(errorResponse(error.message, "AUTH_ERROR"), { status: 400 });
    }

    const { rows } = await rawDb.query(
      `INSERT INTO users (email, full_name, username, is_admin, xp_points, level, email_verified)
       VALUES ($1, $2, $3, false, 0, 'מטייל מתחיל', false)
       RETURNING id, email, full_name, username, is_admin, xp_points, level, email_verified`,
      [normalizedEmail, full_name.trim(), normalizedUsername]
    );

    return NextResponse.json(successResponse({ user: rows[0], requiresVerification: true }), { status: 201 });
  } catch (err) {
    console.error("[POST /api/auth/register]", err);
    return NextResponse.json(errorResponse("Registration failed", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
