// src/app/api/favorites/[locationId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { addFavorite, removeFavorite } from "@/lib/favorites/favorites-service";

// POST /favorites/:locationId — toggle add
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    const { locationId } = await params;
    const locId = parseInt(locationId, 10);
    if (isNaN(locId)) return NextResponse.json(errorResponse("Invalid locationId", "VALIDATION_ERROR"), { status: 400 });

    const fav = await addFavorite(auth.id, locId);
    return NextResponse.json(successResponse({ favorited: true, favorite: fav }), { status: 201 });
  } catch (err) {
    console.error("[POST /api/favorites/:locationId]", err);
    return NextResponse.json(errorResponse("Failed to add favorite", "DB_ERROR"), { status: 500 });
  }
}

// DELETE /favorites/:locationId — remove
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    const { locationId } = await params;
    const locId = parseInt(locationId, 10);
    if (isNaN(locId)) return NextResponse.json(errorResponse("Invalid locationId", "VALIDATION_ERROR"), { status: 400 });

    await removeFavorite(auth.id, locId);
    return NextResponse.json(successResponse({ favorited: false }));
  } catch (err) {
    console.error("[DELETE /api/favorites/:locationId]", err);
    return NextResponse.json(errorResponse("Failed to remove favorite", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
