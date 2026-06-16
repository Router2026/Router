/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/users/me/route.ts
// GET  /users/me  — full profile (replaces old /auth/me for profile data)
// PATCH /users/me — update profile fields
//
// OPTIMIZATION: Added in-memory cache (60s TTL) to avoid repeated DB hits on
// every Profile page mount. The cache is keyed by user ID and invalidated on
// PATCH so updates are always reflected immediately.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getProfile, updateProfile } from "@/lib/users/profile-service";
import { rawDb } from "@/lib/db/raw-client";
import { supabaseAdmin } from "@/lib/db/supabase";
import { cacheGet, cacheSet } from "@/lib/cache/mem-cache";

const PROFILE_CACHE_TTL = 60; // seconds

export async function GET(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    // ── Cache hit? ─────────────────────────────────────────────────────────
    const cacheKey = `profile:${auth.id}`;
    const cached = cacheGet<ReturnType<typeof getProfile> extends Promise<infer T> ? T : never>(cacheKey);
    if (cached) {
      return NextResponse.json(successResponse(cached), {
        headers: { "Cache-Control": "private, max-age=30" },
      });
    }

    const profile = await getProfile(auth.id);
    if (!profile) return NextResponse.json(errorResponse("User not found", "NOT_FOUND"), { status: 404 });

    cacheSet(cacheKey, profile, PROFILE_CACHE_TTL);

    return NextResponse.json(successResponse(profile), {
      headers: { "Cache-Control": "private, max-age=30" },
    });
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

    // Invalidate cached profile so next GET returns fresh data
    cacheSet(`profile:${auth.id}`, updated, PROFILE_CACHE_TTL);

    return NextResponse.json(successResponse(updated));
  } catch (err: any) {
    console.error("[PATCH /api/users/me]", err);
    if (err?.code === "USERNAME_TAKEN") {
      return NextResponse.json(errorResponse(err.message, "USERNAME_TAKEN"), { status: 409 });
    }
    return NextResponse.json(errorResponse("Failed to update profile", "DB_ERROR"), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    const { rows } = await rawDb.query("SELECT email FROM users WHERE id = $1", [auth.id]);
    if (!rows.length) return NextResponse.json(errorResponse("User not found", "NOT_FOUND"), { status: 404 });
    const email = rows[0].email as string;

    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = authUsers?.users?.find((u: { email?: string }) => u.email === email);
    if (authUser) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);
    }

    await rawDb.query("DELETE FROM users WHERE id = $1", [auth.id]);
    return NextResponse.json(successResponse({ deleted: true }));
  } catch (err) {
    console.error("[DELETE /api/users/me]", err);
    return NextResponse.json(errorResponse("Failed to delete account", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
