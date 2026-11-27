// Who may touch a route's shared planning: members (owner + joined), or the owner only.

import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { errorResponse } from "@/lib/api/response";
import { getAccess } from "./collab-service";

export type Authorized = { routeId: number; userId: number; isOwner: boolean };

const fail = (message: string, code: string, status: number) =>
  ({ error: NextResponse.json(errorResponse(message, code), { status }) });

export const parseId = (raw: string): number | null => {
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 && String(n) === raw ? n : null;
};

export async function authorizeRoute(
  req: Request,
  rawId: string,
  need: "member" | "owner",
): Promise<Authorized | { error: NextResponse }> {
  const auth = await getUserFromRequest(req);
  if (!auth) return fail("Unauthorized", "AUTH_ERROR", 401);
  const routeId = parseId(rawId);
  if (!routeId) return fail("Invalid route id", "VALIDATION_ERROR", 400);
  const access = await getAccess(routeId, auth.id);
  if (!access.exists) return fail("Route not found", "NOT_FOUND", 404);
  const allowed = need === "owner" ? access.isOwner : access.isMember;
  if (!allowed) return fail("Forbidden", "FORBIDDEN", 403);
  return { routeId, userId: auth.id, isOwner: access.isOwner };
}
