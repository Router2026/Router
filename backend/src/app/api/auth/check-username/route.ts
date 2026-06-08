import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { successResponse, errorResponse } from "@/lib/api/response";
import { checkRateLimit, clientIp } from "@/lib/auth/rate-limit";

export async function GET(req: NextRequest) {
  // 30 checks per IP per minute — still comfortable for normal registration flows
  const ip = clientIp(req);
  if (!checkRateLimit(`check-username:${ip}`, 30, 60 * 1000)) {
    return NextResponse.json(errorResponse("Too many requests", "RATE_LIMITED"), { status: 429 });
  }

  const username = req.nextUrl.searchParams.get("username")?.trim().toLowerCase();
  if (!username || username.length < 3) {
    return NextResponse.json(successResponse({ available: false }));
  }
  const { rows } = await rawDb.query("SELECT id FROM users WHERE username = $1", [username]);
  return NextResponse.json(successResponse({ available: rows.length === 0 }));
}

export { OPTIONS } from "@/lib/api/cors";
