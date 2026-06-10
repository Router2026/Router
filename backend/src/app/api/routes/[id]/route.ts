import { NextRequest, NextResponse } from "next/server";
import { getRouteById, deleteRoute, updateRoute } from "@/lib/routes/route-service";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const route = await getRouteById(Number.parseInt(id));
    if (!route) {
      return NextResponse.json(errorResponse("Route not found", "NOT_FOUND"), { status: 404 });
    }
    return NextResponse.json(successResponse(route));
  } catch (err) {
    console.error("[GET /api/routes/[id]]", err);
    return NextResponse.json(errorResponse("Failed to fetch route", "DB_ERROR"), { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteRoute(Number.parseInt(id));
    return NextResponse.json(successResponse({ deleted: true }));
  } catch (err) {
    console.error("[DELETE /api/routes/[id]]", err);
    return NextResponse.json(errorResponse("Failed to delete route", "DB_ERROR"), { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) {
      return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });
    }

    const { id } = await params;
    const routeId = Number.parseInt(id, 10);
    if (Number.isNaN(routeId)) {
      return NextResponse.json(errorResponse("Invalid route id", "VALIDATION_ERROR"), { status: 400 });
    }

    // Verify the route belongs to this user (or user is admin)
    const existing = await getRouteById(routeId);
    if (!existing) {
      return NextResponse.json(errorResponse("Route not found", "NOT_FOUND"), { status: 404 });
    }
    if (!auth.is_admin && existing.user_id !== auth.id) {
      return NextResponse.json(errorResponse("Forbidden", "FORBIDDEN"), { status: 403 });
    }

    const body = await req.json();
    const updated = await updateRoute(routeId, body);
    return NextResponse.json(successResponse(updated));
  } catch (err) {
    console.error("[PATCH /api/routes/[id]]", err);
    return NextResponse.json(errorResponse("Failed to update route", "DB_ERROR"), { status: 500 });
  }
}


export { OPTIONS } from "@/lib/api/cors";
