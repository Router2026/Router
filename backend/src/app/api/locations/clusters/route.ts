import { NextRequest, NextResponse } from "next/server";
import { getLocationClusters } from "@/lib/locations/location-service";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const north = parseFloat(sp.get("north") || "");
    const south = parseFloat(sp.get("south") || "");
    const east  = parseFloat(sp.get("east")  || "");
    const west  = parseFloat(sp.get("west")  || "");

    const bounds = [north, south, east, west].some(isNaN)
      ? undefined
      : { north, south, east, west };

    const data = await getLocationClusters(bounds);
    return NextResponse.json(successResponse(data));
  } catch (err) {
    console.error("[GET /api/locations/clusters]", err);
    return NextResponse.json(errorResponse("Failed to fetch clusters", "DB_ERROR"), { status: 500 });
  }
}
