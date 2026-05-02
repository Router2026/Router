// GET  /trips/public/:id/community-media — list all community media for a route
// POST /trips/public/:id/community-media — authenticated user adds image or video

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { rawDb } from "@/lib/db/raw-client";
import { awardXp, XP_REWARDS } from "@/lib/xp/xp-service";

type Params = { params: Promise<{ id: string }> };

function rowToMedia(r: Record<string, unknown>) {
  return {
    id:           r.id          as number,
    route_id:     r.route_id   as number,
    user_id:      r.user_id    as number,
    username:     r.username   as string,
    avatar_url:   (r.avatar_url as string) || null,
    media_type:   r.media_type as "image" | "video",
    url:          r.url        as string,
    caption:      (r.caption   as string) || null,
    created_at:   r.created_at as Date,
  };
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const routeId = parseInt(id, 10);
    if (isNaN(routeId)) return NextResponse.json(errorResponse("Invalid id", "VALIDATION_ERROR"), { status: 400 });

    const { rows } = await rawDb.query(
      `SELECT m.*, u.username, u.avatar_url
       FROM route_community_media m
       JOIN users u ON u.id = m.user_id
       WHERE m.route_id = $1
       ORDER BY m.created_at DESC`,
      [routeId]
    );
    return NextResponse.json(successResponse(rows.map(rowToMedia)));
  } catch (err) {
    console.error("[GET /trips/public/:id/community-media]", err);
    return NextResponse.json(errorResponse("Failed", "DB_ERROR"), { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    const { id } = await params;
    const routeId = parseInt(id, 10);
    if (isNaN(routeId)) return NextResponse.json(errorResponse("Invalid id", "VALIDATION_ERROR"), { status: 400 });

    // Verify route is public
    const { rows: routeRows } = await rawDb.query(
      `SELECT id FROM routes WHERE id = $1 AND is_public = TRUE`,
      [routeId]
    );
    if (!routeRows.length) return NextResponse.json(errorResponse("Route not found or not public", "NOT_FOUND"), { status: 404 });

    const body = await req.json();
    if (!body.url) return NextResponse.json(errorResponse("url is required", "VALIDATION_ERROR"), { status: 400 });
    const mediaType = body.media_type === "video" ? "video" : "image";

    const { rows } = await rawDb.query(
      `INSERT INTO route_community_media (route_id, user_id, media_type, url, caption)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [routeId, auth.id, mediaType, body.url, body.caption || null]
    );
    const media = rows[0];

    // Fetch username for response
    const { rows: userRows } = await rawDb.query(`SELECT username, avatar_url FROM users WHERE id = $1`, [auth.id]);
    const xp = await awardXp(auth.id, XP_REWARDS.PHOTO_UPLOAD).catch(() => undefined);

    return NextResponse.json(successResponse({ ...rowToMedia({ ...media, ...userRows[0] }), xp_awarded: xp }), { status: 201 });
  } catch (err) {
    console.error("[POST /trips/public/:id/community-media]", err);
    return NextResponse.json(errorResponse("Failed", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
