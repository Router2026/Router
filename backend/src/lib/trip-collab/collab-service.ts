// Plan a trip together (migration 0015).
//
// The owner creates an invite link and sends it (WhatsApp). Whoever opens it while signed in
// joins as a member. Members suggest stops and vote on suggestions; only the owner adds a
// suggestion to the route (or dismisses it), removes members, or changes/deletes the route.
//
// Only a SHA-256 of the invite token is stored. Creating a new link replaces the old one.

import { createHash, randomBytes } from "node:crypto";
import { rawDb } from "@/lib/db/raw-client";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** 24 random bytes → 32 url-safe chars. Shape-checked before any DB lookup. */
export const newToken = () => randomBytes(24).toString("base64url");
export const isTokenShape = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{32}$/.test(t);

const DISPLAY_NAME = `COALESCE(NULLIF(u.display_name, ''), NULLIF(u.username, ''), NULLIF(u.full_name, ''), 'מטייל')`;

export interface Access { exists: boolean; isOwner: boolean; isMember: boolean }

/** Whether the user owns the route or joined it. Members includes the owner. */
export async function getAccess(routeId: number, userId: number): Promise<Access> {
  const { rows } = await rawDb.query<{ user_id: number | null; collaborator: boolean }>(
    `SELECT r.user_id,
            EXISTS (SELECT 1 FROM route_collaborators c WHERE c.route_id = r.id AND c.user_id = $2) AS collaborator
       FROM routes r WHERE r.id = $1`,
    [routeId, userId],
  );
  if (!rows.length) return { exists: false, isOwner: false, isMember: false };
  const isOwner = rows[0].user_id === userId;
  return { exists: true, isOwner, isMember: isOwner || rows[0].collaborator };
}

// ── Invites ─────────────────────────────────────────────────────────────────

export async function createInvite(routeId: number, userId: number): Promise<string> {
  const token = newToken();
  await rawDb.query(
    `INSERT INTO route_invites (route_id, token_hash, created_by) VALUES ($1, $2, $3)
     ON CONFLICT (route_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, created_by = EXCLUDED.created_by, created_at = now()`,
    [routeId, hashToken(token), userId],
  );
  return token;
}

export async function revokeInvite(routeId: number): Promise<void> {
  await rawDb.query(`DELETE FROM route_invites WHERE route_id = $1`, [routeId]);
}

export interface InvitePreview { route_id: number; name: string; region: string | null; stops: number; owner_name: string }

export async function previewInvite(token: string): Promise<InvitePreview | null> {
  if (!isTokenShape(token)) return null;
  const { rows } = await rawDb.query<InvitePreview>(
    `SELECT r.id AS route_id, r.name, reg.name AS region,
            (SELECT count(*)::int FROM route_stops s WHERE s.route_id = r.id) AS stops,
            ${DISPLAY_NAME} AS owner_name
       FROM route_invites i
       JOIN routes r ON r.id = i.route_id
       LEFT JOIN regions reg ON reg.id = r.region_id
       LEFT JOIN users u ON u.id = r.user_id
      WHERE i.token_hash = $1`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
}

/** Joins the route behind the link. Returns its id, or null for an unknown/replaced link. */
export async function acceptInvite(token: string, userId: number): Promise<number | null> {
  if (!isTokenShape(token)) return null;
  const { rows } = await rawDb.query<{ route_id: number; user_id: number | null }>(
    `SELECT i.route_id, r.user_id FROM route_invites i JOIN routes r ON r.id = i.route_id WHERE i.token_hash = $1`,
    [hashToken(token)],
  );
  if (!rows.length) return null;
  const { route_id, user_id } = rows[0];
  if (user_id !== userId) {
    await rawDb.query(
      `INSERT INTO route_collaborators (route_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [route_id, userId],
    );
  }
  return route_id;
}

// ── Members & suggestions ───────────────────────────────────────────────────

export interface Member { id: number; name: string; avatar_url: string | null; is_owner: boolean }
export interface Suggestion {
  id: number; location_id: number; name: string; main_image: string | null; category: string | null;
  note: string | null; suggested_by: number; suggested_by_name: string; votes: number; my_vote: boolean;
}
export interface CollabState { is_owner: boolean; has_invite: boolean; members: Member[]; suggestions: Suggestion[] }

export async function getCollabState(routeId: number, userId: number, isOwner: boolean): Promise<CollabState> {
  const [members, suggestions, invite] = await Promise.all([
    rawDb.query<Member>(
      `SELECT u.id, ${DISPLAY_NAME} AS name, u.avatar_url, true AS is_owner
         FROM routes r JOIN users u ON u.id = r.user_id WHERE r.id = $1
       UNION ALL
       SELECT u.id, ${DISPLAY_NAME} AS name, u.avatar_url, false AS is_owner
         FROM route_collaborators c JOIN users u ON u.id = c.user_id WHERE c.route_id = $1
       ORDER BY is_owner DESC, name`,
      [routeId],
    ),
    rawDb.query<Suggestion>(
      `SELECT s.id, s.location_id, l.name, l.main_image, l.category, s.note, s.suggested_by,
              ${DISPLAY_NAME} AS suggested_by_name,
              (SELECT count(*)::int FROM route_suggestion_votes v WHERE v.suggestion_id = s.id) AS votes,
              EXISTS (SELECT 1 FROM route_suggestion_votes v WHERE v.suggestion_id = s.id AND v.user_id = $2) AS my_vote
         FROM route_suggestions s
         JOIN locations l ON l.id = s.location_id
         LEFT JOIN users u ON u.id = s.suggested_by
        WHERE s.route_id = $1 AND s.status = 'open'
        ORDER BY votes DESC, s.created_at`,
      [routeId, userId],
    ),
    isOwner
      ? rawDb.query(`SELECT 1 FROM route_invites WHERE route_id = $1`, [routeId])
      : Promise.resolve({ rows: [] as unknown[] }),
  ]);
  return { is_owner: isOwner, has_invite: invite.rows.length > 0, members: members.rows, suggestions: suggestions.rows };
}

export type SuggestResult = { ok: true; id: number } | { ok: false; reason: "NOT_FOUND" | "ALREADY_IN_ROUTE" | "ALREADY_SUGGESTED" };

export async function suggestStop(routeId: number, userId: number, locationId: number, note?: string | null): Promise<SuggestResult> {
  const { rows: loc } = await rawDb.query<{ in_route: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM route_stops WHERE route_id = $1 AND location_id = $2) AS in_route
       FROM locations WHERE id = $2`,
    [routeId, locationId],
  );
  if (!loc.length) return { ok: false, reason: "NOT_FOUND" };
  if (loc[0].in_route) return { ok: false, reason: "ALREADY_IN_ROUTE" };

  const cleanNote = typeof note === "string" && note.trim() ? note.trim().slice(0, 200) : null;
  const { rows } = await rawDb.query<{ id: number }>(
    `INSERT INTO route_suggestions (route_id, location_id, suggested_by, note) VALUES ($1, $2, $3, $4)
     ON CONFLICT (route_id, location_id) WHERE status = 'open' DO NOTHING
     RETURNING id`,
    [routeId, locationId, userId, cleanNote],
  );
  if (!rows.length) return { ok: false, reason: "ALREADY_SUGGESTED" };
  // Suggesting a place counts as voting for it.
  await rawDb.query(`INSERT INTO route_suggestion_votes (suggestion_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [rows[0].id, userId]);
  return { ok: true, id: rows[0].id };
}

async function openSuggestion(routeId: number, suggestionId: number) {
  const { rows } = await rawDb.query<{ id: number; location_id: number; name: string }>(
    `SELECT s.id, s.location_id, l.name FROM route_suggestions s JOIN locations l ON l.id = s.location_id
      WHERE s.id = $1 AND s.route_id = $2 AND s.status = 'open'`,
    [suggestionId, routeId],
  );
  return rows[0] ?? null;
}

/** Adds or removes the user's vote. Returns the new state, or null if the suggestion isn't open here. */
export async function toggleVote(routeId: number, suggestionId: number, userId: number): Promise<{ my_vote: boolean } | null> {
  if (!(await openSuggestion(routeId, suggestionId))) return null;
  const { rows } = await rawDb.query(
    `DELETE FROM route_suggestion_votes WHERE suggestion_id = $1 AND user_id = $2 RETURNING 1`,
    [suggestionId, userId],
  );
  if (rows.length) return { my_vote: false };
  await rawDb.query(`INSERT INTO route_suggestion_votes (suggestion_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [suggestionId, userId]);
  return { my_vote: true };
}

/** Owner: append the suggested place as the route's last stop. */
export async function acceptSuggestion(routeId: number, suggestionId: number): Promise<boolean> {
  const client = await rawDb.getClient();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE route_suggestions s SET status = 'accepted'
         FROM locations l
        WHERE s.id = $1 AND s.route_id = $2 AND s.status = 'open' AND l.id = s.location_id
        RETURNING s.location_id, l.name`,
      [suggestionId, routeId],
    );
    if (!rows.length) { await client.query("ROLLBACK"); return false; }
    // Lock the route row so two accepts don't pick the same order_index.
    await client.query(`SELECT 1 FROM routes WHERE id = $1 FOR UPDATE`, [routeId]);
    await client.query(
      `INSERT INTO route_stops (route_id, location_id, poi_name, order_index, duration_minutes)
       SELECT $1, $2, $3, COALESCE(MAX(order_index) + 1, 0), 60 FROM route_stops WHERE route_id = $1`,
      [routeId, rows[0].location_id, rows[0].name],
    );
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function dismissSuggestion(routeId: number, suggestionId: number): Promise<boolean> {
  const { rows } = await rawDb.query(
    `UPDATE route_suggestions SET status = 'dismissed' WHERE id = $1 AND route_id = $2 AND status = 'open' RETURNING 1`,
    [suggestionId, routeId],
  );
  return rows.length > 0;
}

export async function removeMember(routeId: number, memberId: number): Promise<boolean> {
  const { rows } = await rawDb.query(
    `DELETE FROM route_collaborators WHERE route_id = $1 AND user_id = $2 RETURNING 1`,
    [routeId, memberId],
  );
  return rows.length > 0;
}
