// Hybrid retrieval SQL: full-text rank + vector rank (+ region-scoped vector rank when the query
// names a region), fused with Reciprocal Rank Fusion. Hard filters apply to every list.

import { LIST_COLUMNS } from "@/lib/locations/location-service";

/** RRF constant (standard value from the RRF paper). */
export const RRF_K = 60;
/** Candidates taken from each ranked list before fusion. */
export const PER_LIST_LIMIT = 50;
/** Added to locations in a region the query mentioned — equal to a #1 rank in one list. */
export const REGION_BOOST = 1 / (RRF_K + 1);

export interface HybridSqlParams {
  /** Text for full-text / name matching (Hebrew translation if we have one). */
  ftsText: string;
  /** Serialized pgvector literal, or null → full-text only. */
  vector: string | null;
  boostRegionSlugs: string[];
  /** Hard filters (from UI), matched against region slug or name like getLocations(). */
  regions?: string[];
  categories?: string[];
  near?: { lat: number; lng: number; radiusM?: number } | null;
  limit: number;
}

export function buildHybridSql(p: HybridSqlParams): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const add = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  const filters: string[] = [
    // Same coordinate sanity rule as the AI planner's candidate query.
    "NOT (l.latitude = 0 AND l.longitude = 0)",
  ];
  if (p.regions?.length) {
    const r = add(p.regions);
    filters.push(`(r.slug = ANY(${r}::text[]) OR r.name = ANY(${r}::text[]))`);
  }
  if (p.categories?.length) filters.push(`l.category = ANY(${add(p.categories)}::text[])`);

  let distanceSelect = "NULL::float8 AS distance_meters";
  if (p.near) {
    const point = `ST_SetSRID(ST_MakePoint(${add(p.near.lng)}::float8, ${add(p.near.lat)}::float8), 4326)::geography`;
    distanceSelect = `ST_Distance(l.geom::geography, ${point}) AS distance_meters`;
    if (p.near.radiusM) filters.push(`ST_DWithin(l.geom::geography, ${point}, ${add(p.near.radiusM)}::float8)`);
  }

  const q = add(p.ftsText);
  const like = add(`%${p.ftsText.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const vec = add(p.vector);
  const boost = add(p.boostRegionSlugs);
  const perList = add(PER_LIST_LIMIT);
  const k = add(RRF_K);
  const boostWeight = add(REGION_BOOST);
  const limit = add(p.limit);

  const sql = `
WITH filtered AS (
  SELECT l.id, r.slug AS region_slug
  FROM locations l
  LEFT JOIN regions r ON r.id = l.region_id
  WHERE ${filters.join("\n    AND ")}
),
fts AS (
  SELECT l.id,
         ROW_NUMBER() OVER (ORDER BY ts_rank(l.search_vec, plainto_tsquery('simple', ${q})) DESC,
                                     l.average_rating DESC NULLS LAST, l.id) AS rnk
  FROM locations l
  JOIN filtered f ON f.id = l.id
  WHERE l.search_vec @@ plainto_tsquery('simple', ${q})
     OR l.name ILIKE ${like}
  ORDER BY rnk
  LIMIT ${perList}
),
vec AS (
  SELECT e.location_id AS id,
         ROW_NUMBER() OVER (ORDER BY e.embedding <=> ${vec}::vector, e.location_id) AS rnk
  FROM location_embeddings e
  JOIN filtered f ON f.id = e.location_id
  WHERE ${vec}::vector IS NOT NULL
  ORDER BY rnk
  LIMIT ${perList}
),
vec_region AS (
  SELECT e.location_id AS id,
         ROW_NUMBER() OVER (ORDER BY e.embedding <=> ${vec}::vector, e.location_id) AS rnk
  FROM location_embeddings e
  JOIN filtered f ON f.id = e.location_id
  WHERE ${vec}::vector IS NOT NULL
    AND f.region_slug = ANY(${boost}::text[])
  ORDER BY rnk
  LIMIT ${perList}
),
ids AS (
  SELECT id FROM fts UNION SELECT id FROM vec UNION SELECT id FROM vec_region
),
fused AS (
  SELECT ids.id,
         fts.rnk AS fts_rank,
         vec.rnk AS vec_rank,
         COALESCE(1.0 / (${k} + fts.rnk), 0)
       + COALESCE(1.0 / (${k} + vec.rnk), 0)
       + COALESCE(1.0 / (${k} + vec_region.rnk), 0) AS rrf
  FROM ids
  LEFT JOIN fts USING (id)
  LEFT JOIN vec USING (id)
  LEFT JOIN vec_region USING (id)
)
SELECT ${LIST_COLUMNS},
       ${distanceSelect},
       fused.fts_rank,
       fused.vec_rank,
       fused.rrf + CASE WHEN r.slug = ANY(${boost}::text[]) THEN ${boostWeight}::float8 ELSE 0 END AS score
FROM fused
JOIN locations l ON l.id = fused.id
LEFT JOIN regions r ON r.id = l.region_id
ORDER BY score DESC, l.average_rating DESC NULLS LAST, l.id
LIMIT ${limit}`;

  return { sql, params };
}
