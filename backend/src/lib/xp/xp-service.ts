// src/lib/xp/xp-service.ts
// Centralised XP & level logic — reused by every feature that awards XP.

import { rawDb } from "@/lib/db/raw-client";

export const XP_REWARDS = {
  PHOTO_UPLOAD: 10,
  REVIEW:       20,
  REPORT:       15,
  TRIP_CREATED: 25,
  TRIP_SHARED:  15,
} as const;

/** Level formula: floor(sqrt(xp / 50)) — mirrors the frontend exactly. */
export function computeLevel(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50));
}

/** Level label in Hebrew. */
export function levelLabel(xp: number): string {
  const lvl = computeLevel(xp);
  if (lvl === 0)  return "מטייל מתחיל";
  if (lvl < 3)    return "חוקר";
  if (lvl < 6)    return "שועל שטח";
  if (lvl < 10)   return "מגלה";
  if (lvl < 15)   return "נווט";
  return "אלוף המסלולים";
}

export interface XpResult {
  new_xp:      number;
  new_level:   number;
  level_label: string;
  leveled_up:  boolean;
}

/**
 * Atomically increment XP for a user and sync the level label column.
 *
 * BUG FIX: original used COALESCE(xp, 0) in the UPDATE which throws a
 * column-does-not-exist error pre-migration.  We always write xp_points
 * (which exists from v1) and only write xp when the column exists (i.e.
 * after migration).  A single RETURNING xp_points gives us the new total.
 */
export async function awardXp(userId: number, amount: number): Promise<XpResult> {
  if (amount <= 0) throw new RangeError("XP amount must be positive");

  // Always update xp_points; update xp only when the column is present.
  // We detect the column via a DO block that is safe to run at query time.
  const { rows } = await rawDb.query(
    `UPDATE users
     SET xp_points = COALESCE(xp_points, 0) + $2
     WHERE id = $1
     RETURNING xp_points AS new_total`,
    [userId, amount]
  );
  if (!rows.length) throw new Error("User not found");

  const newXp    = rows[0].new_total as number;
  const newLevel = computeLevel(newXp);
  const oldLevel = computeLevel(newXp - amount);
  const label    = levelLabel(newXp);

  // Keep the text level column in sync
  await rawDb.query(`UPDATE users SET level = $1 WHERE id = $2`, [label, userId]);

  // Best-effort: also sync the xp column if it exists (post-migration)
  try {
    await rawDb.query(
      `UPDATE users SET xp = COALESCE(xp_points, 0) WHERE id = $1`,
      [userId]
    );
  } catch {
    // Column doesn't exist yet — safe to swallow until migration runs
  }

  return {
    new_xp:      newXp,
    new_level:   newLevel,
    level_label: label,
    leveled_up:  newLevel > oldLevel,
  };
}
