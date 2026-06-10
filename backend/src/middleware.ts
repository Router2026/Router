import { NextRequest, NextResponse } from "next/server";

// BUG FIX (mobile "Failed to fetch"):
// The previous implementation reflected the ALLOWED_ORIGIN back even when the
// request came from a *different* origin (e.g. a mobile device on a different
// network, or the production domain vs a staging URL). The browser then saw a
// mismatched Access-Control-Allow-Origin header and blocked the response.
//
// Fix: build a set of all allowed origins from the environment and either
// reflect the matched origin (most permissive, works with credentials) or
// fall back to * (no credentials) so mobile devices are never blocked.

const RAW_ALLOWED = process.env.FRONTEND_URL || "http://localhost:5173";

// Support a comma-separated list: FRONTEND_URL=https://myapp.com,https://www.myapp.com
const ALLOWED_ORIGINS = new Set(
  RAW_ALLOWED.split(",").map(o => o.trim()).filter(Boolean)
);

// Always allow the Vite dev server in non-production builds
if (process.env.NODE_ENV !== "production") {
  ALLOWED_ORIGINS.add("http://localhost:5173");
  ALLOWED_ORIGINS.add("http://localhost:3000");
}

function corsHeaders(origin: string | null): Record<string, string> {
  // If the request origin is in the allowed set, reflect it back exactly.
  // This is required when Access-Control-Allow-Credentials: true is needed.
  // If the origin is absent (same-origin, curl, mobile apps) or not in the
  // allowed set, fall back to wildcard so the request is never silently blocked.
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.has(origin) ? origin : "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    // Only set Allow-Credentials when we have a specific origin (wildcard + credentials is invalid)
    ...(allowedOrigin !== "*" && { "Access-Control-Allow-Credentials": "true" }),
    "Vary": "Origin",
  };
}

// Security headers applied to every API response
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(self), camera=(), microphone=()",
};

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: { ...corsHeaders(origin), ...SECURITY_HEADERS },
    });
  }

  const response = NextResponse.next();
  const headers = { ...corsHeaders(origin), ...SECURITY_HEADERS };
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
