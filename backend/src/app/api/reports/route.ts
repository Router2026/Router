import { NextRequest, NextResponse } from "next/server";
import { getReports, createReport } from "@/lib/reports/report-service";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const locationId = req.nextUrl.searchParams.get("location_id");
    const data = await getReports(locationId ? parseInt(locationId) : undefined);
    return NextResponse.json(successResponse(data));
  } catch (err) {
    console.error("[GET /api/reports]", err);
    return NextResponse.json(errorResponse("Failed to fetch reports", "DB_ERROR"), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await createReport(body);
    return NextResponse.json(successResponse(data), { status: 201 });
  } catch (err) {
    console.error("[POST /api/reports]", err);
    return NextResponse.json(errorResponse("Failed to create report", "DB_ERROR"), { status: 500 });
  }
}
