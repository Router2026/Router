// src/lib/users/user-service.ts

import { rawDb } from "@/lib/db/raw-client";
import { computeLevel, levelLabel } from "@/lib/xp/xp-service";

export interface RouterUser {
  id:            number;
  email:         string;
  full_name:     string;
  display_name:  string;
  username:      string;
  xp_points:     number;
  xp:            number;
  level:         string;
  level_number:  number;
  reports_count: number;
  reviews_count: number;
  trips_count:   number;
  created_at:    Date;
}

// BUG FIX: removed COALESCE(xp, xp_points, 0) which throws pre-migration.
// Use xp_points as the safe column; after migration xp will also be populated.
const XP_EXPR = `COALESCE(xp_points, 0)`;

function rowToUser(row: Record<string, unknown>): RouterUser {
  const xp = Number.parseInt(row.xp as string, 10) || (row.xp_points as number) || 0;
  return {
    id:            row.id            as number,
    email:         (row.email        as string) || "",
    full_name:     (row.full_name    as string) || "",
    display_name:  (row.full_name    as string) || (row.username as string) || "",
    username:      (row.username     as string) || "",
    xp_points:     xp,
    xp,
    level:         (row.level        as string) || levelLabel(xp),
    level_number:  computeLevel(xp),
    reports_count: (row.reports_count as number) || 0,
    reviews_count: (row.reviews_count as number) || 0,
    trips_count:   (row.trips_count   as number) || 0,
    created_at:    row.created_at    as Date,
  };
}

export async function getCurrentUser(): Promise<RouterUser | null> {
  const { rows } = await rawDb.query(
    `SELECT id, email, full_name, username, ${XP_EXPR} AS xp, xp_points,
            level, reports_count, reviews_count, trips_count, created_at
     FROM   users WHERE id = 1 LIMIT 1`
  );
  return rows.length ? rowToUser(rows[0]) : null;
}

export async function getLeaderboard(): Promise<RouterUser[]> {
  const { rows } = await rawDb.query(
    `SELECT id, email, full_name, username,
            ${XP_EXPR} AS xp, xp_points,
            level, reports_count, reviews_count, trips_count, created_at
     FROM   users
     ORDER  BY xp_points DESC
     LIMIT  50`
  );
  if (!rows.length) return MOCK_LEADERBOARD;
  return rows.map(rowToUser);
}

export async function getStats(): Promise<{
  total_locations: number;
  total_regions:   number;
  average_rating:  number;
}> {
  const { rows } = await rawDb.query(
    `SELECT
       (SELECT COUNT(*)::int            FROM locations) AS total_locations,
       (SELECT COUNT(*)::int            FROM regions)   AS total_regions,
       (SELECT ROUND(AVG(average_rating)::numeric, 1)
        FROM locations)                                 AS average_rating`
  );
  return {
    total_locations: (rows[0].total_locations as number) || 0,
    total_regions:   (rows[0].total_regions   as number) || 0,
    average_rating:  Number.parseFloat(rows[0].average_rating as string) || 4.8,
  };
}

// ── Mock fallback when DB is empty ─────────────────────────────────────────
const MOCK_LEADERBOARD: RouterUser[] = [
  { id: 1, email: "omri@example.com",  full_name: "עומרי חליפה", display_name: "עומרי חליפה", username: "omri",  xp: 1250, xp_points: 1250, level: "נווט",        level_number: 5, reports_count: 5, reviews_count: 8, trips_count: 10, created_at: new Date() },
  { id: 2, email: "sarah@example.com", full_name: "שרה לוי",     display_name: "שרה לוי",     username: "sarah", xp: 980,  xp_points: 980,  level: "מגלה",        level_number: 4, reports_count: 3, reviews_count: 6, trips_count: 7,  created_at: new Date() },
  { id: 3, email: "yoav@example.com",  full_name: "יואב כהן",    display_name: "יואב כהן",    username: "yoav",  xp: 850,  xp_points: 850,  level: "שועל שטח",    level_number: 4, reports_count: 2, reviews_count: 4, trips_count: 6,  created_at: new Date() },
];
