import { NextRequest, NextResponse } from "next/server";
import { getLocationsInBounds } from "@/lib/locations/location-service";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const north = parseFloat(sp.get("north") || "");
    const south = parseFloat(sp.get("south") || "");
    const east  = parseFloat(sp.get("east")  || "");
    const west  = parseFloat(sp.get("west")  || "");

    if ([north, south, east, west].some(isNaN)) {
      return NextResponse.json(
        errorResponse("north, south, east, west query params are required", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }

    const data = await getLocationsInBounds({ north, south, east, west });
    return NextResponse.json(successResponse(data));
  } catch (err) {
    console.error("[GET /api/locations/map]", err);
    return NextResponse.json(errorResponse("Failed to fetch map locations", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
