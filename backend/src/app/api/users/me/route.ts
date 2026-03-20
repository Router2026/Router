// src/app/api/users/me/route.ts
// GET  /users/me  — full profile (replaces old /auth/me for profile data)
// PATCH /users/me — update profile fields

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getProfile, updateProfile } from "@/lib/users/profile-service";

export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    const profile = await getProfile(auth.id);
    if (!profile) return NextResponse.json(errorResponse("User not found", "NOT_FOUND"), { status: 404 });

    return NextResponse.json(successResponse(profile));
  } catch (err) {
    console.error("[GET /api/users/me]", err);
    return NextResponse.json(errorResponse("Failed to fetch profile", "DB_ERROR"), { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    const body = await req.json();

    // Whitelist allowed fields
    const allowed = ["username", "full_name", "bio", "avatar_url", "cover_image",
                     "favorite_regions", "instagram", "website"] as const;
    const input: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) input[key] = body[key];
    }

    if (!Object.keys(input).length) {
      return NextResponse.json(errorResponse("No updatable fields provided", "VALIDATION_ERROR"), { status: 400 });
    }

    const updated = await updateProfile(auth.id, input as any);
    return NextResponse.json(successResponse(updated));
  } catch (err: any) {
    console.error("[PATCH /api/users/me]", err);
    if (err?.code === "USERNAME_TAKEN") {
      return NextResponse.json(errorResponse(err.message, "USERNAME_TAKEN"), { status: 409 });
    }
    return NextResponse.json(errorResponse("Failed to update profile", "DB_ERROR"), { status: 500 });
  }
}
