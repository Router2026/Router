// DELETE /api/routes/:id/members/:userId — the owner removes a member, or a member leaves.

import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { authorizeRoute, parseId } from "@/lib/trip-collab/authorize";
import { removeMember } from "@/lib/trip-collab/collab-service";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  try {
    const { id, userId } = await params;
    const authz = await authorizeRoute(req, id, "member");
    if ("error" in authz) return authz.error;
    const memberId = parseId(userId);
    if (!memberId) return NextResponse.json(errorResponse("Invalid user id", "VALIDATION_ERROR"), { status: 400 });
    if (!authz.isOwner && memberId !== authz.userId) {
      return NextResponse.json(errorResponse("Forbidden", "FORBIDDEN"), { status: 403 });
    }
    const removed = await removeMember(authz.routeId, memberId);
    return removed
      ? NextResponse.json(successResponse({ removed: true }))
      : NextResponse.json(errorResponse("Not a member", "NOT_FOUND"), { status: 404 });
  } catch (err) {
    console.error("[DELETE /api/routes/[id]/members/[userId]]", err);
    return NextResponse.json(errorResponse("Failed to remove member", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
