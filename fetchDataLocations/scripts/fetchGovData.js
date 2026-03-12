/**
 * fetchGovData.js
 * Fetches nature locations from the Israeli government open data portal (data.gov.il).
 * Uses the CKAN-compatible DataStore API.
 */

const axios = require('axios');

const GOV_API_BASE = 'https://data.gov.il/api/3/action/datastore_search';

// Default page size per request
const PAGE_SIZE = 100;

/**
 * Known resource IDs on data.gov.il for nature-related datasets.
 * Each entry maps a resource UUID to a source label and category hint.
 *
 * To find resource IDs:
 *   1. Visit https://data.gov.il/dataset/<dataset-slug>
 *   2. Click a resource → copy the `id` from the URL or the API info panel.
 */
const DATASETS = [
  {
    resourceId: '9ad3862c-8391-4b2f-84a4-2d4c68625f4b', // Gardens & Parks
    source: 'gov_parks',
    categoryHint: 'park',
    nameField: 'שם',
    descField: 'תיאור',
    latField: 'Y',
    lonField: 'X',
  },
  {
    resourceId: '22583c36-af5f-4a6f-9bc3-8c665c4a5b54', // Nature Reserves (INPA)
    source: 'gov_reserves',
    categoryHint: 'nature_reserve',
    nameField: 'שם_אזור',
    descField: null,
    latField: 'lat',
    lonField: 'lon',
  },
  {
    resourceId: 'f7c7de53-b53e-4a34-b5d2-b60a7e1e0eab', // National Trails
    source: 'gov_trails',
    categoryHint: 'trail',
    nameField: 'name',
    descField: 'description',
    latField: 'lat',
    lonField: 'lon',
  },
];

/**
 * Fetch all records from a single data.gov.il resource using pagination.
 *
 * @param {Object} dataset - Dataset config object
 * @returns {Promise<Array>} Array of raw row objects
 */
async function fetchDataset(dataset) {
  const { resourceId, source, categoryHint, nameField, descField, latField, lonField } = dataset;
  const allRecords = [];
  let offset = 0;
  let total = null;

  console.log(`[GOV] Fetching dataset: ${source} (resource ${resourceId})`);

  while (total === null || offset < total) {
    console.log("offset: " + offset)
    let response;
    try {
      response = await axios.get(GOV_API_BASE, {
        params: {
          resource_id: resourceId,
          limit: PAGE_SIZE,
          offset,
        },
        timeout: 30_000,
      });
    } catch (err) {
      console.warn(`[GOV] Failed to fetch ${source} at offset ${offset}: ${err.message}`);
      break;
    }

    const result = response.data?.result;
    if (!result || !result.success) {
      console.warn(`[GOV] Unexpected response for ${source}:`, response.data?.error);
      break;
    }

    if (total === null) {
      total = result.total;
      console.log(`[GOV] ${source}: ${total} total records.`);
    }

    const records = result.records ?? [];
    if (records.length === 0) break;

    for (const record of records) {
      const lat = parseFloat(record[latField] ?? record['lat'] ?? record['Y'] ?? record['y']);
      const lon = parseFloat(record[lonField] ?? record['lon'] ?? record['X'] ?? record['x']);

      allRecords.push({
        id: String(record['_id'] ?? record['id'] ?? record['מזהה'] ?? offset),
        name: record[nameField] ?? record['שם'] ?? record['name'] ?? null,
        description: descField ? (record[descField] ?? null) : null,
        category: categoryHint,
        latitude: isNaN(lat) ? null : lat,
        longitude: isNaN(lon) ? null : lon,
        region_name: record['אזור'] ?? record['region'] ?? null,
        has_water: record['מים'] ?? null,
        has_shade: record['צל'] ?? null,
        accessible: record['נגיש'] ?? record['accessible'] ?? null,
        images: [],
        main_image: null,
        difficulty: record['רמת_קושי'] ?? record['difficulty'] ?? null,
        duration_minutes: record['זמן_הליכה'] ?? record['duration_minutes'] ?? null,
        average_rating: null,
      });
    }

    offset += records.length;

    // Respect rate limits
    await sleep(300);
  }

  console.log(`[GOV] ${source}: fetched ${allRecords.length} records.`);
  return allRecords.map((r) => ({ ...r, _source: source }));
}

/**
 * Fetch all configured government datasets.
 * @returns {Promise<Array>} Combined array of raw records
 */
async function fetchGovData() {
  const allRaw = [];

  for (const dataset of DATASETS) {
    try {
      const records = await fetchDataset(dataset);
      allRaw.push(...records);
    } catch (err) {
      console.error(`[GOV] Error fetching ${dataset.source}: ${err.message}`);
    }
  }

  console.log(`[GOV] Total government records fetched: ${allRaw.length}`);
  return allRaw;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { fetchGovData };
