import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase";
import { successResponse, errorResponse } from "@/lib/api/response";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: NextRequest) {
  try {
    const { access_token, password } = await req.json();
    if (!access_token || !password)
      return NextResponse.json(errorResponse("Token and password required", "VALIDATION_ERROR"), { status: 400 });
    if (password.length < MIN_PASSWORD_LENGTH)
      return NextResponse.json(errorResponse(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, "VALIDATION_ERROR"), { status: 400 });

    // Verify the Supabase reset token — getUser() validates signature + expiry server-side.
    // Never decode the JWT manually here; that skips signature verification entirely.
    const { data: { user }, error: verifyError } = await supabaseAdmin.auth.getUser(access_token);
    if (verifyError || !user)
      return NextResponse.json(errorResponse("Invalid or expired reset link", "INVALID_TOKEN"), { status: 400 });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password });
    if (error)
      return NextResponse.json(errorResponse("Failed to reset password", "AUTH_ERROR"), { status: 400 });

    return NextResponse.json(successResponse({ message: "Password reset successfully" }));
  } catch (err) {
    console.error("[POST /api/auth/reset-password]", err);
    return NextResponse.json(errorResponse("Failed to reset password", "SERVER_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
