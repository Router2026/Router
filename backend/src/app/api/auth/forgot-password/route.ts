import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email)
      return NextResponse.json(errorResponse("Email required", "VALIDATION_ERROR"), { status: 400 });

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
