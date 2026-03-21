import { NextRequest, NextResponse } from "next/server";
import { getRouteById, deleteRoute } from "@/lib/routes/route-service";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const route = await getRouteById(parseInt(id));
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
    await deleteRoute(parseInt(id));
    return NextResponse.json(successResponse({ deleted: true }));
  } catch (err) {
    console.error("[DELETE /api/routes/[id]]", err);
    return NextResponse.json(errorResponse("Failed to delete route", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
