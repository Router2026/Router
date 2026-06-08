// In-memory rate limiter — resets on cold start, good for basic brute-force protection.
// Swap the store for a Redis client for multi-instance deployments.

interface Bucket {
  count: number;
  resetAt: number;
}

const _store = new Map<string, Bucket>();

// Prune stale buckets every 5 minutes so the map doesn't grow unboundedly
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of _store) {
    if (now > b.resetAt) _store.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

/**
 * Returns true when the request is within the allowed rate.
 * Returns false when the limit has been exceeded.
 *
 * @param key       Unique string identifying the bucket (e.g. "login:1.2.3.4")
 * @param max       Maximum requests allowed per window
 * @param windowMs  Window length in milliseconds
 */
export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  let b = _store.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    _store.set(key, b);
  }
  b.count++;
  return b.count <= max;
}

/** Extracts the best-effort client IP from a Next.js request */
export function clientIp(req: Request): string {
  return (
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}
