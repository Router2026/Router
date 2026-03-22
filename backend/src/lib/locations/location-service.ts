import { rawDb } from "@/lib/db/raw-client";
import { cacheGet, cacheSet } from "@/lib/cache/mem-cache";

const MAP_CACHE_TTL  = parseInt(process.env.MAP_CACHE_TTL  || "30");
const LIST_CACHE_TTL = parseInt(process.env.LIST_CACHE_TTL || "300");

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
  average_rating: number;
  created_at: Date;
  updated_at: Date;
}

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

function rowToLocation(row: Record<string, unknown>): Location {
  const images = Array.isArray(row.images)
    ? row.images as string[]
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
    average_rating: parseFloat(row.average_rating as string) || 4.0,
    created_at: row.created_at as Date,
    updated_at: row.updated_at as Date,
  };
}

export async function getLocations(query: LocationQuery): Promise<Location[]> {
  const cacheKey = `locations:list:${JSON.stringify(query)}`;
  const cached = cacheGet<Location[]>(cacheKey);
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
  if (query.has_water)  conditions.push(`l.has_water = TRUE`);
  if (query.has_shade)  conditions.push(`l.has_shade = TRUE`);
  if (query.accessible) conditions.push(`l.accessible = TRUE`);
  if (query.search) {
    params.push(`%${query.search}%`);
    conditions.push(`(l.name ILIKE $${params.length} OR l.description ILIKE $${params.length} OR l.category ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(query.limit || 200, 500);
  const offset = query.offset || 0;
  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const sql = `
    SELECT l.*, r.name AS region_name, r.slug AS region_slug
    FROM locations l
    LEFT JOIN regions r ON l.region_id = r.id
    ${where}
    ORDER BY l.average_rating DESC, l.name
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await rawDb.query(sql, params);
  const result = rows.map(rowToLocation);
  cacheSet(cacheKey, result, LIST_CACHE_TTL);
  return result;
}

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

export async function getLocationsInBounds(bounds: MapBounds): Promise<Location[]> {
  const { north, south, east, west } = bounds;
  const cacheKey = `locations:map:${north.toFixed(4)}:${south.toFixed(4)}:${east.toFixed(4)}:${west.toFixed(4)}`;
  const cached = cacheGet<Location[]>(cacheKey);
  if (cached) return cached;

  const { rows } = await rawDb.query(
    `SELECT l.*, r.name AS region_name, r.slug AS region_slug
     FROM locations l
     LEFT JOIN regions r ON l.region_id = r.id
     WHERE ST_Within(l.geom::geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
     ORDER BY l.average_rating DESC
     LIMIT 500`,
    [west, south, east, north]
  );

  const result = rows.map(rowToLocation);
  cacheSet(cacheKey, result, MAP_CACHE_TTL);
  return result;
}

export async function getLocationClusters(bounds?: MapBounds): Promise<Cluster[]> {
  let where = "";
  const params: number[] = [];

  if (bounds) {
    where = `WHERE ST_Within(l.geom::geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))`;
    params.push(bounds.west, bounds.south, bounds.east, bounds.north);
  }

  const { rows } = await rawDb.query(
    `SELECT
       ROUND(l.latitude::numeric, 1) AS lat,
       ROUND(l.longitude::numeric, 1) AS lng,
       COUNT(*) AS count,
       ARRAY_AGG(l.id) AS ids,
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

export async function upsertLocation(loc: Partial<Location> & {
  name: string; latitude: number; longitude: number; source: string;
}): Promise<number> {
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
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       geom = EXCLUDED.geom,
       images = EXCLUDED.images,
       main_image = EXCLUDED.main_image,
       updated_at = NOW()
     RETURNING id`,
    [name, description, category, region_id || null,
      latitude, longitude, longitude,
      JSON.stringify(images), main_image || images[0] || null,
      source, source_id || null, difficulty, duration_minutes || null,
      has_water, has_shade, accessible, average_rating]
  );
  return rows[0].id as number;
}

export async function getTotalCount(): Promise<number> {
  const { rows } = await rawDb.query("SELECT COUNT(*) FROM locations");
  return parseInt(rows[0].count as string);
}

// ── Admin: update a location's fields (including main_image) ─────────────────

export interface UpdateLocationInput {
  name?:             string;
  description?:      string;
  category?:         string;
  difficulty?:       string;
  duration_minutes?: number;
  has_water?:        boolean;
  has_shade?:        boolean;
  accessible?:       boolean;
  main_image?:       string;
  images?:           string[];
}

export async function updateLocation(
  id:    number,
  input: UpdateLocationInput,
): Promise<Location> {
  const allowed: (keyof UpdateLocationInput)[] = [
    "name", "description", "category", "difficulty",
    "duration_minutes", "has_water", "has_shade", "accessible",
    "main_image", "images",
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
