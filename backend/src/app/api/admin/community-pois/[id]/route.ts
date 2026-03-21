// src/app/api/admin/community-pois/[id]/route.ts
// Admin: approve, reject, or edit a single community POI.

import { NextRequest, NextResponse } from "next/server";
import {
  getCommunityPoi,
  approveCommunityPoi,
  rejectCommunityPoi,
  editCommunityPoi,
} from "@/lib/community-poi/community-poi-service";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";

// Helper for unauthorized response
const unauth = () =>
  NextResponse.json(errorResponse("Unauthorized", "UNAUTHORIZED"), { status: 401 });

// Local admin check using token
async function requireAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req);
  return user?.is_admin ? user : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const poi = await getCommunityPoi(parseInt(id));

    if (!poi) {
      return NextResponse.json(
        errorResponse("Community POI not found", "NOT_FOUND"),
        { status: 404 }
      );
    }
    return NextResponse.json(successResponse(poi));
  } catch (err) {
    console.error("[GET /api/admin/community-pois/[id]]", err);
    return NextResponse.json(
      errorResponse("Failed to fetch community POI", "DB_ERROR"),
      { status: 500 }
    );
  }
}

/**
 * PATCH body:
 * { action: "approve", edits?: { name, category, description } }
 * { action: "reject",  admin_note?: string }
 * { action: "edit",    name?, category?, description?, latitude?, longitude?, photos? }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return unauth();

  try {
    const { id } = await params;
    const body = await req.json();
    const poiId = parseInt(id);
    const adminId = admin.id as number;

    if (body.action === "approve") {
      const poi = await approveCommunityPoi(poiId, adminId, body.edits);
      return NextResponse.json(successResponse(poi));
    }

    if (body.action === "reject") {
      const poi = await rejectCommunityPoi(poiId, adminId, body.admin_note);
      return NextResponse.json(successResponse(poi));
    }

    if (body.action === "edit") {
      const poi = await editCommunityPoi(poiId, {
        name: body.name,
        category: body.category,
        description: body.description,
        latitude: body.latitude,
        longitude: body.longitude,
        photos: body.photos,
      });
      return NextResponse.json(successResponse(poi));
    }

    return NextResponse.json(
      errorResponse("action must be approve | reject | edit", "VALIDATION_ERROR"),
      { status: 400 }
    );
  } catch (err) {
    console.error("[PATCH /api/admin/community-pois/[id]]", err);
    return NextResponse.json(
      errorResponse("Failed to update community POI", "DB_ERROR"),
      { status: 500 }
    );
  }
}
export { OPTIONS } from "@/lib/api/cors";
