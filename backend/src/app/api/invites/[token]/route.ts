// GET  /api/invites/:token — what the link is for (trip name, owner, stops). No sign-in needed,
//                             so the invite page can show it before asking to log in.
// POST /api/invites/:token — signed in: join the trip. Returns its route id.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { acceptInvite, previewInvite } from "@/lib/trip-collab/collab-service";

type Ctx = { params: Promise<{ token: string }> };
const gone = () => NextResponse.json(errorResponse("This invite link is no longer valid", "INVITE_INVALID"), { status: 404 });

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const preview = await previewInvite((await params).token);
    return preview ? NextResponse.json(successResponse(preview)) : gone();
  } catch (err) {
    console.error("[GET /api/invites/[token]]", err);
    return NextResponse.json(errorResponse("Failed to load invite", "DB_ERROR"), { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });
    const routeId = await acceptInvite((await params).token, auth.id);
    return routeId ? NextResponse.json(successResponse({ route_id: routeId })) : gone();
  } catch (err) {
    console.error("[POST /api/invites/[token]]", err);
    return NextResponse.json(errorResponse("Failed to join trip", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
