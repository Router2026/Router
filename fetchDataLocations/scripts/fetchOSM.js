/**
 * fetchOSM.js
 * Fetches nature locations from OpenStreetMap via the Overpass API.
 * Returns normalized raw records ready for normalizeLocation().
 */

const axios = require('axios');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Israel bounding box: south, west, north, east
const BBOX = '29,34,34,36';

/**
 * Overpass QL query — fetches springs, viewpoints, picnic sites,
 * waterfalls, nature reserves, peaks, caves, and beaches across Israel.
 */
const OVERPASS_QUERY = `
[out:json][timeout:120];
(
  node["natural"="spring"](${BBOX});
  node["tourism"="viewpoint"](${BBOX});
  node["leisure"="picnic_site"](${BBOX});
  node["natural"="waterfall"](${BBOX});
  node["natural"="peak"](${BBOX});
  node["natural"="cave_entrance"](${BBOX});
  node["natural"="beach"](${BBOX});
  node["leisure"="nature_reserve"](${BBOX});
  node["boundary"="national_park"](${BBOX});
  node["historic"="archaeological_site"](${BBOX});
  node["natural"="cliff"](${BBOX});
  node["natural"="crater"](${BBOX});
  way["natural"="spring"](${BBOX});
  way["tourism"="viewpoint"](${BBOX});
  way["leisure"="nature_reserve"](${BBOX});
  way["boundary"="national_park"](${BBOX});
  relation["leisure"="nature_reserve"](${BBOX});
  relation["boundary"="national_park"](${BBOX});
);
out center;
`.trim();

/**
 * Extract the best available name from OSM tags (prefer Hebrew).
 */
function extractName(tags) {
  return (
    tags['name:he'] ||
    tags['name'] ||
    tags['name:en'] ||
    tags['official_name'] ||
    null
  );
}

/**
 * Extract the raw category type from OSM tags.
 */
function extractCategory(tags) {
  return (
    tags.natural ||
    tags.tourism ||
    tags.leisure ||
    tags.historic ||
    tags.boundary ||
    tags.landuse ||
    null
  );
}

/**
 * Convert an OSM element (node/way/relation) to a raw location record.
 */
function osmElementToRaw(element) {
  const tags = element.tags || {};

  // For ways/relations, Overpass returns a `center` field with lat/lon
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;

  if (!lat || !lon) return null;

  return {
    id: String(element.id),
    name: extractName(tags),
    description: tags.description || tags.note || tags['description:he'] || null,
    category: extractCategory(tags),
    latitude: lat,
    longitude: lon,
    has_water:
      tags.drinking_water === 'yes' ||
      tags.natural === 'spring' ||
      tags.amenity === 'drinking_water'
        ? true
        : null,
    accessible: tags.wheelchair === 'yes' ? true : tags.wheelchair === 'no' ? false : null,
    has_shade: null,
    images: tags.image ? [tags.image] : [],
    main_image: tags.image || null,
    difficulty: tags['hiking:difficulty'] || null,
    duration_minutes: null,
    average_rating: null,
  };
}

/**
 * Fetch all nature locations from Overpass API.
 * @returns {Promise<Array>} Array of raw location objects
 */
async function fetchOSM() {
  console.log('[OSM] Sending Overpass query...');

  let response;
  try {
    response = await axios.post(OVERPASS_URL, `data=${encodeURIComponent(OVERPASS_QUERY)}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 150_000, // 150 seconds — Overpass can be slow
    });
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      throw new Error('[OSM] Overpass request timed out. Try again later.');
    }
    throw new Error(`[OSM] Request failed: ${err.message}`);
  }

  const elements = response.data?.elements ?? [];
  console.log(`[OSM] Received ${elements.length} raw elements.`);

  const rawLocations = [];
  for (const element of elements) {
    const raw = osmElementToRaw(element);
    if (raw) rawLocations.push(raw);
  }

  console.log(`[OSM] Converted ${rawLocations.length} valid elements.`);
  return rawLocations;
}

module.exports = { fetchOSM };
