// src/lib/locations/location-service.ts
// OPTIMIZED: slim SELECT for list queries, full-text search, server-side filters
// getLocationById() still fetches all columns — used only by POIDetail.

import { rawDb } from "@/lib/db/raw-client";
import { cacheGet, cacheSet } from "@/lib/cache/mem-cache";

const MAP_CACHE_TTL = parseInt(process.env.MAP_CACHE_TTL || "30");
const LIST_CACHE_TTL = parseInt(process.env.LIST_CACHE_TTL || "300");

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Location {
  id: number;
  name: string;
  description: string;
  category: string;
  region_id: number;
  region_name?: string;
  latitude: number;
  longitude: number;
  images: string[];
  main_image?: string;
  source: "kkl" | "inpa" | "osm" | "manual" | "seed";
  source_id?: string;
  difficulty?: string;
  duration_minutes?: number;
  has_water?: boolean;
  has_shade?: boolean;
  accessible?: boolean;
  is_featured?: boolean;
  average_rating: number;
  photo_credit?: string;
  uploaded_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface NearbyLocation extends Location {
  distance_meters: number;
}

export type LocationWithDistance = Location & { distance_meters?: number };

export interface LocationQuery {
  region?: string;
  category?: string;
  difficulty?: string;
  has_water?: boolean;
  has_shade?: boolean;
  accessible?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  user_lat?: number;
  user_lng?: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface Cluster {
  lat: number;
  lng: number;
  count: number;
  ids: number[];
  category?: string;
}

/** Returned by GET /api/locations/meta — used to populate filter dropdowns */
export interface LocationMeta {
  categories: string[];
  difficulties: string[];
  total_count: number;
}

// ── Row mappers ───────────────────────────────────────────────────────────────

/**
 * Maps a full DB row (all columns) → Location.
 * Used by getLocationById, upsertLocation, updateLocation, deleteLocation.
 */
function rowToLocation(row: Record<string, unknown>): Location {
  const images = Array.isArray(row.images)
    ? (row.images as string[])
    : typeof row.images === "string"
      ? JSON.parse(row.images as string)
      : [];
  return {
    id: row.id as number,
    name: row.name as string,
    description: (row.description as string) || "",
    category: row.category as string,
    region_id: row.region_id as number,
    region_name: row.region_name as string | undefined,
    latitude: parseFloat(row.latitude as string),
    longitude: parseFloat(row.longitude as string),
    images,
    main_image: (row.main_image as string) || images[0] || "",
    source: row.source as Location["source"],
    source_id: row.source_id as string | undefined,
    difficulty: (row.difficulty as string) || "בינוני",
    duration_minutes: row.duration_minutes as number | undefined,
    has_water: row.has_water as boolean | undefined,
    has_shade: row.has_shade as boolean | undefined,
    accessible: row.accessible as boolean | undefined,
    is_featured: row.is_featured as boolean | undefined,
    average_rating: parseFloat(row.average_rating as string) || 4.0,
    photo_credit: (row.photo_credit as string) || undefined,
    uploaded_by: (row.uploaded_by as string) || undefined,
    created_at: row.created_at as Date,
    updated_at: row.updated_at as Date,
  };
}

/**
 * Maps a SLIM DB row → Location.
 * Only the columns fetched by getLocations() for list/explore/map views.
 * description, source, source_id, created_at, updated_at are NOT fetched
 * in list queries — they add significant payload for no UI benefit.
 */
function rowToLocationSlim(row: Record<string, unknown>): Location {
  return {
    id: row.id as number,
    name: row.name as string,
    description: "",                        // not fetched in list — loaded lazily in detail
    category: row.category as string,
    region_id: row.region_id as number,
    region_name: row.region_name as string | undefined,
    latitude: parseFloat(row.latitude as string),
    longitude: parseFloat(row.longitude as string),
    images: [],                        // not fetched in list — main_image is enough
    main_image: (row.main_image as string) || "",
    source: "manual",                  // not needed in list view
    difficulty: (row.difficulty as string) || "בינוני",
    duration_minutes: row.duration_minutes as number | undefined,
    has_water: row.has_water as boolean | undefined,
    has_shade: row.has_shade as boolean | undefined,
    accessible: row.accessible as boolean | undefined,
    is_featured: row.is_featured as boolean | undefined,
    average_rating: parseFloat(row.average_rating as string) || 4.0,
    photo_credit: (row.photo_credit as string) || undefined,
    uploaded_by: (row.uploaded_by as string) || undefined,
    created_at: new Date(0),               // not needed in list view
    updated_at: new Date(0),
  };
}

// ── Slim column list for list/explore/map queries ─────────────────────────────
// Excludes: description (~300 chars avg), images[] (JSON array), source,
// source_id, created_at, updated_at — none are rendered in card/marker UI.
const LIST_COLUMNS = `
  l.id, l.name, l.category,
  l.latitude, l.longitude,
  l.main_image,
  l.difficulty, l.duration_minutes,
  l.has_water, l.has_shade, l.accessible, l.is_featured,
  l.average_rating,
  l.photo_credit, l.uploaded_by,
  l.region_id,
  r.name AS region_name
`;

// ── getLocations (Explore + MapView list) ─────────────────────────────────────

export async function getLocations(query: LocationQuery): Promise<LocationWithDistance[]> {
  const cacheKey = `locations:list:${JSON.stringify(query)}`;
  const cached = cacheGet<LocationWithDistance[]>(cacheKey);
  if (cached) return cached;

  const conditions: string[] = [];
  const params: unknown[] = [];

  // Region filter — matches slug OR display name
  if (query.region) {
    params.push(query.region);
    conditions.push(`(r.slug = $${params.length} OR r.name = $${params.length})`);
  }

  // Category exact match
  if (query.category) {
    params.push(query.category);
    conditions.push(`l.category = $${params.length}`);
  }

  // Difficulty exact match
  if (query.difficulty) {
    params.push(query.difficulty);
    conditions.push(`l.difficulty = $${params.length}`);
  }

  // Boolean feature flags — use partial indexes (see migration_performance.sql)
  if (query.has_water) conditions.push(`l.has_water = TRUE`);
  if (query.has_shade) conditions.push(`l.has_shade = TRUE`);
  if (query.accessible) conditions.push(`l.accessible = TRUE`);

  // Full-text search — uses GIN index on search_vec (much faster than ILIKE)
  // Falls back to ILIKE if the search_vec column doesn't exist yet (pre-migration)
  if (query.search) {
    params.push(query.search);
    conditions.push(`(
      l.search_vec @@ plainto_tsquery('simple', $${params.length})
      OR l.name ILIKE $${params.length + 1}
    )`);
    params.push(`%${query.search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  // Cap limit at 100 for list views (was 500 — reduces payload ~5×)
  const limit = Math.min(query.limit ?? 40, 100);
  const offset = query.offset ?? 0;
  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  // Proximity sort: add distance column when user coords are provided
  const hasCoords =
    query.user_lat !== undefined && query.user_lng !== undefined;

  let distanceSelect = "";
  let orderBy = "ORDER BY l.average_rating DESC, l.name";

  if (hasCoords) {
    params.push(query.user_lng!);   // MakePoint(lng, lat)
    const lngIdx = params.length;
    params.push(query.user_lat!);
    const latIdx = params.length;
    distanceSelect = `,
      ST_Distance(
        l.geom::geography,
        ST_SetSRID(ST_MakePoint($${lngIdx}, $${latIdx}), 4326)::geography
      ) AS distance_meters`;
    orderBy = `ORDER BY distance_meters ASC`;
  }

  const sql = `
    SELECT
      ${LIST_COLUMNS}
      ${distanceSelect}
    FROM locations l
    LEFT JOIN regions r ON l.region_id = r.id
    ${where}
    ${orderBy}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await rawDb.query(sql, params);

  const result = rows.map(row => {
    const loc = rowToLocationSlim(row) as LocationWithDistance;
    if (row.distance_meters !== undefined && row.distance_meters !== null) {
      loc.distance_meters = parseFloat(row.distance_meters as string);
    }
    return loc;
  });

  cacheSet(cacheKey, result, LIST_CACHE_TTL);
  return result;
}

// ── getTotalCount (for pagination metadata) ───────────────────────────────────

export async function getFilteredCount(query: Omit<LocationQuery, "limit" | "offset" | "user_lat" | "user_lng">): Promise<number> {
  const cacheKey = `locations:count:${JSON.stringify(query)}`;
  const cached = cacheGet<number>(cacheKey);
  if (cached) return cached;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.region) {
    params.push(query.region);
    conditions.push(`(r.slug = $${params.length} OR r.name = $${params.length})`);
  }
  if (query.category) {
    params.push(query.category);
    conditions.push(`l.category = $${params.length}`);
  }
  if (query.difficulty) {
    params.push(query.difficulty);
    conditions.push(`l.difficulty = $${params.length}`);
  }
  if (query.has_water) conditions.push(`l.has_water = TRUE`);
  if (query.has_shade) conditions.push(`l.has_shade = TRUE`);
  if (query.accessible) conditions.push(`l.accessible = TRUE`);
  if (query.search) {
    params.push(query.search);
    conditions.push(`(
      l.search_vec @@ plainto_tsquery('simple', $${params.length})
      OR l.name ILIKE $${params.length + 1}
    )`);
    params.push(`%${query.search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await rawDb.query(
    `SELECT COUNT(*) AS n
     FROM locations l
     LEFT JOIN regions r ON l.region_id = r.id
     ${where}`,
    params
  );

  const count = parseInt(rows[0].n as string);
  cacheSet(cacheKey, count, LIST_CACHE_TTL);
  return count;
}

// ── getLocationMeta (filter dropdown data) ────────────────────────────────────
// Replaces the expensive allPois.map(p => p.category) derivation in Explore.tsx.
// Cached for 1 hour — categories/difficulties almost never change.

export async function getLocationMeta(): Promise<LocationMeta> {
  const cacheKey = "locations:meta";
  const cached = cacheGet<LocationMeta>(cacheKey);
  if (cached) return cached;

  const { rows } = await rawDb.query(`
    SELECT
      ARRAY_AGG(DISTINCT category ORDER BY category) FILTER (WHERE category IS NOT NULL) AS categories,
      ARRAY_AGG(DISTINCT difficulty ORDER BY difficulty) FILTER (WHERE difficulty IS NOT NULL) AS difficulties,
      COUNT(*)::int AS total_count
    FROM locations
  `);

  const meta: LocationMeta = {
    categories: (rows[0].categories as string[]) || [],
    difficulties: (rows[0].difficulties as string[]) || [],
    total_count: rows[0].total_count as number,
  };

  cacheSet(cacheKey, meta, 3600); // 1 hour
  return meta;
}

// ── getLocationById (POIDetail — full row, unchanged) ─────────────────────────

export async function getLocationById(id: number): Promise<Location | null> {
  const cacheKey = `locations:id:${id}`;
  const cached = cacheGet<Location>(cacheKey);
  if (cached) return cached;

  const { rows } = await rawDb.query(
    `SELECT l.*, r.name AS region_name, r.slug AS region_slug
     FROM locations l
     LEFT JOIN regions r ON l.region_id = r.id
     WHERE l.id = $1`,
    [id]
  );
  if (!rows.length) return null;
  const result = rowToLocation(rows[0]);
  cacheSet(cacheKey, result, LIST_CACHE_TTL);
  return result;
}

// ── getNearbyLocations (PostGIS ST_DWithin, unchanged) ────────────────────────

export async function getNearbyLocations(
  locationId: number,
  limit: number = 6,
  radiusMeters: number = 25000
): Promise<NearbyLocation[]> {
  const ref = await getLocationById(locationId);
  if (!ref) throw Object.assign(new Error("Location not found"), { code: "NOT_FOUND" });

  const cacheKey = `locations:nearby:${locationId}:${limit}:${radiusMeters}`;
  const cached = cacheGet<NearbyLocation[]>(cacheKey);
  if (cached) return cached;

  const { rows } = await rawDb.query(
    `SELECT
       ${LIST_COLUMNS},
       ST_Distance(
         l.geom::geography,
         ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
       ) AS distance_meters
     FROM locations l
     LEFT JOIN regions r ON l.region_id = r.id
     WHERE l.id <> $3
       AND ST_DWithin(
         l.geom::geography,
         ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
         $4
       )
     ORDER BY distance_meters ASC
     LIMIT $5`,
    [ref.latitude, ref.longitude, locationId, radiusMeters, limit]
  );

  const result = rows.map(row => ({
    ...rowToLocationSlim(row),
    distance_meters: parseFloat(row.distance_meters as string),
  }));

  cacheSet(cacheKey, result, LIST_CACHE_TTL);
  return result;
}

// ── getFeaturedLocations (slim columns) ───────────────────────────────────────

export async function getFeaturedLocations(limit: number = 10): Promise<Location[]> {
  const cacheKey = `locations:featured:${limit}`;
  const cached = cacheGet<Location[]>(cacheKey);
  if (cached) return cached;

  let rows: Record<string, unknown>[];
  try {
    ({ rows } = await rawDb.query(
      `SELECT ${LIST_COLUMNS}
       FROM   locations l
       LEFT   JOIN regions r ON l.region_id = r.id
       WHERE  l.is_featured = TRUE
       ORDER  BY l.average_rating DESC, l.name
       LIMIT  $1`,
      [limit]
    ));
  } catch (err: any) {
    if (err?.code === "42703") {
      console.warn("[getFeaturedLocations] is_featured column missing — falling back to top-rated. Run migration.");
      ({ rows } = await rawDb.query(
        `SELECT ${LIST_COLUMNS}
         FROM   locations l
         LEFT   JOIN regions r ON l.region_id = r.id
         ORDER  BY l.average_rating DESC, l.name
         LIMIT  $1`,
        [limit]
      ));
    } else {
      throw err;
    }
  }

  const result = rows.map(rowToLocationSlim);
  cacheSet(cacheKey, result, LIST_CACHE_TTL);
  return result;
}

// ── getNearbyUserLocations (slim columns) ─────────────────────────────────────

export async function getNearbyUserLocations(
  lat: number,
  lng: number,
  limit: number = 8,
  radiusMeters: number = 30000
): Promise<NearbyLocation[]> {
  const cacheKey = `locations:nearby-user:${lat.toFixed(4)}:${lng.toFixed(4)}:${limit}:${radiusMeters}`;
  const cached = cacheGet<NearbyLocation[]>(cacheKey);
  if (cached) return cached;

  const { rows } = await rawDb.query(
    `SELECT
       ${LIST_COLUMNS},
       ST_Distance(
         l.geom::geography,
         ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
       ) AS distance_meters
     FROM   locations l
     LEFT   JOIN regions r ON l.region_id = r.id
     WHERE  ST_DWithin(
               l.geom::geography,
               ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
               $3
             )
     ORDER  BY distance_meters ASC
     LIMIT  $4`,
    [lat, lng, radiusMeters, limit]
  );

  const result = rows.map(row => ({
    ...rowToLocationSlim(row),
    distance_meters: parseFloat(row.distance_meters as string),
  }));

  cacheSet(cacheKey, result, LIST_CACHE_TTL);
  return result;
}

// ── getLocationsInBounds (slim columns) ───────────────────────────────────────

export async function getLocationsInBounds(bounds: MapBounds): Promise<Location[]> {
  const { north, south, east, west } = bounds;
  const cacheKey = `locations:map:${north.toFixed(4)}:${south.toFixed(4)}:${east.toFixed(4)}:${west.toFixed(4)}`;
  const cached = cacheGet<Location[]>(cacheKey);
  if (cached) return cached;

  const { rows } = await rawDb.query(
    `SELECT ${LIST_COLUMNS}
     FROM locations l
     LEFT JOIN regions r ON l.region_id = r.id
     WHERE ST_Within(l.geom::geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
     ORDER BY l.average_rating DESC
     LIMIT 500`,
    [west, south, east, north]
  );

  const result = rows.map(rowToLocationSlim);
  cacheSet(cacheKey, result, MAP_CACHE_TTL);
  return result;
}

// ── getLocationClusters (unchanged — already minimal columns) ─────────────────

export async function getLocationClusters(bounds?: MapBounds): Promise<Cluster[]> {
  let where = "";
  const params: number[] = [];

  if (bounds) {
    where = `WHERE ST_Within(l.geom::geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))`;
    params.push(bounds.west, bounds.south, bounds.east, bounds.north);
  }

  const { rows } = await rawDb.query(
    `SELECT
       ROUND(l.latitude::numeric, 1)  AS lat,
       ROUND(l.longitude::numeric, 1) AS lng,
       COUNT(*)                       AS count,
       ARRAY_AGG(l.id)                AS ids,
       MODE() WITHIN GROUP (ORDER BY l.category) AS category
     FROM locations l
     ${where}
     GROUP BY ROUND(l.latitude::numeric, 1), ROUND(l.longitude::numeric, 1)
     ORDER BY count DESC`,
    params
  );

  return rows.map(r => ({
    lat: parseFloat(r.lat as string),
    lng: parseFloat(r.lng as string),
    count: parseInt(r.count as string),
    ids: r.ids as number[],
    category: r.category as string | undefined,
  }));
}

// ── getTotalCount ─────────────────────────────────────────────────────────────

export async function getTotalCount(): Promise<number> {
  const { rows } = await rawDb.query("SELECT COUNT(*) FROM locations");
  return parseInt(rows[0].count as string);
}

// ── upsertLocation (unchanged) ────────────────────────────────────────────────

export interface UpdateLocationInput {
  name?: string;
  description?: string;
  category?: string;
  difficulty?: string;
  duration_minutes?: number;
  has_water?: boolean;
  has_shade?: boolean;
  accessible?: boolean;
  is_featured?: boolean;
  main_image?: string;
  images?: string[];
  photo_credit?: string;
  average_rating?: number;
  region_id?: number;
  latitude?: number;
  longitude?: number;
  source?: string;
  source_id?: string;
  uploaded_by?: string;
}

export async function upsertLocation(
  loc: Partial<Location> & { name: string; latitude: number; longitude: number; source: string }
): Promise<number> {
  const {
    name, description = "", category = "טבע",
    region_id, latitude, longitude,
    images = [], main_image,
    source, source_id,
    difficulty = "בינוני", duration_minutes,
    has_water = false, has_shade = false, accessible = false,
    average_rating = 4.0,
  } = loc;

  const { rows } = await rawDb.query(
    `INSERT INTO locations
      (name, description, category, region_id, latitude, longitude, geom,
       images, main_image, source, source_id, difficulty, duration_minutes,
       has_water, has_shade, accessible, average_rating)
     VALUES ($1,$2,$3,$4,$5,$6,
       ST_SetSRID(ST_MakePoint($7,$6), 4326)::geography,
       $8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (source, source_id) DO UPDATE SET
       name        = EXCLUDED.name,
       description = EXCLUDED.description,
       latitude    = EXCLUDED.latitude,
       longitude   = EXCLUDED.longitude,
       geom        = EXCLUDED.geom,
       images      = EXCLUDED.images,
       main_image  = EXCLUDED.main_image,
       updated_at  = NOW()
     RETURNING id`,
    [
      name, description, category, region_id || null,
      latitude, longitude, longitude,
      JSON.stringify(images), main_image || images[0] || null,
      source, source_id || null, difficulty, duration_minutes || null,
      has_water, has_shade, accessible, average_rating,
    ]
  );
  return rows[0].id as number;
}

export async function updateLocation(id: number, input: UpdateLocationInput): Promise<Location> {
  const allowed: (keyof UpdateLocationInput)[] = [
    "name", "description", "category", "difficulty",
    "duration_minutes", "has_water", "has_shade", "accessible",
    "is_featured", "main_image", "images", "photo_credit",
    "average_rating", "region_id", "latitude", "longitude",
    "source", "source_id", "uploaded_by",
  ];

  const fields: string[] = [];
  const params: unknown[] = [];

  for (const key of allowed) {
    if (input[key] !== undefined) {
      params.push(key === "images" ? JSON.stringify(input[key]) : input[key]);
      fields.push(`${key} = $${params.length}`);
    }
  }

  if (!fields.length) throw Object.assign(new Error("No fields to update"), { code: "VALIDATION_ERROR" });

  params.push(id);
  const { rows } = await rawDb.query(
    `UPDATE locations
     SET    ${fields.join(", ")}, updated_at = NOW()
     WHERE  id = $${params.length}
     RETURNING *, (SELECT name FROM regions WHERE id = region_id) AS region_name`,
    params
  );

  if (!rows.length) throw Object.assign(new Error("Location not found"), { code: "NOT_FOUND" });
  return rowToLocation(rows[0]);
}

export async function deleteLocation(id: number): Promise<boolean> {
  const { rows } = await rawDb.query(
    `DELETE FROM locations WHERE id = $1 RETURNING id`,
    [id]
  );
  return rows.length > 0;
}