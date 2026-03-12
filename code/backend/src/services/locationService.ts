import { db } from '../config/db';
import { cacheGet, cacheSet } from '../config/cache'
import type { Location, LocationQuery, MapBounds, Cluster } from '../models/types';

const MAP_CACHE_TTL = parseInt(process.env.MAP_CACHE_TTL || '30');
const LIST_CACHE_TTL = parseInt(process.env.LIST_CACHE_TTL || '300');

// ── Helpers ────────────────────────────────────────────────────────────────

function rowToLocation(row: any): Location {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    category: row.category,
    region_id: row.region_id,
    region_name: row.region_name,
    latitude: parseFloat(row.latitude),
    longitude: parseFloat(row.longitude),
    images: Array.isArray(row.images) ? row.images : (typeof row.images === 'string' ? JSON.parse(row.images) : []),
    main_image: row.main_image || (Array.isArray(row.images) && row.images[0]) || '',
    source: row.source,
    source_id: row.source_id,
    difficulty: row.difficulty || 'בינוני',
    duration_minutes: row.duration_minutes,
    has_water: row.has_water,
    has_shade: row.has_shade,
    accessible: row.accessible,
    average_rating: parseFloat(row.average_rating) || 4.0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getLocations(query: LocationQuery): Promise<Location[]> {
  const cacheKey = `locations:list:${JSON.stringify(query)}`;
  const cached = await cacheGet<Location[]>(cacheKey);
  if (cached) return cached;

  const conditions: string[] = [];
  const params: any[] = [];

  // 1. Add dynamic conditions using params.length
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

  if (query.has_water) { conditions.push(`l.has_water = TRUE`); }
  if (query.has_shade) { conditions.push(`l.has_shade = TRUE`); }
  if (query.accessible) { conditions.push(`l.accessible = TRUE`); }

  if (query.search) {
    params.push(`%${query.search}%`);
    conditions.push(`(l.name ILIKE $${params.length} OR l.description ILIKE $${params.length} OR l.category ILIKE $${params.length})`);
  }

  // 2. Build WHERE clause
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // 3. Add Limit & Offset
  const limit = Math.min(query.limit || 200, 500);
  const offset = query.offset || 0;

  params.push(limit);
  const limitIdx = params.length;

  params.push(offset);
  const offsetIdx = params.length;

  // 4. Build final query
  const sql = `
    SELECT l.*, r.name AS region_name, r.slug AS region_slug
    FROM locations l
    LEFT JOIN regions r ON l.region_id = r.id
    ${where}
    ORDER BY l.average_rating DESC, l.name
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await db.query(sql, params);
  const result = rows.map(rowToLocation);
  await cacheSet(cacheKey, result, LIST_CACHE_TTL);
  return result;
}

export async function getLocationById(id: number): Promise<Location | null> {
  const cacheKey = `locations:id:${id}`;
  const cached = await cacheGet<Location>(cacheKey);
  if (cached) return cached;

  const { rows } = await db.query(
    `SELECT l.*, r.name AS region_name, r.slug AS region_slug
     FROM locations l
     LEFT JOIN regions r ON l.region_id = r.id
     WHERE l.id = $1`,
    [id]
  );

  if (!rows.length) return null;
  const result = rowToLocation(rows[0]);
  await cacheSet(cacheKey, result, LIST_CACHE_TTL);
  return result;
}

export async function getLocationsInBounds(bounds: MapBounds): Promise<Location[]> {
  const { north, south, east, west } = bounds;
  const cacheKey = `locations:map:${north.toFixed(4)}:${south.toFixed(4)}:${east.toFixed(4)}:${west.toFixed(4)}`;
  const cached = await cacheGet<Location[]>(cacheKey);
  if (cached) return cached;

  const { rows } = await db.query(
    `SELECT l.*, r.name AS region_name, r.slug AS region_slug
     FROM locations l
     LEFT JOIN regions r ON l.region_id = r.id
     WHERE ST_Within(
       l.geom::geometry,
       ST_MakeEnvelope($1, $2, $3, $4, 4326)
     )
     ORDER BY l.average_rating DESC
     LIMIT 500`,
    [west, south, east, north]
  );

  const result = rows.map(rowToLocation);
  await cacheSet(cacheKey, result, MAP_CACHE_TTL);
  return result;
}

export async function getLocationClusters(bounds?: MapBounds): Promise<Cluster[]> {
  // Simple grid-based clustering using PostGIS
  let where = '';
  const params: number[] = [];

  if (bounds) {
    where = `WHERE ST_Within(l.geom::geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))`;
    params.push(bounds.west, bounds.south, bounds.east, bounds.north);
  }

  // Round coordinates to ~10km grid for clustering
  const { rows } = await db.query(
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
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lng),
    count: parseInt(r.count),
    ids: r.ids,
    category: r.category,
  }));
}

export async function upsertLocation(loc: Partial<Location> & {
  name: string; latitude: number; longitude: number; source: string;
}): Promise<number> {
  const {
    name, description = '', category = 'טבע',
    region_id, latitude, longitude,
    images = [], main_image,
    source, source_id,
    difficulty = 'בינוני', duration_minutes,
    has_water = false, has_shade = false, accessible = false,
    average_rating = 4.0,
  } = loc;

  const { rows } = await db.query(
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
  return rows[0].id;
}

export async function getTotalCount(): Promise<number> {
  const { rows } = await db.query('SELECT COUNT(*) FROM locations');
  return parseInt(rows[0].count);
}