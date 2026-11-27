// POST /api/routes/:id/suggestions/:sid { action }
//   vote    — members: toggle my vote
//   accept  — owner: add the place as the route's last stop
//   dismiss — owner: drop the suggestion

import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { authorizeRoute, parseId } from "@/lib/trip-collab/authorize";
import { acceptSuggestion, dismissSuggestion, toggleVote } from "@/lib/trip-collab/collab-service";

const notOpen = () => NextResponse.json(errorResponse("Suggestion not found", "NOT_FOUND"), { status: 404 });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  try {
    const { id, sid } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (action !== "vote" && action !== "accept" && action !== "dismiss") {
      return NextResponse.json(errorResponse("action must be vote, accept or dismiss", "VALIDATION_ERROR"), { status: 400 });
    }
    const authz = await authorizeRoute(req, id, action === "vote" ? "member" : "owner");
    if ("error" in authz) return authz.error;
    const suggestionId = parseId(sid);
    if (!suggestionId) return notOpen();

    if (action === "vote") {
      const r = await toggleVote(authz.routeId, suggestionId, authz.userId);
      return r ? NextResponse.json(successResponse(r)) : notOpen();
    }
    const ok = action === "accept"
      ? await acceptSuggestion(authz.routeId, suggestionId)
      : await dismissSuggestion(authz.routeId, suggestionId);
    return ok ? NextResponse.json(successResponse({ [action === "accept" ? "accepted" : "dismissed"]: true })) : notOpen();
  } catch (err) {
    console.error("[POST /api/routes/[id]/suggestions/[sid]]", err);
    return NextResponse.json(errorResponse("Failed to update suggestion", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
