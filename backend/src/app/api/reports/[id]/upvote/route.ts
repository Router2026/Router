import { NextRequest, NextResponse } from "next/server";
import { upvoteReport } from "@/lib/reports/report-service";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await upvoteReport(parseInt(id));
    if (!data) {
      return NextResponse.json(errorResponse("Report not found", "NOT_FOUND"), { status: 404 });
    }
    return NextResponse.json(successResponse(data));
  } catch (err) {
    console.error("[PATCH /api/reports/[id]/upvote]", err);
    return NextResponse.json(errorResponse("Failed to upvote report", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
