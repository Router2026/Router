import { NextRequest, NextResponse } from "next/server";
import { getRoutes, createRoute } from "@/lib/routes/route-service";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET() {
  try {
    const data = await getRoutes();
    return NextResponse.json(successResponse(data));
  } catch (err) {
    console.error("[GET /api/routes]", err);
    return NextResponse.json(errorResponse("Failed to fetch routes", "DB_ERROR"), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await createRoute(body);
    return NextResponse.json(successResponse(data), { status: 201 });
  } catch (err) {
    console.error("[POST /api/routes]", err);
    return NextResponse.json(errorResponse("Failed to create route", "DB_ERROR"), { status: 500 });
  }
}
