/**
 * fetchKKL.js
 * Fetches forest, picnic area, and trail data from KKL-JNF (Keren Kayemeth LeIsrael)
 * via their public ArcGIS REST FeatureServer endpoints.
 */

const axios = require('axios');

const PAGE_SIZE = 1000; // ArcGIS default max per request

/**
 * KKL ArcGIS FeatureServer layers.
 * Each entry describes one layer to import.
 *
 * To discover new layers:
 *  - Visit https://services.arcgis.com/
 *  - Search for KKL/JNF public services
 *  - Or inspect network requests on https://www.kkl.org.il/
 *
 * Note: Service URLs may change. Check KKL's open GIS portal for updates.
 */
const KKL_LAYERS = [
  {
    url: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/KKL_Forests/FeatureServer/0/query',
    source: 'kkl_forests',
    categoryHint: 'forest',
    nameField: 'NAME_HEB',
    descField: 'DESCRIPTION',
  },
  {
    url: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/KKL_PicnicSites/FeatureServer/0/query',
    source: 'kkl_picnic',
    categoryHint: 'picnic_site',
    nameField: 'NAME_HEB',
    descField: 'DESCRIPT_HEB',
  },
  {
    url: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/KKL_Trails/FeatureServer/0/query',
    source: 'kkl_trails',
    categoryHint: 'trail',
    nameField: 'TRAIL_NAME',
    descField: 'DESCRIPTION',
  },
  {
    url: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/KKL_Viewpoints/FeatureServer/0/query',
    source: 'kkl_viewpoints',
    categoryHint: 'viewpoint',
    nameField: 'NAME_HEB',
    descField: null,
  },
];

/**
 * Build ArcGIS REST query parameters.
 * Requests all features with geometry in WGS84.
 */
function buildParams(offset = 0) {
  return {
    where: '1=1',
    outFields: '*',
    geometryType: 'esriGeometryPoint',
    spatialRel: 'esriSpatialRelIntersects',
    outSR: '4326', // WGS84
    f: 'json',
    returnGeometry: true,
    resultOffset: offset,
    resultRecordCount: PAGE_SIZE,
  };
}

/**
 * Extract lat/lon from an ArcGIS feature's geometry.
 * Handles both point geometry and centroid for polygons.
 */
function extractCoords(feature) {
  const geo = feature.geometry;
  if (!geo) return { lat: null, lon: null };

  // Point
  if (geo.x != null && geo.y != null) {
    return { lat: geo.y, lon: geo.x };
  }

  // Polygon/polyline — use centroid of the first ring
  if (geo.rings?.[0]?.length > 0) {
    const ring = geo.rings[0];
    const avgX = ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
    const avgY = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
    return { lat: avgY, lon: avgX };
  }

  // Polyline
  if (geo.paths?.[0]?.length > 0) {
    const midIdx = Math.floor(geo.paths[0].length / 2);
    const pt = geo.paths[0][midIdx];
    return { lat: pt[1], lon: pt[0] };
  }

  return { lat: null, lon: null };
}

/**
 * Fetch all features from a single ArcGIS FeatureServer layer.
 *
 * @param {Object} layer - Layer config object
 * @returns {Promise<Array>} Array of raw records
 */
async function fetchLayer(layer) {
  const { url, source, categoryHint, nameField, descField } = layer;
  const allRecords = [];
  let offset = 0;
  let exceededTransferLimit = true;

  console.log(`[KKL] Fetching layer: ${source}`);

  while (exceededTransferLimit) {
    let response;
    try {
      response = await axios.get(url, {
        params: buildParams(offset),
        timeout: 30_000,
      });
    } catch (err) {
      console.warn(`[KKL] Failed fetching ${source} at offset ${offset}: ${err.message}`);
      break;
    }

    const data = response.data;

    if (data.error) {
      console.warn(`[KKL] ArcGIS error for ${source}: ${JSON.stringify(data.error)}`);
      break;
    }

    const features = data.features ?? [];
    if (features.length === 0) break;

    for (const feature of features) {
      const attrs = feature.attributes ?? {};
      const { lat, lon } = extractCoords(feature);

      allRecords.push({
        id: String(attrs.OBJECTID ?? attrs.objectid ?? attrs.FID ?? `${source}_${offset}`),
        name: attrs[nameField] ?? attrs['NAME'] ?? attrs['name'] ?? null,
        description: descField ? (attrs[descField] ?? null) : null,
        category: categoryHint,
        latitude: lat,
        longitude: lon,
        has_water: attrs['WATER'] ?? attrs['DRINKING_WATER'] ?? null,
        has_shade: attrs['SHADE'] ?? null,
        accessible: attrs['ACCESSIBLE'] ?? attrs['WHEELCHAIR'] ?? null,
        difficulty: attrs['DIFFICULTY'] ?? attrs['LEVEL'] ?? null,
        duration_minutes: attrs['DURATION'] ?? attrs['WALK_TIME'] ?? null,
        images: [],
        main_image: attrs['IMAGE_URL'] ?? null,
        average_rating: attrs['RATING'] ?? null,
      });
    }

    exceededTransferLimit = data.exceededTransferLimit === true;
    offset += features.length;

    if (exceededTransferLimit) {
      await sleep(200);
    }
  }

  console.log(`[KKL] ${source}: fetched ${allRecords.length} features.`);
  return allRecords.map((r) => ({ ...r, _source: source }));
}

/**
 * Fetch all KKL layers.
 * @returns {Promise<Array>}
 */
async function fetchKKL() {
  const allRaw = [];

  for (const layer of KKL_LAYERS) {
    try {
      const records = await fetchLayer(layer);
      allRaw.push(...records);
    } catch (err) {
      console.error(`[KKL] Error fetching ${layer.source}: ${err.message}`);
    }
  }

  console.log(`[KKL] Total KKL records fetched: ${allRaw.length}`);
  return allRaw;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { fetchKKL };
