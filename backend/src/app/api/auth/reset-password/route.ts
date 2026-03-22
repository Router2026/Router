import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const { access_token, password } = await req.json();
    if (!access_token || !password)
      return NextResponse.json(errorResponse("Token and password required", "VALIDATION_ERROR"), { status: 400 });
    if (password.length < 6)
      return NextResponse.json(errorResponse("Password must be at least 6 characters", "VALIDATION_ERROR"), { status: 400 });

    // Use access_token as auth header to update the user's password
    const userClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!,
      { global: { headers: { Authorization: `Bearer ${access_token}` } } }
    );
    const { error } = await userClient.auth.updateUser({ password });
    if (error)
      return NextResponse.json(errorResponse("Invalid or expired reset link", "INVALID_TOKEN"), { status: 400 });

    return NextResponse.json(successResponse({ message: "Password reset successfully" }));
  } catch (err) {
    console.error("[POST /api/auth/reset-password]", err);
    return NextResponse.json(errorResponse("Failed to reset password", "SERVER_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
