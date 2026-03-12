/**
 * fetchIHike.js
 * Fetches hiking-related POIs from the Israel Hiking Map API.
 * https://israelhiking.osm.org.il/api
 */

const axios = require('axios');

const IHIKE_BASE = 'https://israelhiking.osm.org.il/api';

/**
 * Search terms to query from the Israel Hiking API.
 * The API supports Hebrew and English search strings.
 */
const SEARCH_TERMS = [
  { term: 'מעיין', category: 'spring' },
  { term: 'מצפה', category: 'viewpoint' },
  { term: 'מפל', category: 'waterfall' },
  { term: 'נחל', category: 'wadi' },
  { term: 'גן לאומי', category: 'national_park' },
  { term: 'שמורת טבע', category: 'nature_reserve' },
  { term: 'יער', category: 'forest' },
  { term: 'חוף', category: 'beach' },
  { term: 'מערה', category: 'cave' },
  { term: 'פסגה', category: 'peak' },
  { term: 'spring', category: 'spring' },
  { term: 'viewpoint', category: 'viewpoint' },
  { term: 'trail', category: 'trail' },
  { term: 'waterfall', category: 'waterfall' },
  { term: 'nature reserve', category: 'nature_reserve' },
];

/**
 * Fetch POIs from the Israel Hiking search endpoint.
 *
 * @param {string} term - Search term
 * @param {string} categoryHint - Category override
 * @returns {Promise<Array>}
 */
async function fetchSearchTerm(term, categoryHint) {
  let response;
  try {
    response = await axios.get(`${IHIKE_BASE}/search`, {
      params: {
        term,
        language: 'he',
        limit: 200,
      },
      timeout: 20_000,
    });
  } catch (err) {
    console.warn(`[iHike] Failed search for "${term}": ${err.message}`);
    return [];
  }

  const results = response.data ?? [];
  if (!Array.isArray(results)) {
    console.warn(`[iHike] Unexpected response shape for "${term}"`);
    return [];
  }

  return results
    .filter((r) => r.location?.lat != null && r.location?.lng != null)
    .map((r) => ({
      id: String(r.id ?? r.osm_id ?? `ihike_${term}_${Math.random().toString(36).slice(2)}`),
      name: r.title ?? r.name ?? r.displayName ?? null,
      description: r.description ?? null,
      category: r.source_type ?? categoryHint,
      latitude: r.location?.lat,
      longitude: r.location?.lng,
      has_water: null,
      has_shade: null,
      accessible: null,
      difficulty: r.extra?.difficulty ?? null,
      duration_minutes: r.extra?.lengthInMeters
        ? Math.round(r.extra.lengthInMeters / 60) // rough estimate: 1m/min
        : null,
      images: r.extra?.imgUrl ? [r.extra.imgUrl] : [],
      main_image: r.extra?.imgUrl ?? null,
      average_rating: null,
    }));
}

/**
 * Fetch trail routes from the Israel Hiking API.
 * The /poi endpoint may return GeoJSON-like POIs.
 */
async function fetchIHikePOIs() {
  let response;
  try {
    response = await axios.get(`${IHIKE_BASE}/poi`, {
      params: {
        categoriesGroup: 'Points of Interest',
        language: 'he',
      },
      timeout: 30_000,
    });
  } catch (err) {
    console.warn(`[iHike] POI endpoint failed: ${err.message}`);
    return [];
  }

  const features = response.data?.features ?? [];

  return features
    .filter((f) => f.geometry?.coordinates?.length >= 2)
    .map((f) => {
      const coords = f.geometry.coordinates;
      const props = f.properties ?? {};
      return {
        id: String(props.identifier ?? props.id ?? props.osm_id ?? `ihike_poi_${Math.random().toString(36).slice(2)}`),
        name: props.title ?? props.name ?? null,
        description: props.description ?? null,
        category: props.poiCategory ?? props.category ?? 'trail',
        latitude: coords[1],
        longitude: coords[0],
        has_water: null,
        has_shade: null,
        accessible: null,
        difficulty: props.difficulty ?? null,
        duration_minutes: null,
        images: props.mainImage ? [props.mainImage] : [],
        main_image: props.mainImage ?? null,
        average_rating: null,
      };
    });
}

/**
 * Main entry point — fetch all from Israel Hiking Map.
 * @returns {Promise<Array>}
 */
async function fetchIHike() {
  console.log('[iHike] Fetching from Israel Hiking Map API...');

  const allRaw = [];

  // Fetch POIs endpoint
  const poiResults = await fetchIHikePOIs();
  console.log(`[iHike] POI endpoint: ${poiResults.length} results.`);
  allRaw.push(...poiResults.map((r) => ({ ...r, _source: 'ihike' })));

  // Fetch search terms
  for (const { term, category } of SEARCH_TERMS) {
    const results = await fetchSearchTerm(term, category);
    console.log(`[iHike] Search "${term}": ${results.length} results.`);
    allRaw.push(...results.map((r) => ({ ...r, _source: 'ihike' })));
    await sleep(500); // rate limit
  }

  // Deduplicate by id within this source
  const seen = new Set();
  const deduped = allRaw.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  console.log(`[iHike] Total unique records: ${deduped.length}`);
  return deduped;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { fetchIHike };
