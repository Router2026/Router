import { NextRequest, NextResponse } from "next/server";
import { getRegionBySlug } from "@/lib/regions/region-service";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const region = await getRegionBySlug(slug);
    if (!region) {
      return NextResponse.json(errorResponse("Region not found", "NOT_FOUND"), {
        status: 404,
      });
    }
    return NextResponse.json(successResponse(region));
  } catch (err) {
    console.error("[GET /api/regions/[slug]]", err);
    return NextResponse.json(
      errorResponse("Failed to fetch region", "DB_ERROR"),
      { status: 500 },
    );
  }
}
