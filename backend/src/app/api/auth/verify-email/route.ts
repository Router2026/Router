import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { supabase } from "@/lib/db/supabase";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token)
    return NextResponse.json(errorResponse("Token required", "VALIDATION_ERROR"), { status: 400 });

  const { data, error } = await supabase.auth.verifyOtp({ token_hash: token, type: "email" });
  if (error || !data.user?.email)
    return NextResponse.json(errorResponse("Invalid or expired verification link", "INVALID_TOKEN"), { status: 400 });

  await rawDb.query("UPDATE users SET email_verified = true WHERE email = $1", [data.user.email]);

  const { rows } = await rawDb.query(
    "SELECT id, email, full_name, username, is_admin, xp_points, level FROM users WHERE email = $1",
    [data.user.email]
  );

  return NextResponse.json(successResponse({ user: rows[0], token: data.session?.access_token }));
}
