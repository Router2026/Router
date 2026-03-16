// src/app/api/admin/community-pois/route.ts
// Admin: list all community POIs with optional status filter.

import { NextRequest, NextResponse } from "next/server";
import { listAllCommunityPois } from "@/lib/community-poi/community-poi-service";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";

// Helper for unauthorized response
const unauth = () =>
  NextResponse.json(errorResponse("Unauthorized", "UNAUTHORIZED"), {
    status: 401,
  });

// Local admin check using token
async function requireAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req);
  return user?.is_admin ? user : null;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return unauth();

  try {
    const status = req.nextUrl.searchParams.get("status") as
      | "pending"
      | "approved"
      | "rejected"
      | undefined;

    const pois = await listAllCommunityPois(status ?? undefined);
    return NextResponse.json(successResponse(pois));
  } catch (err) {
    console.error("[GET /api/admin/community-pois]", err);
    return NextResponse.json(
      errorResponse("Failed to fetch community POIs", "DB_ERROR"),
      {
        status: 500,
      },
    );
  }
}
