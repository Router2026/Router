import { NextRequest, NextResponse } from "next/server";

// Allow requests only from the configured frontend origin.
// Falls back to the Vite dev server so local development keeps working.
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || "http://localhost:5173";

function corsHeaders(origin: string | null) {
  // Only reflect the origin back if it matches the allowed origin
  const allowedOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Credentials": "true",
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
