import { NextResponse } from "next/server";
import { getAllRegions } from "@/lib/regions/region-service";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET() {
  try {
    const data = await getAllRegions();
    return NextResponse.json(successResponse(data));
  } catch (err) {
    console.error("[GET /api/regions]", err);
    return NextResponse.json(errorResponse("Failed to fetch regions", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
