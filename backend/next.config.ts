import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Security headers on every response (HTML pages + API)
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "X-Frame-Options",          value: "DENY" },
          { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",       value: "geolocation=(self), camera=(), microphone=()" },
          {
            // CSP: restrictive by default; allows inline styles (used throughout the app)
            // and images/connect from known external origins.
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://*.supabase.co https://nominatim.openstreetmap.org https://router.project-osrm.org",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
      // CORS for API routes is handled in middleware.ts (origin-aware, not static).
      // The static wildcard previously here has been removed.
    ];
  },
};

export default nextConfig;
