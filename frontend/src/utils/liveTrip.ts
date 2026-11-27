// Live trip mode: where the day stands against the plan, from the clock and what the user
// marked (arrived / done / skipped). Pure functions, so it runs offline and is easy to test.

import type { TripStop } from '../api';
import { toMinutes } from './routeSchedule';

export interface LiveStop {
  key: string;
  name: string;
  lat: number | null;
  lng: number | null;
  /** Planned arrival, minutes after midnight; null when the trip has no schedule. */
  arrival: number | null;
  duration: number;
}

export interface LiveProgress {
  /** Local date (YYYY-MM-DD) the progress belongs to; a new day starts clean. */
  date: string;
  /** Stop key → minute of the day the user arrived. */
  arrived: Record<string, number>;
  done: string[];
  skipped: string[];
}

export type LivePhase = 'enroute' | 'at' | 'finished';

export interface LiveState {
  phase: LivePhase;
  current: LiveStop | null;
  /** Index of `current` in the full stop list. */
  currentIndex: number;
  remaining: LiveStop[];
  /**
   * Minutes behind the plan (negative = ahead). Null without a schedule.
   * En route: how late we already are for the planned arrival (never negative — arriving
   * early is unknown until it happens). At a stop: projected departure minus planned departure.
   */
  delay: number | null;
  /** At a stop: minutes left of the planned visit (can go negative = overstaying). */
  minutesLeftHere: number | null;
  /** Projected end of the day if the current delay carries through. */
  projectedEnd: number | null;
}

export function toLiveStops(stops: TripStop[]): LiveStop[] {
  return stops.map((s, i) => ({
    key: s.location_id != null ? String(s.location_id) : `i${i}`,
    name: s.poi_name,
    lat: s.latitude != null ? Number(s.latitude) : null,
    lng: s.longitude != null ? Number(s.longitude) : null,
    arrival: s.arrival_time ? toMinutes(s.arrival_time) : null,
    duration: s.duration_minutes || 60,
  }));
}

export function emptyProgress(date: string): LiveProgress {
  return { date, arrived: {}, done: [], skipped: [] };
}

export function computeLiveState(stops: LiveStop[], progress: LiveProgress, now: number): LiveState {
  const closed = new Set([...progress.done, ...progress.skipped]);
  const remaining = stops.filter(s => !closed.has(s.key));
  const current = remaining[0] ?? null;
  if (!current) {
    return { phase: 'finished', current: null, currentIndex: -1, remaining: [], delay: null, minutesLeftHere: null, projectedEnd: null };
  }

  const currentIndex = stops.indexOf(current);
  const arrivedAt = progress.arrived[current.key];
  const phase: LivePhase = arrivedAt != null ? 'at' : 'enroute';
  const scheduled = current.arrival != null;

  let delay: number | null = null;
  let minutesLeftHere: number | null = null;
  if (phase === 'at') {
    const leaveBy = arrivedAt + current.duration;
    minutesLeftHere = leaveBy - now;
    if (scheduled) delay = Math.max(leaveBy, now) - (current.arrival! + current.duration);
  } else if (scheduled) {
    delay = Math.max(0, now - current.arrival!);
  }

  const last = remaining.at(-1)!;
  const projectedEnd = delay != null && last.arrival != null ? last.arrival + last.duration + delay : null;

  return { phase, current, currentIndex, remaining, delay, minutesLeftHere, projectedEnd };
}

// ── Progress actions (immutable) ────────────────────────────────────────────

export const markArrived = (p: LiveProgress, key: string, now: number): LiveProgress =>
  ({ ...p, arrived: { ...p.arrived, [key]: now } });

export const markDone = (p: LiveProgress, key: string): LiveProgress =>
  ({ ...p, done: [...p.done.filter(k => k !== key), key] });

export const markSkipped = (p: LiveProgress, key: string): LiveProgress =>
  ({ ...p, skipped: [...p.skipped.filter(k => k !== key), key] });

/** Undo the last done/skip so a mis-tap isn't permanent. */
export function undoLast(p: LiveProgress, stops: LiveStop[]): LiveProgress {
  const closed = new Set([...p.done, ...p.skipped]);
  const lastClosed = [...stops].reverse().find(s => closed.has(s.key));
  if (!lastClosed) return p;
  return { ...p, done: p.done.filter(k => k !== lastClosed.key), skipped: p.skipped.filter(k => k !== lastClosed.key) };
}

// ── Persistence (per trip, per day) ─────────────────────────────────────────

const PROGRESS_KEY = 'router_live_progress';

export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readAll(): Record<string, LiveProgress> {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') as Record<string, LiveProgress>;
  } catch {
    return {};
  }
}

export function loadProgress(tripId: string, today = localDate()): LiveProgress {
  const p = readAll()[tripId];
  return p && p.date === today ? p : emptyProgress(today);
}

export function saveProgress(tripId: string, p: LiveProgress) {
  const all = readAll();
  // Keep only today's entries so the map doesn't grow forever.
  for (const id of Object.keys(all)) if (all[id]?.date !== p.date) delete all[id];
  all[tripId] = p;
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(all)); } catch { /* storage blocked */ }
}

// ── Sunset (NOAA sunrise equation; ±2 min is plenty for a warning) ──────────

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Sunset for the given date and place, or null in polar day/night. */
export function sunsetAt(date: Date, lat: number, lng: number): Date | null {
  const noonUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const jd = noonUtc / 86400000 + 2440587.5;
  const n = Math.round(jd - 2451545 + 0.0008);
  const jStar = n - lng / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(rad(M)) + 0.02 * Math.sin(rad(2 * M)) + 0.0003 * Math.sin(rad(3 * M));
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545 + jStar + 0.0053 * Math.sin(rad(M)) - 0.0069 * Math.sin(rad(2 * lambda));
  const sinDec = Math.sin(rad(lambda)) * Math.sin(rad(23.4397));
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosW = (Math.sin(rad(-0.833)) - Math.sin(rad(lat)) * sinDec) / (Math.cos(rad(lat)) * cosDec);
  if (cosW < -1 || cosW > 1) return null;
  const jSet = jTransit + deg(Math.acos(cosW)) / 360;
  return new Date((jSet - 2440587.5) * 86400000);
}

export const minuteOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

/** Straight-line distance in meters. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Within this distance of the next stop we mark it as arrived on our own. */
export const ARRIVE_RADIUS_M = 300;
