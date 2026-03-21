import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { getUserFavorites } from "@/lib/favorites/favorites-service";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const auth = await getUserFromRequest(req);
  if (!auth) return NextResponse.json(errorResponse("Unauthorized","AUTH_ERROR"),{status:401});
  const favorites = await getUserFavorites(auth.id);
  return NextResponse.json(successResponse(favorites));
}
