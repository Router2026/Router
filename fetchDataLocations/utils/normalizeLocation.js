/**
 * normalizeLocation.js
 * Normalizes raw location data from any source into a unified schema.
 */

const { mapCategory } = require('./categoryMapper');
const { detectRegion } = require('./regionDetector');

/**
 * Sanitize a string value — trim and null-ify empty strings.
 * @param {*} val
 * @returns {string|null}
 */
function sanitizeString(val) {
  if (val == null) return null;
  const s = String(val).trim();
  return s.length > 0 ? s : null;
}

/**
 * Sanitize a numeric value.
 * @param {*} val
 * @returns {number|null}
 */
function sanitizeNumber(val) {
  if (val == null || val === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

/**
 * Sanitize a boolean value.
 * @param {*} val
 * @returns {boolean|null}
 */
function sanitizeBoolean(val) {
  if (val == null) return null;
  if (typeof val === 'boolean') return val;
  const s = String(val).toLowerCase().trim();
  if (['true', 'yes', '1', 'כן'].includes(s)) return true;
  if (['false', 'no', '0', 'לא'].includes(s)) return false;
  return null;
}

/**
 * Enriches the location object with default values based on its mapped category.
 */
function enrichByCategory(loc) {
  if (loc.average_rating == null) {
    loc.average_rating = parseFloat((Math.random() * (5 - 4) + 4).toFixed(1));
  }

  switch (loc.category) {
    case 'מעיין':
      if (loc.has_water == null) loc.has_water = true;
      if (loc.has_shade == null) loc.has_shade = false;
      if (loc.duration_minutes == null) loc.duration_minutes = 45;
      if (loc.difficulty == null) loc.difficulty = 'קל';
      break;
    case 'נחל':
      if (loc.has_water == null) loc.has_water = true;
      if (loc.duration_minutes == null) loc.duration_minutes = 120;
      if (loc.difficulty == null) loc.difficulty = 'בינוני';
      break;
    case 'מצפה':
      if (loc.has_water == null) loc.has_water = false;
      if (loc.accessible == null) loc.accessible = true;
      if (loc.duration_minutes == null) loc.duration_minutes = 20;
      if (loc.difficulty == null) loc.difficulty = 'קל';
      break;
    case 'יער':
      if (loc.has_shade == null) loc.has_shade = true;
      if (loc.duration_minutes == null) loc.duration_minutes = 90;
      if (loc.difficulty == null) loc.difficulty = 'קל';
      break;
    case 'שמורת טבע':
      if (loc.duration_minutes == null) loc.duration_minutes = 180;
      if (loc.difficulty == null) loc.difficulty = 'בינוני';
      break;
    case 'מסלול':
      if (loc.duration_minutes == null) loc.duration_minutes = 150;
      if (loc.difficulty == null) loc.difficulty = 'בינוני';
      break;
    case 'חוף':
      if (loc.has_water == null) loc.has_water = true;
      if (loc.has_shade == null) loc.has_shade = false;
      if (loc.duration_minutes == null) loc.duration_minutes = 120;
      if (loc.difficulty == null) loc.difficulty = 'קל';
      break;
    case 'אתר היסטורי':
    case 'גיאולוגיה':
      if (loc.duration_minutes == null) loc.duration_minutes = 60;
      if (loc.difficulty == null) loc.difficulty = 'קל';
      break;
    default:
      if (loc.duration_minutes == null) loc.duration_minutes = 60;
      if (loc.difficulty == null) loc.difficulty = 'קל';
  }

  // Fallback to false for any remaining null booleans
  if (loc.has_water == null) loc.has_water = false;
  if (loc.has_shade == null) loc.has_shade = false;
  if (loc.accessible == null) loc.accessible = false;
}

/**
 * Normalize a raw location object from any data source.
 *
 * @param {Object} raw - Raw data from a fetcher
 * @param {string} source - Source identifier (e.g. 'osm', 'gov', 'kkl', 'iHike')
 * @returns {Object|null} Normalized location or null if invalid
 */
function normalizeLocation(raw, source) {
  const lat = sanitizeNumber(raw.latitude ?? raw.lat ?? raw.y);
  const lon = sanitizeNumber(raw.longitude ?? raw.lon ?? raw.lng ?? raw.x);

  // Must have valid coordinates inside Israel's bounding box
  if (lat == null || lon == null) return null;
  if (lat < 29.3 || lat > 33.5 || lon < 34.2 || lon > 36.1) return null;

  const name = sanitizeString(
    raw.name ??
    raw.name_he ??
    raw.title ??
    raw['שם'] ??
    raw['name:he']
  );

  // Skip unnamed locations only if source is not OSM (OSM often has unnamed natural features)
  if (!name && source !== 'osm') return null;

  const rawCategory =
    raw.category ??
    raw.type ??
    raw.amenity ??
    raw.natural ??
    raw.tourism ??
    raw.leisure ??
    raw.landuse ??
    raw['סוג'];

  const category = mapCategory(rawCategory);

  const regionName =
    sanitizeString(raw.region_name ?? raw.region ?? raw['אזור']) ??
    detectRegion(lat, lon);

  const description = sanitizeString(
    raw.description ??
    raw.desc ??
    raw.notes ??
    raw.note ??
    raw['תיאור']
  );

  const sourceId = sanitizeString(
    raw.source_id ??
    raw.id ??
    raw.osm_id ??
    raw.objectid ??
    raw.OBJECTID ??
    raw['מזהה']
  );

  if (!sourceId) return null;

  // Images: normalize to array of strings
  let images = [];
  if (Array.isArray(raw.images)) {
    images = raw.images.filter(Boolean).map(String);
  } else if (raw.image) {
    images = [String(raw.image)];
  }

  const mainImage = sanitizeString(raw.main_image ?? images[0] ?? null);

  const loc = {
    name: name ?? `אתר טבע (${category})`,
    description,
    category,
    region_name: regionName,
    latitude: lat,
    longitude: lon,
    images,
    main_image: mainImage,
    source,
    source_id: `${source}_${sourceId}`,
    difficulty: sanitizeString(raw.difficulty),
    duration_minutes: sanitizeNumber(raw.duration_minutes ?? raw.duration),
    has_water: sanitizeBoolean(raw.has_water ?? raw.water ?? raw['מים']),
    has_shade: sanitizeBoolean(raw.has_shade ?? raw.shade ?? raw['צל']),
    accessible: sanitizeBoolean(raw.accessible ?? raw.wheelchair ?? raw['נגיש']),
    average_rating: sanitizeNumber(raw.average_rating ?? raw.rating),
  };

  enrichByCategory(loc);

  return loc;
};

module.exports = { normalizeLocation };
