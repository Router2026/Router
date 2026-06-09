// src/app/api/trips/public/[id]/comments/route.ts
// GET    /trips/public/:id/comments — list comments
// POST   /trips/public/:id/comments — add comment (authenticated)
// DELETE /trips/public/:id/comments?commentId=X — delete comment

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { addRouteComment, getRouteComments, deleteRouteComment } from "@/lib/public-trips/route-social-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const routeId = Number.parseInt(id, 10);
    if (Number.isNaN(routeId)) return NextResponse.json(errorResponse("Invalid id", "VALIDATION_ERROR"), { status: 400 });

    const comments = await getRouteComments(routeId);
    return NextResponse.json(successResponse(comments));
  } catch (err) {
    console.error("[GET /trips/public/:id/comments]", err);
    return NextResponse.json(errorResponse("Failed", "DB_ERROR"), { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    const { id } = await params;
    const routeId = Number.parseInt(id, 10);
    if (Number.isNaN(routeId)) return NextResponse.json(errorResponse("Invalid id", "VALIDATION_ERROR"), { status: 400 });

    const body = await req.json();
    if (!body.content?.trim()) {
      return NextResponse.json(errorResponse("Content is required", "VALIDATION_ERROR"), { status: 400 });
    }

    const comment = await addRouteComment(routeId, auth.id, body.content);
    return NextResponse.json(successResponse(comment), { status: 201 });
  } catch (err) {
    console.error("[POST /trips/public/:id/comments]", err);
    return NextResponse.json(errorResponse("Failed", "DB_ERROR"), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    const { id } = await params;
    const routeId = Number.parseInt(id, 10);
    if (Number.isNaN(routeId)) return NextResponse.json(errorResponse("Invalid id", "VALIDATION_ERROR"), { status: 400 });

    const url = new URL(req.url);
    const commentId = Number.parseInt(url.searchParams.get("commentId") ?? "", 10);
    if (Number.isNaN(commentId)) return NextResponse.json(errorResponse("commentId required", "VALIDATION_ERROR"), { status: 400 });

    await deleteRouteComment(commentId, auth.id, (auth as any).is_admin ?? false);
    return NextResponse.json(successResponse({ deleted: true }));
  } catch (err: any) {
    if (err?.code === "NOT_FOUND") return NextResponse.json(errorResponse("Not found", "NOT_FOUND"), { status: 404 });
    console.error("[DELETE /trips/public/:id/comments]", err);
    return NextResponse.json(errorResponse("Failed", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
