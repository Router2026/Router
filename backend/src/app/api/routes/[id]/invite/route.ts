// POST   /api/routes/:id/invite — owner: create an invite link (replaces the previous one)
// DELETE /api/routes/:id/invite — owner: turn the link off

import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { authorizeRoute } from "@/lib/trip-collab/authorize";
import { createInvite, revokeInvite } from "@/lib/trip-collab/collab-service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const authz = await authorizeRoute(req, (await params).id, "owner");
    if ("error" in authz) return authz.error;
    const token = await createInvite(authz.routeId, authz.userId);
    return NextResponse.json(successResponse({ token }), { status: 201 });
  } catch (err) {
    console.error("[POST /api/routes/[id]/invite]", err);
    return NextResponse.json(errorResponse("Failed to create invite", "DB_ERROR"), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const authz = await authorizeRoute(req, (await params).id, "owner");
    if ("error" in authz) return authz.error;
    await revokeInvite(authz.routeId);
    return NextResponse.json(successResponse({ revoked: true }));
  } catch (err) {
    console.error("[DELETE /api/routes/[id]/invite]", err);
    return NextResponse.json(errorResponse("Failed to revoke invite", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
