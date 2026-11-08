// Deterministic stop selection used when the LLM fails, times out, or returns
// too few valid stops. Guarantees the user always gets a route built from DB data.

import { haversineMeters } from "./sequence";
import type { Candidate, LatLng, ValidatedStop } from "./types";

const FALLBACK_REASONING: Record<string, string> = {
  "מעיין": "עצירה מרעננת ליד המים, מתאימה למנוחה ולטבילה.",
  "נחל": "מסלול לאורך הנחל עם נוף ירוק ומים.",
  "מצפה": "נקודת תצפית עם נוף פתוח למרחקים.",
  "נוף": "נקודת תצפית עם נוף פתוח למרחקים.",
  "מים": "עצירה מרעננת ליד המים.",
  "היסטוריה": "אתר היסטורי מעניין עם סיפור מקומי.",
  "שמורת טבע": "שמורת טבע מומלצת באזור לטיול רגלי.",
  "יער": "פינה מוצלת ונעימה לפיקניק ולהליכה.",
  "מסלול": "מסלול הליכה מומלץ באזור.",
  "חוף": "חוף נעים למנוחה מול הים.",
  "אתר היסטורי": "אתר היסטורי מעניין עם סיפור מקומי.",
  "גיאולוגיה": "תופעה גיאולוגית מרשימה שכדאי לראות.",
};
const GENERIC_REASONING = "מקום מומלץ באזור שמתאים לסגנון הטיול.";

/** Distance multiplier for picking a category already in the route, to keep variety. */
const REPEAT_CATEGORY_PENALTY = 1.6;

export function fallbackReasoning(category: string): string {
  return FALLBACK_REASONING[category] ?? GENERIC_REASONING;
}

function toStop(c: Candidate): ValidatedStop {
  return { candidate: c, reasoning: fallbackReasoning(c.category), visitMinutes: c.durationMinutes };
}

/**
 * Greedy geographic cluster: start from the first candidate (already ranked
 * nearest-to-start / best by the DB query), then repeatedly add the nearest
 * unused candidate, penalizing repeated categories.
 */
export function selectFallbackStops(
  candidates: readonly Candidate[],
  count: number,
  exclude: ReadonlySet<number> = new Set(),
  anchor: LatLng | null = null,
): ValidatedStop[] {
  const pool = candidates.filter((c) => !exclude.has(c.locationId));
  if (pool.length === 0 || count <= 0) return [];

  const picked: Candidate[] = [];
  const usedCategories = new Set<string>();
  let current: LatLng | null = anchor;

  while (picked.length < count && pool.length > 0) {
    let bestIdx = 0;
    if (current) {
      let bestScore = Number.POSITIVE_INFINITY;
      for (let i = 0; i < pool.length; i++) {
        const c = pool[i];
        const penalty = usedCategories.has(c.category) ? REPEAT_CATEGORY_PENALTY : 1;
        const score = haversineMeters(current, { lat: c.lat, lng: c.lng }) * penalty;
        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
    }
    const [chosen] = pool.splice(bestIdx, 1);
    picked.push(chosen);
    usedCategories.add(chosen.category);
    current = { lat: chosen.lat, lng: chosen.lng };
  }
  return picked.map(toStop);
}

/** Adds fallback stops near the existing ones until `target` is reached. */
export function topUpStops(stops: readonly ValidatedStop[], candidates: readonly Candidate[], target: number): ValidatedStop[] {
  if (stops.length >= target) return [...stops];
  const used = new Set(stops.map((s) => s.candidate.locationId));
  const last = stops[stops.length - 1]?.candidate;
  const anchor = last ? { lat: last.lat, lng: last.lng } : null;
  return [...stops, ...selectFallbackStops(candidates, target - stops.length, used, anchor)];
}
