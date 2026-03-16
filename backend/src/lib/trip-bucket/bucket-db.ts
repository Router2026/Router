/**
 * Trip Bucket — Database helpers
 * --------------------------------
 * Retrieves full POI records from the Router app's `locations` table,
 * using PostGIS spatial types where applicable.
 *
 * The `locations` table lives in the `router` search_path (set on every
 * connection by the pool's `connect` handler in raw-client.ts).
 */

import { rawDb } from "@/lib/db/raw-client";
import type { TspNode } from "./tsp-engine";
import { BucketPoi } from "./types";

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Fetch full metadata for a list of location IDs.
 *
 * Uses PostGIS ST_X / ST_Y to extract coordinates from the geometry column
 * when present; falls back to the plain numeric latitude / longitude columns.
 *
 * The result order matches the provided `ids` array so callers can rely on
 * positional alignment.
 */
export async function fetchBucketPois(ids: string[]): Promise<BucketPoi[]> {
  if (ids.length === 0) return [];

  // $1 = ARRAY of ids cast to integer for the locations table PK
  const { rows } = await rawDb.query(
    `SELECT
       l.id::text                                     AS id,
       l.name,
       COALESCE(l.description, '')                    AS description,
       COALESCE(l.category, '')                       AS category,
       COALESCE(r.name, '')                           AS region,
       -- PostGIS: extract from geometry if column exists, else use numeric cols
       COALESCE(
         CASE WHEN l.geom IS NOT NULL THEN ST_Y(l.geom::geometry) END,
         l.latitude::float
       )                                              AS latitude,
       COALESCE(
         CASE WHEN l.geom IS NOT NULL THEN ST_X(l.geom::geometry) END,
         l.longitude::float
       )                                              AS longitude,
       COALESCE(l.duration_minutes, 60)              AS duration_minutes,
       COALESCE(l.difficulty, 'בינוני')               AS difficulty,
       COALESCE(l.has_water,   false)                AS has_water,
       COALESCE(l.has_shade,   false)                AS has_shade,
       COALESCE(l.accessible,  false)                AS accessible,
       COALESCE(l.average_rating, 4.0)::float        AS average_rating
     FROM   locations l
     LEFT JOIN regions r ON r.id = l.region_id
     WHERE  l.id = ANY($1::int[])
     ORDER  BY array_position($1::int[], l.id)`,
    [ids],
  );

  return rows.map((r) => ({
    id: String(r.id),
    name: r.name as string,
    description: r.description as string,
    category: r.category as string,
    region: r.region as string,
    latitude: parseFloat(r.latitude as string),
    longitude: parseFloat(r.longitude as string),
    duration_minutes: Number(r.duration_minutes),
    difficulty: r.difficulty as string,
    has_water: Boolean(r.has_water),
    has_shade: Boolean(r.has_shade),
    accessible: Boolean(r.accessible),
    average_rating: parseFloat(r.average_rating as string),
  }));
}

/**
 * Convert BucketPoi records to the TspNode shape required by the solver.
 */
export function toTspNodes(pois: BucketPoi[]): TspNode[] {
  return pois.map((p) => ({
    id: p.id,
    name: p.name,
    latitude: p.latitude,
    longitude: p.longitude,
    duration_minutes: p.duration_minutes,
  }));
}
