/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Rate limiter with two tiers:
 *
 *  1. Upstash Redis (persistent across restarts + Vercel cold starts)
 *     — activated when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set
 *     — uses sliding-window algorithm for accurate counting
 *
 *  2. In-memory fallback (Map-based)
 *     — used in local development or when Upstash env vars are absent
 *     — resets on process restart (fine for dev, not ideal for production)
 *
 * Setup for production (Vercel):
 *   1. Create a free Redis database at https://console.upstash.com
 *   2. Copy the REST URL and REST token
 *   3. Add to Vercel environment variables:
 *        UPSTASH_REDIS_REST_URL=https://...upstash.io
 *        UPSTASH_REDIS_REST_TOKEN=Ax...
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ── Upstash client (lazy — only created when env vars are present) ────────────

let _ratelimit: Ratelimit | null = null;

function getUpstashRatelimit(): Ratelimit | null {
  if (_ratelimit) return _ratelimit;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const redis = new Redis({ url, token });
  _ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1, "1 s"), // overridden per-call via prefix
    prefix: "rl",
    analytics: false,
  });
  return _ratelimit;
}

// ── In-memory fallback ────────────────────────────────────────────────────────

interface Bucket { count: number; resetAt: number; }
const _store = new Map<string, Bucket>();

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of _store) if (now > b.resetAt) _store.delete(k);
}, 5 * 60 * 1000).unref?.();

function inMemoryCheck(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  let b = _store.get(key);
  if (!b || now > b.resetAt) { b = { count: 0, resetAt: now + windowMs }; _store.set(key, b); }
  b.count++;
  return b.count <= max;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true when the request is within the allowed rate.
 * Returns false when the limit has been exceeded.
 *
 * @param key       Unique bucket identifier (e.g. "login:1.2.3.4")
 * @param max       Maximum requests allowed in the window
 * @param windowMs  Window length in milliseconds
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const upstash = getUpstashRatelimit();
  if (upstash) {
    // Encode the per-call limit into the key so one Ratelimit instance handles all limits
    const prefixedKey = `${key}:${max}:${windowMs}`;
    try {
      const { success } = await upstash.limit(prefixedKey, {
        rate: max,
        interval: Math.ceil(windowMs / 1000) + " s",
      } as any);
      return success;
    } catch (err) {
      // Upstash unreachable — fall through to in-memory
      console.error("[rate-limit] Upstash error, falling back to in-memory:", err);
    }
  }
  return inMemoryCheck(key, max, windowMs);
}

/** Extracts the best-effort client IP from a Next.js request */
export function clientIp(req: Request): string {
  return (
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
