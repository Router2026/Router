import { NextResponse } from "next/server";
import { getStats } from "@/lib/users/user-service";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET() {
  try {
    const data = await getStats();
    return NextResponse.json(successResponse(data));
  } catch (err) {
    console.error("[GET /api/users/stats]", err);
    return NextResponse.json(
      errorResponse("Failed to fetch stats", "DB_ERROR"),
      { status: 500 },
    );
  }
}
