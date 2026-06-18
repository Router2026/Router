// src/app/api/push-tokens/route.ts
// POST: register a device push token for the authenticated user.

import { NextRequest, NextResponse } from "next/server";
import { upsertPushToken } from "@/lib/notifications/push-service";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { rawDb } from "@/lib/db/raw-client";
import { supabase } from "@/lib/db/supabase";

export async function POST(req: NextRequest) {
  try {
    // Resolve user from either Supabase or legacy JWT
    let userId: number | null = null;

    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);

      const { data: { user: sbUser } } = await supabase.auth.getUser(token);
      if (sbUser?.email) {
        const { rows } = await rawDb.query(
          `SELECT id FROM users WHERE email = $1 LIMIT 1`,
          [sbUser.email]
        );
        if (rows.length) userId = rows[0].id;
      } else {
        const auth = await getUserFromRequest(req);
        if (auth?.id) userId = auth.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        errorResponse("Authentication required", "AUTH_ERROR"),
        { status: 401 }
      );
    }

    const body = await req.json();
    const { token, platform = "fcm" } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        errorResponse("token is required", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }

    await upsertPushToken(userId, token, platform as "fcm" | "apns");
    return NextResponse.json(successResponse({ registered: true }), { status: 201 });
  } catch (err) {
    console.error("[POST /api/push-tokens]", err);
    return NextResponse.json(
      errorResponse("Failed to register push token", "DB_ERROR"),
      { status: 500 }
    );
  }
}

export { OPTIONS } from "@/lib/api/cors";
