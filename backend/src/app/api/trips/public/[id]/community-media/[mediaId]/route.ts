// DELETE /trips/public/:id/community-media/:mediaId — owner of media or route owner can delete

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { rawDb } from "@/lib/db/raw-client";

type Params = { params: Promise<{ id: string; mediaId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    const { id, mediaId } = await params;
    const routeId  = parseInt(id,      10);
    const mId      = parseInt(mediaId, 10);
    if (isNaN(routeId) || isNaN(mId)) return NextResponse.json(errorResponse("Invalid id", "VALIDATION_ERROR"), { status: 400 });

    // Allow: media uploader OR route owner
    const { rows } = await rawDb.query(
      `DELETE FROM route_community_media m
       USING routes r
       WHERE m.id = $1
         AND m.route_id = $2
         AND r.id = m.route_id
         AND (m.user_id = $3 OR r.user_id = $3)
       RETURNING m.id`,
      [mId, routeId, auth.id]
    );
    if (!rows.length) return NextResponse.json(errorResponse("Not found or not authorized", "NOT_FOUND"), { status: 404 });
    return NextResponse.json(successResponse({ deleted: true }));
  } catch (err) {
    console.error("[DELETE /trips/public/:id/community-media/:mediaId]", err);
    return NextResponse.json(errorResponse("Failed", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
