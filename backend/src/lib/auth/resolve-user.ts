/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { supabase } from "@/lib/db/supabase";
import { getUserFromRequest } from "@/lib/auth/tokens";

export interface AuthUser { id: number; username: string; }

export async function resolvePoiAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  const { data: { user: sbUser } } = await supabase.auth.getUser(token);
  if (sbUser?.email) {
    const { rows } = await rawDb.query<{ id: number; username: string }>(
      `SELECT id, username FROM users WHERE email = $1 LIMIT 1`,
      [sbUser.email]
    );
    return rows.length ? { id: rows[0].id, username: rows[0].username } : null;
  }

  const auth = await getUserFromRequest(req);
  return auth?.id ? { id: auth.id, username: (auth as any).username ?? "" } : null;
}

export async function resolveContributorUser(
  req: NextRequest,
  fallback: string,
): Promise<{ userId: number | null; name: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { userId: null, name: fallback };

  const token = authHeader.slice(7);
  const { data: { user: sbUser } } = await supabase.auth.getUser(token);

  if (sbUser?.email) {
    const { rows } = await rawDb.query<{ id: number; username: string; full_name: string }>(
      `SELECT id, username, full_name FROM users WHERE email = $1 LIMIT 1`,
      [sbUser.email]
    );
    if (rows.length) {
      return {
        userId: rows[0].id,
        name: rows[0].full_name || rows[0].username || fallback,
      };
    }
    return { userId: null, name: fallback };
  }

  const auth = await getUserFromRequest(req);
  if (auth?.id) {
    const { rows } = await rawDb.query<{ id: number; username: string; full_name: string }>(
      `SELECT id, username, full_name FROM users WHERE id = $1 LIMIT 1`,
      [auth.id]
    );
    if (rows.length) {
      return {
        userId: rows[0].id,
        name: rows[0].full_name || rows[0].username || fallback,
      };
    }
  }
  return { userId: null, name: fallback };
}
