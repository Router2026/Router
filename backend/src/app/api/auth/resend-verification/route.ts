import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email)
      return NextResponse.json(errorResponse("Email required", "VALIDATION_ERROR"), { status: 400 });

    await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${process.env.APP_URL}/auth/verify` },
    });

    return NextResponse.json(successResponse({ sent: true }));
  } catch (err) {
    console.error("[POST /api/auth/resend-verification]", err);
    return NextResponse.json(errorResponse("Failed to resend verification email", "SERVER_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
