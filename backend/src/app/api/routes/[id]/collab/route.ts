// GET /api/routes/:id/collab — members: who is planning this trip and the open suggestions.

import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { authorizeRoute } from "@/lib/trip-collab/authorize";
import { getCollabState } from "@/lib/trip-collab/collab-service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authz = await authorizeRoute(req, (await params).id, "member");
    if ("error" in authz) return authz.error;
    return NextResponse.json(successResponse(await getCollabState(authz.routeId, authz.userId, authz.isOwner)));
  } catch (err) {
    console.error("[GET /api/routes/[id]/collab]", err);
    return NextResponse.json(errorResponse("Failed to load shared planning", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
