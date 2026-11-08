// GET /api/locations/search?q=...&region=a,b&category=x&difficulty=y&has_water=true&has_shade=true
//     &accessible=true&lat=..&lng=..&radius=..&limit=..
// Hybrid (semantic + full-text) location search. Public endpoint; rate-limited per IP because
// each uncached request costs an embedding call (and a translation call for non-Hebrew queries).

import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse } from "@/lib/api/response";
import { checkRateLimit, clientIp } from "@/lib/auth/rate-limit";
import { MAX_QUERY_CHARS } from "@/lib/embeddings";
import { MAX_SEARCH_LIMIT, searchLocations } from "@/lib/search/search";
import type { AttributeKey } from "@/lib/search/attributes";

const RATE_LIMIT_PER_MIN = 60;
const MAX_RADIUS_M = 200_000;
const MAX_LIST_ITEMS = 20;

function parseList(value: string | null): string[] | undefined {
  if (!value) return undefined;
  const items = value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_LIST_ITEMS);
  return items.length ? items.map((s) => s.slice(0, 100)) : undefined;
}

function parseNum(value: string | null): number | undefined {
  if (value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function bad(message: string) {
  return NextResponse.json(errorResponse(message, "VALIDATION_ERROR"), { status: 400 });
}

export async function GET(req: NextRequest) {
  if (!(await checkRateLimit(`search:${clientIp(req)}`, RATE_LIMIT_PER_MIN, 60_000))) {
    return NextResponse.json(errorResponse("Too many searches, try again in a minute", "RATE_LIMITED"), {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  if (!q) return bad("q is required");
  if (q.length > MAX_QUERY_CHARS) return bad(`q must be at most ${MAX_QUERY_CHARS} characters`);

  const lat = parseNum(sp.get("lat"));
  const lng = parseNum(sp.get("lng"));
  const radius = parseNum(sp.get("radius"));
  if ((lat === undefined) !== (lng === undefined)) return bad("lat and lng must be provided together");
  if (lat !== undefined && (lat < -90 || lat > 90)) return bad("lat out of range");
  if (lng !== undefined && (lng < -180 || lng > 180)) return bad("lng out of range");
  if (radius !== undefined && (radius <= 0 || radius > MAX_RADIUS_M)) return bad(`radius must be 1..${MAX_RADIUS_M}`);
  if (radius !== undefined && lat === undefined) return bad("radius requires lat and lng");

  const limitRaw = parseNum(sp.get("limit"));
  const limit = limitRaw === undefined ? 20 : Math.trunc(limitRaw);
  if (limit < 1 || limit > MAX_SEARCH_LIMIT) return bad(`limit must be 1..${MAX_SEARCH_LIMIT}`);

  const requiredAttributes: AttributeKey[] = [];
  if (sp.get("has_water") === "true") requiredAttributes.push("water");
  if (sp.get("has_shade") === "true") requiredAttributes.push("shade");
  if (sp.get("accessible") === "true") requiredAttributes.push("accessible");

  try {
    const result = await searchLocations({
      q,
      regions: parseList(sp.get("region")),
      categories: parseList(sp.get("category")),
      difficulties: parseList(sp.get("difficulty")),
      requiredAttributes,
      near: lat !== undefined && lng !== undefined ? { lat, lng, radiusM: radius } : null,
      limit,
    });
    return NextResponse.json(successResponse(result));
  } catch (err) {
    console.error("[GET /api/locations/search]", err);
    return NextResponse.json(errorResponse("Search failed", "INTERNAL_ERROR"), { status: 500 });
  }
}
