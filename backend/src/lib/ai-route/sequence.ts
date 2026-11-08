// Deterministic stop ordering and scheduling. The LLM chooses WHICH places;
// the server decides the ORDER (LLMs are unreliable at spatial optimization)
// and computes realistic times from actual distances.

import type { LatLng, ScheduledStop, ValidatedStop } from "./types";

const EARTH_RADIUS_M = 6_371_000;

/** Road distance is longer than straight-line distance; 1.3 is a common heuristic. */
export const ROAD_FACTOR = 1.3;
/** Average driving speed on Israeli rural/intercity roads, km/h. */
export const AVG_SPEED_KMH = 60;
/** Fixed overhead per leg: parking, walking from the car, etc. */
export const LEG_OVERHEAD_MINUTES = 5;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Estimated driving minutes for a straight-line distance in meters. */
export function estimateDriveMinutes(straightLineMeters: number): number {
  if (straightLineMeters <= 0) return 0;
  const roadKm = (straightLineMeters / 1000) * ROAD_FACTOR;
  return Math.round((roadKm / AVG_SPEED_KMH) * 60) + LEG_OVERHEAD_MINUTES;
}

export interface OrderOptions {
  /** Fixed starting point (e.g. user location). The path begins there. */
  origin?: LatLng | null;
  /** Whether to count the return leg to `origin` when optimizing. */
  roundTrip?: boolean;
}

/** Total path length for the given order (meters). */
export function pathLength(points: readonly LatLng[], order: readonly number[], opts: OrderOptions = {}): number {
  if (order.length === 0) return 0;
  let total = 0;
  if (opts.origin) total += haversineMeters(opts.origin, points[order[0]]);
  for (let i = 0; i < order.length - 1; i++) {
    total += haversineMeters(points[order[i]], points[order[i + 1]]);
  }
  if (opts.origin && opts.roundTrip) total += haversineMeters(points[order[order.length - 1]], opts.origin);
  return total;
}

function nearestNeighbor(points: readonly LatLng[], first: number | null, origin: LatLng | null): number[] {
  const remaining = new Set(points.map((_, i) => i));
  const order: number[] = [];
  let current: LatLng | null = origin;

  if (first !== null) {
    order.push(first);
    remaining.delete(first);
    current = points[first];
  }
  while (remaining.size > 0) {
    let best = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const i of remaining) {
      const d = current ? haversineMeters(current, points[i]) : 0;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    order.push(best);
    remaining.delete(best);
    current = points[best];
  }
  return order;
}

/** Improves an order by reversing segments while it shortens the path (2-opt). */
function twoOpt(points: readonly LatLng[], order: number[], opts: OrderOptions): number[] {
  let best = order;
  let bestLen = pathLength(points, best, opts);
  let improved = true;
  // n is small (<= ~12 stops), so full recomputation per swap is cheap.
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const next = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        const len = pathLength(points, next, opts);
        if (len + 1e-6 < bestLen) {
          best = next;
          bestLen = len;
          improved = true;
        }
      }
    }
  }
  return best;
}

/**
 * Returns indices of `points` in a short visiting order.
 * With an origin: nearest-neighbor from the origin, then 2-opt.
 * Without one: tries every point as the start, keeps the shortest, then 2-opt.
 */
export function orderPoints(points: readonly LatLng[], opts: OrderOptions = {}): number[] {
  if (points.length <= 1) return points.map((_, i) => i);
  const origin = opts.origin ?? null;

  let order: number[];
  if (origin) {
    order = nearestNeighbor(points, null, origin);
  } else {
    order = nearestNeighbor(points, 0, null);
    let bestLen = pathLength(points, order);
    for (let s = 1; s < points.length; s++) {
      const candidate = nearestNeighbor(points, s, null);
      const len = pathLength(points, candidate);
      if (len < bestLen) {
        order = candidate;
        bestLen = len;
      }
    }
  }
  return twoOpt(points, order, opts);
}

export function orderStops<T extends ValidatedStop>(stops: readonly T[], opts: OrderOptions = {}): T[] {
  const points = stops.map((s) => ({ lat: s.candidate.lat, lng: s.candidate.lng }));
  return orderPoints(points, opts).map((i) => stops[i]);
}

/** Parses "HH:MM" (24h) to minutes since midnight. Throws on invalid input. */
export function parseTime(value: string): number {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) throw new Error(`Invalid time "${value}", expected HH:MM`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const h = Math.floor(clamped / 60).toString().padStart(2, "0");
  const m = (clamped % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export interface ScheduleOptions {
  dayStart: string;
  dayEnd: string;
  origin?: LatLng | null;
  /** Reserve time to drive back to `origin` before `dayEnd`. */
  returnToOrigin?: boolean;
}

export interface Schedule {
  stops: ScheduledStop[];
  /** Stops removed because they did not fit before `dayEnd`. */
  dropped: ValidatedStop[];
  totalDriveMinutes: number;
  totalDistanceKm: number;
  endTime: string;
}

/**
 * Assigns arrival/departure times to already-ordered stops. Stops that would
 * end after `dayEnd` (including the drive home, if requested) are dropped.
 * The first stop is always kept so the user never gets an empty route.
 */
export function buildSchedule(ordered: readonly ValidatedStop[], opts: ScheduleOptions): Schedule {
  const startMin = parseTime(opts.dayStart);
  const endMin = parseTime(opts.dayEnd);
  if (endMin <= startMin) throw new Error("dayEnd must be after dayStart");

  const origin = opts.origin ?? null;
  const scheduled: ScheduledStop[] = [];
  const dropped: ValidatedStop[] = [];
  let clock = startMin;
  let prev: LatLng | null = origin;
  let totalDrive = 0;
  let totalMeters = 0;

  for (const stop of ordered) {
    const here = { lat: stop.candidate.lat, lng: stop.candidate.lng };
    const legMeters = prev ? haversineMeters(prev, here) : 0;
    const driveMin = estimateDriveMinutes(legMeters);
    const arrival = clock + driveMin;
    const departure = arrival + stop.visitMinutes;
    const homeMin = origin && opts.returnToOrigin ? estimateDriveMinutes(haversineMeters(here, origin)) : 0;

    // Once one stop overflows, the rest are dropped too, so the order stays intact.
    if (dropped.length > 0 || (scheduled.length > 0 && departure + homeMin > endMin)) {
      dropped.push(stop);
      continue;
    }

    scheduled.push({
      ...stop,
      orderIndex: scheduled.length,
      arrivalTime: formatTime(arrival),
      departureTime: formatTime(departure),
      driveMinutesFromPrev: driveMin,
      distanceFromPrevKm: Math.round((legMeters * ROAD_FACTOR) / 100) / 10,
    });
    clock = departure;
    prev = here;
    totalDrive += driveMin;
    totalMeters += legMeters;
  }

  return {
    stops: scheduled,
    dropped,
    totalDriveMinutes: totalDrive,
    totalDistanceKm: Math.round((totalMeters * ROAD_FACTOR) / 100) / 10,
    endTime: formatTime(clock),
  };
}
