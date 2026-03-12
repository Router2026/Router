/**
 * categoryMapper.js
 * Maps raw source category strings to normalized Hebrew categories.
 */

const CATEGORY_MAP = {
  // Natural features
  spring: 'מעיין',
  well: 'מעיין',
  fountain: 'מעיין',

  waterfall: 'נחל',
  stream: 'נחל',
  river: 'נחל',
  wadi: 'נחל',
  creek: 'נחל',
  נחל: 'נחל',

  viewpoint: 'מצפה',
  vista: 'מצפה',
  lookout: 'מצפה',
  observation_tower: 'מצפה',
  מצפה: 'מצפה',

  nature_reserve: 'שמורת טבע',
  reserve: 'שמורת טבע',
  protected_area: 'שמורת טבע',
  שמורה: 'שמורת טבע',
  שמורת_טבע: 'שמורת טבע',

  forest: 'יער',
  wood: 'יער',
  park: 'יער',
  national_park: 'יער',
  picnic_site: 'יער',
  garden: 'יער',
  גן_לאומי: 'יער',
  יער: 'יער',

  trail: 'מסלול',
  hiking: 'מסלול',
  path: 'מסלול',
  route: 'מסלול',
  footway: 'מסלול',
  מסלול: 'מסלול',

  beach: 'חוף',
  coastline: 'חוף',
  bay: 'חוף',
  חוף: 'חוף',

  archaeological_site: 'אתר היסטורי',
  historic: 'אתר היסטורי',
  ruins: 'אתר היסטורי',
  castle: 'אתר היסטורי',
  memorial: 'אתר היסטורי',
  monument: 'אתר היסטורי',
  אתר_היסטורי: 'אתר היסטורי',

  cave: 'גיאולוגיה',
  cliff: 'גיאולוגיה',
  peak: 'גיאולוגיה',
  volcano: 'גיאולוגיה',
  crater: 'גיאולוגיה',
  rock: 'גיאולוגיה',
  geological: 'גיאולוגיה',
  גיאולוגיה: 'גיאולוגיה',
};

const DEFAULT_CATEGORY = 'מסלול';

/**
 * Maps a raw category string to a normalized Hebrew category.
 * Tries multiple strategies: direct lookup, lowercase, partial match.
 *
 * @param {string|undefined} rawCategory
 * @returns {string} Hebrew category
 */
function mapCategory(rawCategory) {
  if (!rawCategory) return DEFAULT_CATEGORY;

  const raw = String(rawCategory).trim();

  // 1. Direct match
  if (CATEGORY_MAP[raw]) return CATEGORY_MAP[raw];

  // 2. Lowercase match
  const lower = raw.toLowerCase().replace(/\s+/g, '_');
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];

  // 3. Partial match (contains keyword)
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return value;
  }

  // 4. Default
  return DEFAULT_CATEGORY;
}

/**
 * Returns all supported Hebrew categories.
 */
function getCategories() {
  return [...new Set(Object.values(CATEGORY_MAP))];
}

module.exports = { mapCategory, getCategories, DEFAULT_CATEGORY };
