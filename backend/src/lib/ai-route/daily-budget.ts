// Site-wide daily cap on paid AI requests (migration 0014), on top of the per-user
// limits. When it runs out the routes fall back to their no-model paths, so the
// site keeps working without spending.

import { rawDb } from "@/lib/db/raw-client";

export const DEFAULT_DAILY_LIMIT = 300;
const CLEANUP_EVERY_N = 50;

export function dailyLimitFromEnv(value = process.env.AI_DAILY_LIMIT): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_LIMIT;
}

/**
 * Counts one paid AI request against today's (Israel time) site-wide budget and
 * reports whether it may use a model. Fails open: if the DB call fails (e.g. the
 * migration hasn't run), the request is allowed and the error is logged, so the
 * provider-side spend limit stays the last line of defence.
 */
export async function consumeDailyAiBudget(
  limit = dailyLimitFromEnv(),
  random: () => number = Math.random,
): Promise<boolean> {
  try {
    const { rows } = await rawDb.query<{ request_count: number }>(
      `INSERT INTO ai_daily_budget (day, request_count)
       VALUES ((now() AT TIME ZONE 'Asia/Jerusalem')::date, 1)
       ON CONFLICT (day) DO UPDATE SET request_count = ai_daily_budget.request_count + 1
       RETURNING request_count`,
    );
    if (random() < 1 / CLEANUP_EVERY_N) {
      rawDb
        .query(`DELETE FROM ai_daily_budget WHERE day < (now() AT TIME ZONE 'Asia/Jerusalem')::date - 30`)
        .catch((err) => console.warn("[ai-budget] cleanup failed", err));
    }
    const count = Number(rows[0]?.request_count ?? 1);
    if (count === limit + 1) console.warn(`[ai-budget] daily limit of ${limit} reached; models off until midnight`);
    return count <= limit;
  } catch (err) {
    console.error("[ai-budget] counter unavailable; allowing the request", err);
    return true;
  }
}
