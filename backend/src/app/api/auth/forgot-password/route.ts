import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";
import { successResponse, errorResponse } from "@/lib/api/response";
import { checkRateLimit, clientIp } from "@/lib/auth/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // 3 reset requests per email per hour — prevents email flooding
    const ip = clientIp(req);
    if (!await checkRateLimit(`forgot:${ip}`, 3, 60 * 60 * 1000)) {
      // Always return success shape to avoid leaking rate-limit info to an attacker
      return NextResponse.json(successResponse({ sent: true }));
    }

    const { email } = await req.json();
    if (!email)
      return NextResponse.json(errorResponse("Email required", "VALIDATION_ERROR"), { status: 400 });

    // Fire-and-forget: always returns `sent: true` regardless of whether the email
    // exists — this prevents account enumeration via the response.
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${process.env.FRONTEND_URL}/ResetPassword`,
    });

    return NextResponse.json(successResponse({ sent: true }));
  } catch (err) {
    console.error("[POST /api/auth/forgot-password]", err);
    return NextResponse.json(errorResponse("Failed to send reset email", "SERVER_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
