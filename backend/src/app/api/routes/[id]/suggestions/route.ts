// POST /api/routes/:id/suggestions { location_id, note? } — members: suggest a stop.

import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { authorizeRoute } from "@/lib/trip-collab/authorize";
import { suggestStop } from "@/lib/trip-collab/collab-service";

const MESSAGES = {
  NOT_FOUND: ["Place not found", 404],
  ALREADY_IN_ROUTE: ["This place is already a stop", 409],
  ALREADY_SUGGESTED: ["This place was already suggested", 409],
} as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authz = await authorizeRoute(req, (await params).id, "member");
    if ("error" in authz) return authz.error;
    const body = await req.json().catch(() => ({}));
    const locationId = Number(body?.location_id);
    if (!Number.isInteger(locationId) || locationId <= 0) {
      return NextResponse.json(errorResponse("location_id is required", "VALIDATION_ERROR"), { status: 400 });
    }
    const result = await suggestStop(authz.routeId, authz.userId, locationId, body?.note);
    if (!result.ok) {
      const [message, status] = MESSAGES[result.reason];
      return NextResponse.json(errorResponse(message, result.reason), { status });
    }
    return NextResponse.json(successResponse({ id: result.id }), { status: 201 });
  } catch (err) {
    console.error("[POST /api/routes/[id]/suggestions]", err);
    return NextResponse.json(errorResponse("Failed to suggest stop", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
