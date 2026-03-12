import { NextRequest, NextResponse } from "next/server";
import { makeAdminCookieHeader, clearAdminCookieHeader } from "@/lib/admin/auth";

export async function POST(req: NextRequest) {
  const { secret } = await req.json().catch(() => ({}));
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || secret !== adminSecret) {
    return NextResponse.json(
      { data: null, error: { message: "Invalid credentials", code: "UNAUTHORIZED" } },
      { status: 401 }
    );
  }

  return NextResponse.json(
    { data: { ok: true }, error: null },
    { headers: { "Set-Cookie": await makeAdminCookieHeader(adminSecret) } }
  );
}

export async function DELETE(_req: NextRequest) {
  return NextResponse.json(
    { data: { ok: true }, error: null },
    { headers: { "Set-Cookie": clearAdminCookieHeader() } }
  );
}
