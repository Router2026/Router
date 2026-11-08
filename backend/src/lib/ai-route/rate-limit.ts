// Postgres-backed fixed-window rate limiter for AI route generation.
// Works across stateless Vercel instances (see migration 0008).

import { rawDb } from "@/lib/db/raw-client";

export const DEFAULT_HOURLY_LIMIT = 10;
/** Roughly one in N calls also prunes windows older than a day. */
const CLEANUP_EVERY_N = 50;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** When the current window ends. */
  resetAt: Date;
}

export function hourlyLimitFromEnv(value = process.env.AI_ROUTE_HOURLY_LIMIT): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_HOURLY_LIMIT;
}

/**
 * Atomically counts this request against the user's hourly window and reports
 * whether it is allowed. Rejected requests are counted too, so hammering the
 * endpoint does not reset anything.
 */
export async function consumeRouteQuota(
  userId: number,
  limit = hourlyLimitFromEnv(),
  random: () => number = Math.random,
): Promise<RateLimitResult> {
  const { rows } = await rawDb.query<{ request_count: number; reset_at: Date | string }>(
    `INSERT INTO ai_route_rate_limits (user_id, window_start, request_count)
     VALUES ($1, date_trunc('hour', now()), 1)
     ON CONFLICT (user_id, window_start)
     DO UPDATE SET request_count = ai_route_rate_limits.request_count + 1
     RETURNING request_count, window_start + interval '1 hour' AS reset_at`,
    [userId],
  );

  if (random() < 1 / CLEANUP_EVERY_N) {
    // Fire-and-forget: cleanup failures must never fail the user request.
    rawDb
      .query(`DELETE FROM ai_route_rate_limits WHERE window_start < now() - interval '1 day'`)
      .catch((err) => console.warn("[ai-route] rate-limit cleanup failed", err));
  }

  const count = Number(rows[0]?.request_count ?? 1);
  const resetAt = new Date(rows[0]?.reset_at ?? Date.now() + 3_600_000);
  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}
