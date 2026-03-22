import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/supabase";
import { successResponse, errorResponse } from "@/lib/api/response";

function getUserIdFromJwt(jwt: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { access_token, password } = await req.json();
    if (!access_token || !password)
      return NextResponse.json(errorResponse("Token and password required", "VALIDATION_ERROR"), { status: 400 });
    if (password.length < 6)
      return NextResponse.json(errorResponse("Password must be at least 6 characters", "VALIDATION_ERROR"), { status: 400 });

    const userId = getUserIdFromJwt(access_token);
    if (!userId)
      return NextResponse.json(errorResponse("Invalid reset link", "INVALID_TOKEN"), { status: 400 });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    if (error)
      return NextResponse.json(errorResponse("Failed to reset password", "AUTH_ERROR"), { status: 400 });

    return NextResponse.json(successResponse({ message: "Password reset successfully" }));
  } catch (err) {
    console.error("[POST /api/auth/reset-password]", err);
    return NextResponse.json(errorResponse("Failed to reset password", "SERVER_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
