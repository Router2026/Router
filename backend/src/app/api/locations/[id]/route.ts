import { NextRequest, NextResponse } from "next/server";
import { getLocationById } from "@/lib/locations/location-service";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const location = await getLocationById(parseInt(id));
    if (!location) {
      return NextResponse.json(errorResponse("Location not found", "NOT_FOUND"), { status: 404 });
    }
    return NextResponse.json(successResponse(location));
  } catch (err) {
    console.error("[GET /api/locations/[id]]", err);
    return NextResponse.json(errorResponse("Failed to fetch location", "DB_ERROR"), { status: 500 });
  }
}
