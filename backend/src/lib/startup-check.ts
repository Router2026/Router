/**
 * Validates critical environment variables at application startup.
 * Logs warnings for misconfiguration that could create security holes.
 * In production, missing FRONTEND_URL or a weak JWT_SECRET is treated as a fatal error.
 */

const isProd = process.env.NODE_ENV === "production";

interface Check {
  name: string;
  test: () => boolean;
  message: string;
  fatal: boolean; // if true + isProd → throw
}

const CHECKS: Check[] = [
  {
    name: "JWT_SECRET set",
    test: () => !!process.env.JWT_SECRET,
    message: "JWT_SECRET is not set. Tokens will be signed with the insecure dev fallback.",
    fatal: true,
  },
  {
    name: "JWT_SECRET length",
    test: () => (process.env.JWT_SECRET?.length ?? 0) >= 32,
    message: "JWT_SECRET is shorter than 32 characters. Use a longer random secret.",
    fatal: true,
  },
  {
    name: "JWT_SECRET not default",
    test: () => process.env.JWT_SECRET !== "router-jwt-dev-secret-change-in-prod",
    message: "JWT_SECRET is still set to the default dev value. Rotate it immediately.",
    fatal: true,
  },
  {
    name: "FRONTEND_URL set",
    test: () => !!process.env.FRONTEND_URL,
    message:
      "FRONTEND_URL is not set. CORS will allow requests from any origin (*). " +
      "Set this to your frontend URL in Vercel → Project Settings → Environment Variables.",
    fatal: true,
  },
  {
    name: "FRONTEND_URL is https in production",
    test: () => !isProd || (process.env.FRONTEND_URL ?? "").startsWith("https://"),
    message: "FRONTEND_URL should use HTTPS in production.",
    fatal: false,
  },
  {
    name: "DATABASE_URL set",
    test: () => !!process.env.DATABASE_URL,
    message: "DATABASE_URL is not set. Database connections will fail.",
    fatal: true,
  },
  {
    name: "Upstash rate limiter configured",
    test: () =>
      !!process.env.UPSTASH_REDIS_REST_URL &&
      !!process.env.UPSTASH_REDIS_REST_TOKEN,
    message:
      "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set. " +
      "Rate limiting will use in-memory store (resets on restart). " +
      "Create a free Redis DB at https://console.upstash.com and add the env vars to Vercel.",
    fatal: false, // acceptable degradation
  },
];

export function runStartupChecks(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const check of CHECKS) {
    if (!check.test()) {
      if (check.fatal && isProd) {
        errors.push(`[FATAL] ${check.name}: ${check.message}`);
      } else {
        warnings.push(`[WARN]  ${check.name}: ${check.message}`);
      }
    }
  }

  for (const w of warnings) console.warn(w);

  if (errors.length > 0) {
    for (const e of errors) console.error(e);
    throw new Error(
      `Startup check failed: ${errors.length} critical misconfiguration(s). See logs above.`,
    );
  }
}
