// src/app/api/users/me/favorites/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getUserFavorites } from "@/lib/favorites/favorites-service";

// GET /users/me/favorites — list authenticated user's favorites
export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    const favorites = await getUserFavorites(auth.id);
    return NextResponse.json(successResponse(favorites));
  } catch (err) {
    console.error("[GET /api/users/me/favorites]", err);
    return NextResponse.json(errorResponse("Failed to fetch favorites", "DB_ERROR"), { status: 500 });
  }
}
