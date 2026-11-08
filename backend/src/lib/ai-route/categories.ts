// Maps the trip-planner style IDs (sent by the frontend) to the Hebrew category
// values actually stored in `locations.category` by the ETL pipeline
// (see fetchDataLocations/utils/categoryMapper.js).

export const TRIP_STYLES = [
  "history",
  "water",
  "photo",
  "nature",
  "hiking",
  "beach",
  "geology",
  "wine",
  "village",
  "family_activities",
] as const;

export type TripStyle = (typeof TRIP_STYLES)[number];

/**
 * Hebrew categories present in `locations` (counts from production, 2026-11).
 * Food ("אוכל", 4 rows) is intentionally excluded: Router focuses on nature.
 */
export const LOCATION_CATEGORIES = [
  "גיאולוגיה",   // 578
  "מעיין",       // 342
  "מצפה",        // 312
  "שמורת טבע",   // 263
  "אתר היסטורי", // 190
  "יער",         // 65
  "חוף",         // 43
  "מסלול",       // 40
  "נחל",         // 16
  "מים",         // 10
  "טבע",         // 4
  "נוף",         // 2
  "היסטוריה",    // 1
] as const;

const STYLE_TO_CATEGORIES: Record<TripStyle, readonly string[]> = {
  water: ["מעיין", "נחל", "מים"],
  nature: ["שמורת טבע", "יער", "טבע", "מעיין"],
  hiking: ["מסלול", "נחל", "שמורת טבע"],
  photo: ["מצפה", "נוף", "גיאולוגיה"],
  beach: ["חוף"],
  history: ["אתר היסטורי", "היסטוריה"],
  geology: ["גיאולוגיה", "מצפה"],
  village: ["אתר היסטורי", "היסטוריה"],
  family_activities: ["מעיין", "יער", "שמורת טבע"],
  // No food/wine categories are used; fall back to scenic stops.
  wine: ["מצפה", "נוף", "יער"],
};

/** Used when no style is selected, or none of the selected styles is known. */
export const DEFAULT_CATEGORIES: readonly string[] = [
  "שמורת טבע",
  "מעיין",
  "נחל",
  "מסלול",
  "מצפה",
];

/** Typical visit length per category, used when `duration_minutes` is null. */
const DEFAULT_VISIT_MINUTES: Record<string, number> = {
  "מעיין": 60,
  "נחל": 120,
  "מצפה": 30,
  "נוף": 30,
  "מים": 60,
  "היסטוריה": 60,
  "שמורת טבע": 120,
  "יער": 90,
  "מסלול": 150,
  "חוף": 120,
  "אתר היסטורי": 60,
  "גיאולוגיה": 60,
  "טבע": 60,
};

export function isTripStyle(value: unknown): value is TripStyle {
  return typeof value === "string" && (TRIP_STYLES as readonly string[]).includes(value);
}

/**
 * Resolves style IDs to a de-duplicated list of Hebrew DB categories.
 * Unknown styles are ignored. Order follows the order of the selected styles,
 * so the user's first choice gets priority when candidates are capped.
 */
export function resolveCategories(styles: readonly unknown[]): string[] {
  const result = new Set<string>();
  for (const style of styles) {
    if (!isTripStyle(style)) continue;
    for (const cat of STYLE_TO_CATEGORIES[style]) result.add(cat);
  }
  return result.size > 0 ? [...result] : [...DEFAULT_CATEGORIES];
}

export function defaultVisitMinutes(category: string): number {
  return DEFAULT_VISIT_MINUTES[category] ?? 60;
}
