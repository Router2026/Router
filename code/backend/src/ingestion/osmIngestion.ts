/**
 * OSM Ingestion Service
 * Uses the Overpass API (OpenStreetMap) to fetch real nature/tourism
 * locations in Israel. This is the most reliable free data source.
 *
 * Overpass API is open and requires no key.
 * Israel is bounding box: 29.4 / 34.2 / 33.4 / 35.9 (S/W/N/E)
 */

import axios from 'axios';
import { upsertLocation, getLocationsInBounds } from '../services/locationService';
import { getRegionIdByName } from '../services/regionService';
import { db } from '../config/db';

const OVERPASS_URL = process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter';

// Map OSM tags to Hebrew categories
const CATEGORY_MAP: Record<string, string> = {
  waterfall: 'טבע',
  spring: 'מעיין',
  viewpoint: 'מצפה',
  nature_reserve: 'שמורת טבע',
  national_park: 'שמורת טבע',
  archaeological_site: 'אתר היסטורי',
  ruins: 'אתר היסטורי',
  castle: 'אתר היסטורי',
  beach: 'חוף',
  cave_entrance: 'מערה',
  peak: 'מצפה',
  forest: 'יער',
  stream: 'נחל',
  river: 'נחל',
  geological: 'גיאולוגיה',
};

function osmTagToCategory(tags: Record<string, string>): string {
  if (tags.waterway === 'waterfall') return 'טבע';
  if (tags.natural === 'spring') return 'מעיין';
  if (tags.tourism === 'viewpoint') return 'מצפה';
  if (tags.leisure === 'nature_reserve') return 'שמורת טבע';
  if (tags.boundary === 'national_park') return 'שמורת טבע';
  if (tags.historic === 'archaeological_site') return 'אתר היסטורי';
  if (tags.historic === 'castle') return 'אתר היסטורי';
  if (tags.historic === 'ruins') return 'אתר היסטורי';
  if (tags.natural === 'beach') return 'חוף';
  if (tags.natural === 'cave_entrance') return 'מערה';
  if (tags.natural === 'peak') return 'מצפה';
  if (tags.natural === 'wood' || tags.landuse === 'forest') return 'יער';
  if (tags.waterway === 'stream' || tags.waterway === 'river') return 'נחל';
  if (tags.geological) return 'גיאולוגיה';
  return 'טבע';
}

function getNameFromTags(tags: Record<string, string>): string | null {
  return tags['name:he'] || tags.name || tags['name:en'] || null;
}

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
}

async function getRegionForCoord(lat: number, lng: number): Promise<number | null> {
  const { rows } = await db.query(
    `SELECT id FROM regions
     WHERE ST_Within(ST_MakePoint($1, $2)::geometry, geom)
     LIMIT 1`,
    [lng, lat]
  );
  return rows.length ? rows[0].id : null;
}

// ── Main ingestion functions ───────────────────────────────────────────────

export async function ingestOSMNatureLocations(
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  // Overpass QL query for nature/tourism POIs in Israel
  const query = `
    [out:json][timeout:60];
    (
      node["waterway"="waterfall"](29.4,34.2,33.4,35.9);
      node["natural"="spring"]["name"](29.4,34.2,33.4,35.9);
      node["tourism"="viewpoint"]["name"](29.4,34.2,33.4,35.9);
      node["historic"="archaeological_site"]["name"](29.4,34.2,33.4,35.9);
      node["historic"="castle"]["name"](29.4,34.2,33.4,35.9);
      node["natural"="cave_entrance"]["name"](29.4,34.2,33.4,35.9);
      node["natural"="peak"]["name"](29.4,34.2,33.4,35.9);
      node["natural"="beach"]["name"](29.4,34.2,33.4,35.9);
    );
    out body;
  `.trim();

  const response = await axios.post(OVERPASS_URL, `data=${encodeURIComponent(query)}`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 90000,
  });

  const elements: OsmElement[] = response.data.elements || [];
  console.log(`📍 OSM returned ${elements.length} elements`);

  let processed = 0;
  const total = elements.length;

  for (const el of elements) {
    const lat = el.lat || el.center?.lat;
    const lon = el.lon || el.center?.lon;
    if (!lat || !lon) continue;

    const name = getNameFromTags(el.tags);
    if (!name) continue;

    const category = osmTagToCategory(el.tags);
    const region_id = await getRegionForCoord(lat, lon);
    const description = el.tags['description:he'] || el.tags.description || '';

    await upsertLocation({
      name,
      description,
      category,
      region_id: region_id || undefined,
      latitude: lat,
      longitude: lon,
      source: 'osm',
      source_id: `osm-${el.type}-${el.id}`,
      images: [],
    });

    processed++;
    if (onProgress && processed % 10 === 0) {
      onProgress(processed, total);
    }
  }

  return processed;
}

// ── INPA ingestion via Israel Gov Data Portal ─────────────────────────────

interface GovDataRecord {
  _id: number;
  [key: string]: any;
}

export async function ingestINPA(
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const resourceId = process.env.INPA_RESOURCE_ID || '0d4df0bb-2777-4f06-bde3-c7f00af71fd8';
  const apiBase = process.env.ISRAEL_GOV_API || 'https://api.data.gov.il/api/3/action/datastore_search';
  const limit = 100;
  let offset = 0;
  let processed = 0;
  let total = 0;

  try {
    // First call to get total
    const first = await axios.get(apiBase, {
      params: { resource_id: resourceId, limit: 1 },
      timeout: 15000,
    });
    total = first.data?.result?.total || 0;
    console.log(`📋 INPA: ${total} total records`);

    while (offset < total || offset === 0) {
      const resp = await axios.get(apiBase, {
        params: { resource_id: resourceId, limit, offset },
        timeout: 15000,
      });

      const records: GovDataRecord[] = resp.data?.result?.records || [];
      if (!records.length) break;

      for (const rec of records) {
        // Try common coordinate field names
        const lat = parseFloat(rec.Y || rec.lat || rec.latitude || rec.Latitude || 0);
        const lng = parseFloat(rec.X || rec.lon || rec.longitude || rec.Longitude || 0);
        if (!lat || !lng || Math.abs(lat) < 1 || Math.abs(lng) < 1) continue;

        const name = rec.Name || rec.name || rec.NAME || rec['שם'] || `אתר INPA ${rec._id}`;
        const desc = rec.Description || rec.description || rec['תיאור'] || '';
        const region_id = await getRegionForCoord(lat, lng);

        await upsertLocation({
          name,
          description: desc,
          category: 'שמורת טבע',
          region_id: region_id || undefined,
          latitude: lat,
          longitude: lng,
          source: 'inpa',
          source_id: `inpa-${rec._id}`,
          images: [],
        });
        processed++;
      }

      if (onProgress) onProgress(processed, total);
      offset += limit;
      if (records.length < limit) break;
    }
  } catch (err: any) {
    console.error('INPA ingestion error:', err.message);
    throw err;
  }

  return processed;
}

// ── KKL ingestion via Israel Gov Data Portal ──────────────────────────────

export async function ingestKKL(
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const resourceId = process.env.KKL_RESOURCE_ID || '2a6ae628-b78d-4e8e-b4a6-8cd56fd78913';
  const apiBase = process.env.ISRAEL_GOV_API || 'https://api.data.gov.il/api/3/action/datastore_search';
  const limit = 100;
  let offset = 0;
  let processed = 0;
  let total = 0;

  try {
    const first = await axios.get(apiBase, {
      params: { resource_id: resourceId, limit: 1 },
      timeout: 15000,
    });
    total = first.data?.result?.total || 0;
    console.log(`🌳 KKL: ${total} total records`);

    while (offset < total || offset === 0) {
      const resp = await axios.get(apiBase, {
        params: { resource_id: resourceId, limit, offset },
        timeout: 15000,
      });

      const records: GovDataRecord[] = resp.data?.result?.records || [];
      if (!records.length) break;

      for (const rec of records) {
        const lat = parseFloat(rec.Y || rec.lat || rec.latitude || 0);
        const lng = parseFloat(rec.X || rec.lon || rec.longitude || 0);
        if (!lat || !lng || Math.abs(lat) < 1) continue;

        const name = rec.Name || rec.name || rec['שם_אתר'] || rec['שם'] || `אתר קק"ל ${rec._id}`;
        const desc = rec.Description || rec['תיאור'] || '';
        const region_id = await getRegionForCoord(lat, lng);

        await upsertLocation({
          name,
          description: desc,
          category: 'יער',
          region_id: region_id || undefined,
          latitude: lat,
          longitude: lng,
          source: 'kkl',
          source_id: `kkl-${rec._id}`,
          images: [],
        });
        processed++;
      }

      if (onProgress) onProgress(processed, total);
      offset += limit;
      if (records.length < limit) break;
    }
  } catch (err: any) {
    console.error('KKL ingestion error:', err.message);
    throw err;
  }

  return processed;
}
