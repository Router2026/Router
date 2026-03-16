import { rawDb } from "@/lib/db/raw-client";
import { cacheGet, cacheSet } from "@/lib/cache/mem-cache";

export interface Region {
  id: number;
  name: string;
  name_en: string;
  slug: string;
  center_lat: number;
  center_lng: number;
  zoom: number;
  radius_meters: number;
  color: string;
  // [lat, lng] pairs — Leaflet order, ready to use directly
  polygon_coords: [number, number][] | null;
  created_at: Date;
}

function rowToRegion(r: Record<string, unknown>): Region {
  return {
    ...r,
    center_lat: parseFloat(r.center_lat as string),
    center_lng: parseFloat(r.center_lng as string),
    radius_meters: parseInt(r.radius_meters as string),
    polygon_coords: (r.polygon_coords as [number, number][] | null) ?? null,
  } as Region;
}

export async function getAllRegions(): Promise<Region[]> {
  const cacheKey = "regions:all";
  const cached = cacheGet<Region[]>(cacheKey);
  if (cached) return cached;

  const { rows } = await rawDb.query(
    `SELECT id, name, name_en, slug, center_lat, center_lng, zoom, radius_meters, color, polygon_coords, created_at
     FROM regions ORDER BY name`,
  );

  const regions = rows.map(rowToRegion);
  cacheSet(cacheKey, regions, 3600);
  return regions;
}

export async function getRegionBySlug(slug: string): Promise<Region | null> {
  const { rows } = await rawDb.query(
    `SELECT id, name, name_en, slug, center_lat, center_lng, zoom, radius_meters, color, polygon_coords, created_at
     FROM regions WHERE slug = $1 OR name = $1`,
    [slug],
  );
  if (!rows.length) return null;
  return rowToRegion(rows[0]);
}

export async function getRegionIdByName(name: string): Promise<number | null> {
  const { rows } = await rawDb.query(
    `SELECT id FROM regions WHERE name = $1 OR slug = $1 OR name_en ILIKE $1`,
    [name],
  );
  return rows.length ? (rows[0].id as number) : null;
}
