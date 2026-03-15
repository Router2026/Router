import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { successResponse } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username")?.trim().toLowerCase();
  if (!username || username.length < 3) {
    return NextResponse.json(successResponse({ available: false }));
  }
  const { rows } = await rawDb.query("SELECT id FROM users WHERE username = $1", [username]);
  return NextResponse.json(successResponse({ available: rows.length === 0 }));
}
