import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { pois } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PoiRecordSchema } from "@/lib/admin/schemas";
import { successResponse, errorResponse } from "@/lib/api/response";
import { verifyAdminRequest } from "@/lib/admin/auth";

const unauth = () =>
  NextResponse.json(errorResponse("Unauthorized", "UNAUTHORIZED"), { status: 401 });

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminRequest(req))) return unauth();
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = PoiRecordSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }
    const [updated] = await db
      .update(pois)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(pois.id, id))
      .returning();
    if (!updated) {
      return NextResponse.json(errorResponse("POI not found", "NOT_FOUND"), { status: 404 });
    }
    return NextResponse.json(successResponse(updated));
  } catch (err) {
    console.error("[PUT /api/admin/pois/[id]]", err);
    return NextResponse.json(errorResponse("Failed to update POI", "SERVER_ERROR"), { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminRequest(req))) return unauth();
  try {
    const { id } = await params;
    const [deleted] = await db.delete(pois).where(eq(pois.id, id)).returning();
    if (!deleted) {
      return NextResponse.json(errorResponse("POI not found", "NOT_FOUND"), { status: 404 });
    }
    return NextResponse.json(successResponse({ ok: true }));
  } catch (err) {
    console.error("[DELETE /api/admin/pois/[id]]", err);
    return NextResponse.json(errorResponse("Failed to delete POI", "SERVER_ERROR"), { status: 500 });
  }
}
