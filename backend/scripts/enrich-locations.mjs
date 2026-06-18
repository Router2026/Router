// One-shot script: enriches locations with Google Places photos.
// Usage:  node scripts/enrich-locations.mjs [--force] [--limit=50] [--id=123]
//
// Reads DATABASE_URL and GOOGLE_PLACES_API_KEY from backend/.env.local

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";

// ── Load .env.local ────────────────────────────────────────────────────────
const envPath = join(dirname(fileURLToPath(import.meta.url)), "../.env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].trim();
}

const DB_URL    = process.env.DATABASE_URL;
const API_KEY   = process.env.GOOGLE_PLACES_API_KEY;
const BASE      = "https://places.googleapis.com/v1";
const DELAY_MS  = 250;

if (!DB_URL || !API_KEY) {
  console.error("Missing DATABASE_URL or GOOGLE_PLACES_API_KEY in .env.local");
  process.exit(1);
}

// ── Args ───────────────────────────────────────────────────────────────────
const args  = process.argv.slice(2);
const force = args.includes("--force");
const limit = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "100");
const id    = args.find(a => a.startsWith("--id="))?.split("=")[1];

// ── Google Places helpers ──────────────────────────────────────────────────
async function getPhotoUrl(photoName) {
  const res = await fetch(`${BASE}/${photoName}/media?maxWidthPx=1200&skipHttpRedirect=true&key=${API_KEY}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.photoUri ?? null;
}

async function enrichFromPlaces(name, lat, lng) {
  const res = await fetch(`${BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "places.id,places.photos",
    },
    body: JSON.stringify({
      textQuery: name,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 3000 } },
      maxResultCount: 1,
      languageCode: "he",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const place = data.places?.[0];
  if (!place) return null;

  const photos = place.photos?.slice(0, 5) ?? [];
  const photoUrls = (await Promise.all(photos.map(p => getPhotoUrl(p.name)))).filter(Boolean);
  const credit    = photos[0]?.authorAttributions?.[0]?.displayName ?? "Google";

  return { placeId: place.id, photoUrls, credit };
}

// ── Main ───────────────────────────────────────────────────────────────────
const client = new pg.Client({ connectionString: DB_URL });
await client.connect();

const query = id
  ? { text: "SELECT id, name, latitude::float, longitude::float FROM router.locations WHERE id = $1", values: [id] }
  : { text: `SELECT id, name, latitude::float, longitude::float FROM router.locations WHERE ($1 OR google_place_id IS NULL) ORDER BY id LIMIT $2`, values: [force, limit] };

const { rows } = await client.query(query);
console.log(`Enriching ${rows.length} locations…\n`);

let enriched = 0, notFound = 0, errors = 0;

for (const row of rows) {
  process.stdout.write(`  [${row.id}] ${row.name} … `);
  try {
    const result = await enrichFromPlaces(row.name, row.latitude, row.longitude);
    if (!result) {
      console.log("not found");
      notFound++;
    } else {
      await client.query(
        `UPDATE router.locations SET google_place_id=$1, images=$2::jsonb, main_image=$3, photo_credit=$4, updated_at=NOW() WHERE id=$5`,
        [result.placeId, JSON.stringify(result.photoUrls), result.photoUrls[0] ?? null, result.credit, row.id],
      );
      console.log(`✓ ${result.photoUrls.length} photos`);
      enriched++;
    }
  } catch (err) {
    console.log(`error: ${err.message}`);
    errors++;
  }
  await new Promise(r => setTimeout(r, DELAY_MS));
}

await client.end();
console.log(`\nDone — enriched: ${enriched}, not found: ${notFound}, errors: ${errors}`);
