// Closed-world candidate retrieval: the ONLY places the LLM may choose from.
// Everything the client finally receives about a stop (name, coordinates,
// image, duration) is read from these rows, never from LLM output.

import { rawDb } from "@/lib/db/raw-client";
import { defaultVisitMinutes } from "./categories";
import { normalizeName, sanitizeForPrompt } from "./text";

// Re-exported for convenience; the implementations live in ./text (DB-free).
export { normalizeName, sanitizeForPrompt, DESCRIPTION_MAX_CHARS } from "./text";
import type { Candidate, LatLng } from "./types";

export interface CandidateQuery {
  regionId: number;
  /** Hebrew categories to include. `null` means any category in the region. */
  categories: string[] | null;
  start?: LatLng | null;
  /** Max candidates sent to the LLM. Keeps the prompt small (~40-60 is plenty). */
  limit?: number;
  /** Max candidates per category, so one dense category cannot crowd out the rest. */
  perCategory?: number;
  /** Tie-break seed so equal-ranked places vary between requests. */
  seed?: string;
}

export const DEFAULT_CANDIDATE_LIMIT = 50;
export const DEFAULT_PER_CATEGORY = 12;

interface CandidateRow {
  id: number;
  name: string;
  description: string | null;
  category: string;
  latitude: string | number;
  longitude: string | number;
  duration_minutes: number | null;
  difficulty: string | null;
  has_water: boolean | null;
  has_shade: boolean | null;
  accessible: boolean | null;
  average_rating: string | number | null;
  main_image: string | null;
  distance_m: string | number | null;
}

// Rows are ranked inside each category (nearest to start first, then
// featured/rating, then a seeded hash), then interleaved by that rank so the
// final list is a round-robin across categories.
const CANDIDATES_SQL = `
WITH base AS (
  SELECT
    l.id, l.name, l.description, l.category, l.latitude, l.longitude,
    l.duration_minutes, l.difficulty, l.has_water, l.has_shade, l.accessible,
    l.average_rating, l.main_image, l.is_featured,
    CASE WHEN $3::float8 IS NULL OR $4::float8 IS NULL THEN NULL
    ELSE ST_Distance(
      COALESCE(
        l.geom::geography,
        ST_SetSRID(ST_MakePoint(l.longitude::float8, l.latitude::float8), 4326)::geography
      ),
      ST_SetSRID(ST_MakePoint($4::float8, $3::float8), 4326)::geography
    ) END AS distance_m
  FROM locations l
  WHERE l.region_id = $1
    AND ($2::text[] IS NULL OR l.category = ANY($2::text[]))
    AND l.latitude IS NOT NULL
    AND l.longitude IS NOT NULL
    AND NOT (l.latitude = 0 AND l.longitude = 0)
),
ranked AS (
  SELECT base.*,
    ROW_NUMBER() OVER (
      PARTITION BY category
      ORDER BY distance_m ASC NULLS LAST,
               is_featured DESC NULLS LAST,
               average_rating DESC NULLS LAST,
               md5(id::text || $5)
    ) AS rn
  FROM base
)
SELECT id, name, description, category, latitude, longitude, duration_minutes,
       difficulty, has_water, has_shade, accessible, average_rating, main_image,
       distance_m
FROM ranked
WHERE rn <= $6
ORDER BY rn, distance_m ASC NULLS LAST, md5(id::text || $5)
LIMIT $7`;

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/** Converts DB rows to candidates: drops invalid coords and duplicate names, assigns keys L1..Ln. */
export function rowsToCandidates(rows: CandidateRow[]): Candidate[] {
  const seenNames = new Set<string>();
  const result: Candidate[] = [];

  for (const row of rows) {
    const lat = toNumber(row.latitude);
    const lng = toNumber(row.longitude);
    if (lat === null || lng === null || (lat === 0 && lng === 0)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

    const name = (row.name ?? "").trim();
    const normalized = normalizeName(name);
    // The ETL can import the same place from several sources; keep the first.
    if (!normalized || seenNames.has(normalized)) continue;
    seenNames.add(normalized);

    const duration = row.duration_minutes && row.duration_minutes > 0
      ? row.duration_minutes
      : defaultVisitMinutes(row.category);

    result.push({
      key: `L${result.length + 1}`,
      locationId: Number(row.id),
      name,
      category: row.category,
      description: sanitizeForPrompt(row.description),
      lat,
      lng,
      durationMinutes: duration,
      difficulty: row.difficulty ?? null,
      hasWater: !!row.has_water,
      hasShade: !!row.has_shade,
      accessible: !!row.accessible,
      rating: toNumber(row.average_rating),
      mainImage: row.main_image ?? null,
      distanceFromStartM: toNumber(row.distance_m),
    });
  }
  return result;
}

async function queryRows(q: CandidateQuery): Promise<CandidateRow[]> {
  const { rows } = await rawDb.query<CandidateRow>(CANDIDATES_SQL, [
    q.regionId,
    q.categories && q.categories.length > 0 ? q.categories : null,
    q.start?.lat ?? null,
    q.start?.lng ?? null,
    q.seed ?? "",
    q.perCategory ?? DEFAULT_PER_CATEGORY,
    q.limit ?? DEFAULT_CANDIDATE_LIMIT,
  ]);
  return rows;
}

/** Fetches candidates matching the requested categories only. */
export async function fetchCandidates(q: CandidateQuery): Promise<Candidate[]> {
  return rowsToCandidates(await queryRows(q));
}

/**
 * Fetches candidates for the requested categories; if fewer than `minCount`
 * are found, tops up with other categories from the same region so the
 * planner still has enough to build a full day. Matching categories come first.
 */
export async function fetchCandidatesWithFallback(
  q: CandidateQuery,
  minCount = 6,
): Promise<{ candidates: Candidate[]; usedFallback: boolean }> {
  const limit = q.limit ?? DEFAULT_CANDIDATE_LIMIT;
  const strictRows = await queryRows(q);
  if (strictRows.length >= minCount || q.categories === null) {
    return { candidates: rowsToCandidates(strictRows), usedFallback: false };
  }

  const anyRows = await queryRows({ ...q, categories: null });
  const strictIds = new Set(strictRows.map((r) => Number(r.id)));
  const merged = [...strictRows, ...anyRows.filter((r) => !strictIds.has(Number(r.id)))].slice(0, limit);
  return { candidates: rowsToCandidates(merged), usedFallback: true };
}
