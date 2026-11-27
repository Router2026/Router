// Save a trip for use without a connection: the trip itself goes to localStorage, and the
// basemap tiles around its stops go straight into the service worker's tile cache, so the
// map still draws in a wadi with no signal.
//
// Tiles are written into the same cache name the Workbox CacheFirst rule reads
// (vite.config.ts → 'basemap-tiles-v2'), so Leaflet's normal tile requests hit them offline.

import type { Trip } from '../api';
import { BASEMAP_URL } from './mapTiles';

const STORE_KEY = 'router_offline_trips';
export const TILE_CACHE = 'basemap-tiles-v2';
const IMAGE_CACHE = 'supabase-images-v1';

/** Overview zooms cover the whole day; detail zooms only the area right around each stop. */
const OVERVIEW_ZOOMS = [9, 10, 11, 12, 13];
const DETAIL_ZOOMS = [14, 15, 16];
/** Tiles are ~18KB, so this keeps one trip around 15MB at most. */
export const MAX_TILES = 800;
/** ~1.5km around a stop at the detail zooms. */
const DETAIL_RADIUS_DEG = 0.015;

export interface SavedTrip { trip: Trip; savedAt: string; tiles: number }

type Store = Record<string, SavedTrip>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* storage full or blocked */ }
}

export function getSavedTrip(id: string): SavedTrip | null {
  return readStore()[id] ?? null;
}

export function listSavedTrips(): SavedTrip[] {
  return Object.values(readStore()).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function isTripSaved(id: string): boolean {
  return id in readStore();
}

/** Keeps the stored copy current when the trip is loaded online again. */
export function refreshSavedTrip(trip: Trip) {
  const store = readStore();
  if (!store[trip.id]) return;
  store[trip.id] = { ...store[trip.id], trip };
  writeStore(store);
}

export function removeSavedTrip(id: string) {
  const store = readStore();
  delete store[id];
  writeStore(store);
}

/** On logout: saved trips are personal, don't leave them on a shared device. */
export function clearSavedTrips() {
  try { localStorage.removeItem(STORE_KEY); } catch { /* blocked */ }
}

// ── Tile math (Web Mercator, same scheme Leaflet uses) ──────────────────────

export function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

export function latToTileY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

interface Box { minLat: number; maxLat: number; minLng: number; maxLng: number }

function tilesInBox(box: Box, z: number): string[] {
  const x0 = lngToTileX(box.minLng, z), x1 = lngToTileX(box.maxLng, z);
  const y0 = latToTileY(box.maxLat, z), y1 = latToTileY(box.minLat, z);
  const out: string[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push(`${z}/${y}/${x}`);
  return out;
}

/**
 * Tile keys ("z/y/x") to save for these points: the whole route at overview zooms, a small
 * square around every stop at detail zooms. Highest zooms are dropped first to stay under MAX_TILES.
 */
export function tilesForPoints(points: { lat: number; lng: number }[], maxTiles = MAX_TILES): string[] {
  if (points.length === 0) return [];
  const lats = points.map(p => p.lat), lngs = points.map(p => p.lng);
  const pad = 0.03;
  const box: Box = {
    minLat: Math.min(...lats) - pad, maxLat: Math.max(...lats) + pad,
    minLng: Math.min(...lngs) - pad, maxLng: Math.max(...lngs) + pad,
  };

  const byZoom: string[][] = OVERVIEW_ZOOMS.map(z => tilesInBox(box, z));
  for (const z of DETAIL_ZOOMS) {
    const set = new Set<string>();
    for (const p of points) {
      tilesInBox({
        minLat: p.lat - DETAIL_RADIUS_DEG, maxLat: p.lat + DETAIL_RADIUS_DEG,
        minLng: p.lng - DETAIL_RADIUS_DEG, maxLng: p.lng + DETAIL_RADIUS_DEG,
      }, z).forEach(t => set.add(t));
    }
    byZoom.push([...set]);
  }

  const out: string[] = [];
  for (const level of byZoom) {
    if (out.length + level.length > maxTiles) break;
    out.push(...level);
  }
  return out;
}

export function tileUrl(key: string): string {
  const [z, y, x] = key.split('/');
  return BASEMAP_URL.replace('{z}', z).replace('{y}', y).replace('{x}', x);
}

async function cacheUrls(cacheName: string, urls: string[], onProgress?: (done: number) => void): Promise<number> {
  const cache = await caches.open(cacheName);
  let done = 0, saved = 0;
  const queue = [...urls];
  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      try {
        if (!(await cache.match(url))) {
          const res = await fetch(url, { mode: 'cors' });
          if (res.ok) await cache.put(url, res);
        }
        saved++;
      } catch { /* one missing tile is not worth failing the save */ }
      onProgress?.(++done);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return saved;
}

/**
 * Saves the trip and its map for offline use. Resolves with the number of tiles stored.
 * Throws only if nothing could be stored (no Cache API, or no tiles fetched at all).
 */
export async function saveTripOffline(trip: Trip, onProgress?: (done: number, total: number) => void): Promise<SavedTrip> {
  const points = (trip.stops || [])
    .filter(s => s.latitude != null && s.longitude != null)
    .map(s => ({ lat: Number(s.latitude), lng: Number(s.longitude) }));
  const tiles = tilesForPoints(points).map(tileUrl);
  const images = (trip.stops || [])
    .map(s => s.main_image)
    .filter((u): u is string => !!u && /\.supabase\.co\/storage\//.test(u));
  const total = tiles.length + images.length;

  let stored = 0;
  if (typeof caches !== 'undefined' && total > 0) {
    stored = await cacheUrls(TILE_CACHE, tiles, d => onProgress?.(d, total));
    await cacheUrls(IMAGE_CACHE, images, d => onProgress?.(tiles.length + d, total));
    if (tiles.length > 0 && stored === 0) throw new Error('no tiles stored');
  }

  const entry: SavedTrip = { trip, savedAt: new Date().toISOString(), tiles: stored };
  const store = readStore();
  store[trip.id] = entry;
  writeStore(store);
  return entry;
}
