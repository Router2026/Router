// src/app/api/trips/public/route.ts
// GET /trips/public — list public trips with optional filters
// POST /trips/public — create a new trip (authenticated)
//
// OPTIMIZATION (infinite scroll): GET now returns pagination metadata
// (`has_more`) alongside `items`, computed via a cheap "fetch limit+1" trick
// in the service layer (no extra COUNT(*) round-trip). Default page size is
// 10 instead of 50 — the Community feed loads in small pages and fetches the
// next page only when the user scrolls near the end of the list.
//
// Response shape change: previously `data` was `PublicTrip[]`. It is now
// `{ items: PublicTrip[]; has_more: boolean }`. The only frontend consumer
// (usePublicTrips / PublicTrips.tsx) has been updated to match.
//
// Caching: in-memory cache keyed by filters + limit + offset (2 min TTL), so
// re-requesting a page already seen recently (e.g. user scrolls up, or a
// second visitor loads the same page) hits memory instead of Postgres.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getPublicTripsPaginated, createTrip } from "@/lib/public-trips/public-trips-service";
import { cacheGet, cacheSet } from "@/lib/cache/mem-cache";

const PUBLIC_TRIPS_TTL = 120; // seconds
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const userIdParam = sp.get("user_id") ? Number.parseInt(sp.get("user_id")!, 10) : undefined;

    const rawLimit = sp.get("limit") ? Number.parseInt(sp.get("limit")!, 10) : DEFAULT_PAGE_SIZE;
    const limit = Math.min(Number.isNaN(rawLimit) || rawLimit <= 0 ? DEFAULT_PAGE_SIZE : rawLimit, MAX_PAGE_SIZE);
    const rawOffset = sp.get("offset") ? Number.parseInt(sp.get("offset")!, 10) : 0;
    const offset = Number.isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

    const filters = {
      user_id:    userIdParam && !Number.isNaN(userIdParam) ? userIdParam : undefined,
      region:     sp.get("region")     || undefined,
      difficulty: sp.get("difficulty") || undefined,
      style:      sp.get("style")      || undefined,
      group_type: sp.get("group_type") || undefined,
      limit,
      offset,
    };

    // Cache key includes limit/offset so each page is cached independently
    const cacheKey = `public-trips:${JSON.stringify(filters)}`;
    const cached = cacheGet<Awaited<ReturnType<typeof getPublicTripsPaginated>>>(cacheKey);
    if (cached) {
      return NextResponse.json(successResponse(cached), {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          "X-Cache": "HIT",
        },
      });
    }

    const result = await getPublicTripsPaginated(filters);
    cacheSet(cacheKey, result, PUBLIC_TRIPS_TTL);

    return NextResponse.json(successResponse(result), {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        "X-Cache": "MISS",
      },
    });
  } catch (err) {
    console.error("[GET /api/trips/public]", err);
    return NextResponse.json(errorResponse("Failed to fetch trips", "DB_ERROR"), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getUserFromRequest(req);
    if (!auth) return NextResponse.json(errorResponse("Unauthorized", "AUTH_ERROR"), { status: 401 });

    const body = await req.json();
    if (!body.title?.trim()) {
      return NextResponse.json(errorResponse("title is required", "VALIDATION_ERROR"), { status: 400 });
    }

    const { trip, xp } = await createTrip(auth.id, {
      title:          body.title.trim(),
      description:    body.description?.trim() || undefined,
      route_geojson:  body.route_geojson || undefined,
      is_public:      body.is_public ?? false,
      location_ids:   Array.isArray(body.location_ids) ? body.location_ids : [],
    });

    return NextResponse.json(successResponse({ ...trip, xp_awarded: xp }), { status: 201 });
  } catch (err) {
    console.error("[POST /api/trips/public]", err);
    return NextResponse.json(errorResponse("Failed to create trip", "DB_ERROR"), { status: 500 });
  }
}

export { OPTIONS } from "@/lib/api/cors";
