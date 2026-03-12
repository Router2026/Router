/**
 * generateSeed.js
 * Orchestrates fetching, normalizing, and generating a SQL seed file.
 * No environment variables or DB connection required.
 */

const fs = require('fs');
const { fetchOSM } = require('./fetchOSM');
const { fetchGovData } = require('./fetchGovData');
const { fetchKKL } = require('./fetchKKL');
const { fetchIHike } = require('./fetchIHike');
const { normalizeLocation } = require('../utils/normalizeLocation');
const { searchImageForLocation } = require('../utils/imageSearch');

// SQL Template parts
const SQL_HEADER = `
INSERT INTO locations (
  name, description, category, region_id,
  latitude, longitude, geom,
  images, main_image, source, source_id,
  difficulty, duration_minutes,
  has_water, has_shade, accessible, average_rating
)
SELECT
  l.name, l.description, l.category,
  r.id AS region_id,
  l.latitude, l.longitude,
  ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326)::geography AS geom,
  l.images::jsonb, l.main_image, 'seed', l.source_id,
  l.difficulty, l.duration_minutes::integer,
  l.has_water::boolean, l.has_shade::boolean,
  l.accessible::boolean, l.average_rating::numeric
FROM (VALUES
`;

const SQL_FOOTER = `
) AS l(name, description, category, region_name, latitude, longitude,
       images, main_image, source_id, difficulty, duration_minutes,
       has_water, has_shade, accessible, average_rating)
JOIN regions r ON r.name = l.region_name
ON CONFLICT (source, source_id) DO NOTHING;
`;

/**
 * Escape SQL strings to prevent syntax errors
 */
function esc(str) {
  if (str === null || str === undefined) return 'NULL';
  const escaped = String(str).replace(/'/g, "''");
  return `'${escaped}'`;
}

async function main() {
  console.log('--- Starting Seed Generation ---');

  const sources = [
    { fn: fetchOSM, label: 'OSM' },
    { fn: fetchGovData, label: 'Gov' },
    { fn: fetchKKL, label: 'KKL' },
    { fn: fetchIHike, label: 'iHike' }
  ];

  let allNormalized = [];

  for (const { fn, label } of sources) {
    console.log(`Fetching from ${label}...`);
    try {
      const raw = await fn();
      for (const item of raw) {
        const normalized = normalizeLocation(item, label.toLowerCase());
        if (normalized) allNormalized.push(normalized);
      }
    } catch (err) {
      console.error(`Error in ${label}:`, err.message);
    }
  }

  console.log(`Processing ${allNormalized.length} locations...`);

  const valueRows = [];

  for (let i = 0; i < allNormalized.length; i++) {
    const loc = allNormalized[i];

    // Auto-search image if missing
    if (!loc.main_image) {
      process.stdout.write(`\rSearching image for: ${loc.name.slice(0, 20)}...          `);
      const foundImage = await searchImageForLocation(loc.name);
      if (foundImage) {
        loc.main_image = foundImage;
        loc.images = [foundImage];
      }
    }

    // Format row for VALUES block
    const row = `  (${esc(loc.name)}, ${esc(loc.description)}, ${esc(loc.category)}, ${esc(loc.region_name)}, ` +
      `${loc.latitude}, ${loc.longitude}, ${esc(JSON.stringify(loc.images))}, ${esc(loc.main_image)}, ` +
      `${esc(loc.source_id)}, ${esc(loc.difficulty)}, ${loc.duration_minutes || 'NULL'}, ` +
      `${loc.has_water ?? 'NULL'}, ${loc.has_shade ?? 'NULL'}, ${loc.accessible ?? 'NULL'}, ` +
      `${loc.average_rating || 'NULL'})`;

    valueRows.push(row);
  }

  const finalSql = SQL_HEADER + valueRows.join(',\n') + SQL_FOOTER;

  fs.writeFileSync('seed_locations.sql', finalSql);
  console.log('\n--- Success! seed_locations.sql generated ---');
}

main();