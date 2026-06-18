import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const { refresh_token } = await req.json().catch(() => ({})) as { refresh_token?: string };
    if (!refresh_token) {
      return NextResponse.json(errorResponse("refresh_token required", "VALIDATION_ERROR"), { status: 400 });
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error || !data.session) {
      return NextResponse.json(errorResponse("Session expired, please log in again", "AUTH_ERROR"), { status: 401 });
    }

    return NextResponse.json(successResponse({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    }));
  } catch (err) {
    console.error("[POST /api/auth/refresh]", err);
    return NextResponse.json(errorResponse("Refresh failed", "AUTH_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
