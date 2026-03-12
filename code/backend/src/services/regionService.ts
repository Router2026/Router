import { db } from '../config/db';
import { cacheGet, cacheSet } from '../config/cache';
import type { Region } from '../models/types';

export async function getAllRegions(): Promise<Region[]> {
  const cacheKey = 'regions:all';
  const cached = await cacheGet<Region[]>(cacheKey);
  if (cached) return cached;

  const { rows } = await db.query(
    `SELECT id, name, name_en, slug, center_lat, center_lng, zoom, radius_meters, color, created_at
     FROM regions ORDER BY name`
  );

  const regions = rows.map(r => ({
    ...r,
    center_lat: parseFloat(r.center_lat),
    center_lng: parseFloat(r.center_lng),
    radius_meters: parseInt(r.radius_meters),
  })) as Region[];

  await cacheSet(cacheKey, regions, 3600); // 1 hour TTL for regions
  return regions;
}

export async function getRegionBySlug(slug: string): Promise<Region | null> {
  const { rows } = await db.query(
    `SELECT id, name, name_en, slug, center_lat, center_lng, zoom, radius_meters, color, created_at
     FROM regions WHERE slug = $1 OR name = $1`,
    [slug]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    ...r,
    center_lat: parseFloat(r.center_lat),
    center_lng: parseFloat(r.center_lng),
    radius_meters: parseInt(r.radius_meters),
  };
}

export async function getRegionIdByName(name: string): Promise<number | null> {
  const { rows } = await db.query(
    `SELECT id FROM regions WHERE name = $1 OR slug = $1 OR name_en ILIKE $1`,
    [name]
  );
  return rows.length ? rows[0].id : null;
}
