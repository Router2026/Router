// User preferences for a single-day AI route, and the target stop count.

import { parseTime } from "./sequence";
import type { Candidate, LatLng } from "./types";
import type { TripStyle } from "./categories";

export const GROUP_TYPES = ["solo", "couple", "family", "friends"] as const;
export type GroupType = (typeof GROUP_TYPES)[number];

export function isGroupType(value: unknown): value is GroupType {
  return typeof value === "string" && (GROUP_TYPES as readonly string[]).includes(value);
}

export interface RoutePreferences {
  regionName: string;
  groupType: GroupType;
  styles: TripStyle[];
  dayStart: string; // "HH:MM"
  dayEnd: string; // "HH:MM"
  start?: LatLng | null;
  /** Optional user cap on the number of stops (2-7). */
  maxStops?: number | null;
}

export const MIN_STOPS = 2;
export const MAX_STOPS = 7;
/** Average non-visit time per stop: driving, parking, short breaks. */
const PER_STOP_OVERHEAD_MINUTES = 25;

/** How many stops fit the time window, based on the candidates' typical duration. */
export function computeTargetStops(
  prefs: Pick<RoutePreferences, "dayStart" | "dayEnd" | "maxStops">,
  candidates: readonly Candidate[],
): number {
  const available = parseTime(prefs.dayEnd) - parseTime(prefs.dayStart);
  if (available <= 0 || candidates.length === 0) return Math.min(MIN_STOPS, candidates.length);

  const avgVisit = candidates.reduce((sum, c) => sum + c.durationMinutes, 0) / candidates.length;
  const fit = Math.round(available / (avgVisit + PER_STOP_OVERHEAD_MINUTES));
  const cap = prefs.maxStops ? Math.max(MIN_STOPS, Math.min(MAX_STOPS, prefs.maxStops)) : MAX_STOPS;
  const target = Math.max(MIN_STOPS, Math.min(cap, fit));
  return Math.min(target, candidates.length);
}
