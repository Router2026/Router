/**
 * regionDetector.js
 * Detects an Israeli region name based on latitude/longitude coordinates.
 * Used when source data does not include a region field.
 */

/**
 * Golan Heights bounding box: lat 32.7–33.3, lon 35.6–36.0
 * Upper Galilee: lat > 33.0
 * Lower Galilee: lat 32.7–33.0
 * Carmel: lat 32.4–32.7
 * Sharon / Coastal Plain: lat 32.0–32.4, lon < 35.2
 * Central: lat 31.9–32.4
 * Jerusalem: lat 31.6–31.9
 * Negev: lat 30.3–31.6
 * Arava: lat 29.5–30.3, lon > 34.8
 * Eilat: lat < 29.6
 */

const REGIONS = [
  {
    name: 'גולן',
    test: (lat, lon) => lat >= 32.7 && lat <= 33.3 && lon >= 35.6 && lon <= 36.0,
  },
  {
    name: 'גליל עליון',
    test: (lat) => lat > 33.0,
  },
  {
    name: 'גליל תחתון',
    test: (lat) => lat > 32.7,
  },
  {
    name: 'כרמל',
    test: (lat) => lat > 32.4,
  },
  {
    name: 'שרון',
    test: (lat, lon) => lat > 32.0 && lon < 35.2,
  },
  {
    name: 'מרכז',
    test: (lat) => lat > 31.9,
  },
  {
    name: 'ירושלים',
    test: (lat) => lat > 31.6,
  },
  {
    name: 'נגב',
    test: (lat) => lat > 30.0,
  },
  {
    name: 'ערבה',
    test: (lat, lon) => lat > 29.5 && lon > 34.8,
  },
  {
    name: 'אילת',
    test: () => true, // fallback
  },
];

/**
 * Returns the Hebrew region name for a given lat/lon.
 * @param {number} lat
 * @param {number} lon
 * @returns {string}
 */
function detectRegion(lat, lon) {
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
    return 'מרכז'; // default fallback
  }

  for (const region of REGIONS) {
    if (region.test(lat, lon)) {
      return region.name;
    }
  }

  return 'מרכז';
}

module.exports = { detectRegion };
