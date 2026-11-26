// One schedule for the route review/save page, whether the trip agents planned the day (Smart
// Build / free-text planner: their real times, reasons and tips) or the user built it by hand
// (times estimated from straight-line distance, like the backend's estimate).

import type { POI } from '../api';

/** The agents' plan as the smart-build endpoint / AgentPlanner hand it to RouteGenerator. */
export interface PlannedStopMeta {
  location_id: string;
  poi_name: string;
  arrival_time: string;
  departure_time?: string;
  duration_minutes: number;
  smart_insight?: string;
  visit_type?: string;
  reason?: string;
  drive_minutes_from_prev?: number;
  distance_from_prev_km?: number;
}

export interface PlanMeta {
  route_title?: string;
  route_description?: string;
  overview?: string;
  why?: string;
  sunset?: string;
  total_drive_minutes?: number;
  stops: PlannedStopMeta[];
}

export interface ScheduledStop {
  poi: POI;
  arrival: string;
  departure: string;
  durationMinutes: number;
  driveMinutesFromPrev: number;
  /** Why this stop is here, at this time — only for agent-planned routes. */
  reason: string | null;
  tip: string | null;
  slotLabel: string | null;
}

export interface Schedule {
  stops: ScheduledStop[];
  startTime: string;
  endTime: string;
  driveMinutes: number;
  /** True when the times come from the agents, false when estimated here. */
  planned: boolean;
}

const ROAD_FACTOR = 1.3;
const AVG_KMH = 50;
export const DEFAULT_DAY_START = '09:00';

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Driving minutes from straight-line distance, rounded to 5. */
export function estimateDriveMinutes(km: number): number {
  return Math.max(0, Math.round((km * ROAD_FACTOR / AVG_KMH) * 60 / 5) * 5);
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function fromMinutes(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const point = (p: POI) => ({ lat: p.latitude, lng: p.longitude });

export function buildSchedule(
  pois: POI[],
  plan: PlanMeta | null,
  start: { lat: number; lng: number } | null,
  dayStart: string = DEFAULT_DAY_START,
): Schedule {
  const byId = new Map((plan?.stops ?? []).map(s => [String(s.location_id), s]));
  // Use the agents' times only when they cover exactly these stops (the user didn't edit them).
  const planned = !!plan && pois.length > 0 && pois.length === plan.stops.length && pois.every(p => byId.has(String(p.id)));

  if (planned) {
    const stops = pois.map((poi): ScheduledStop => {
      const s = byId.get(String(poi.id))!;
      const departure = s.departure_time ?? fromMinutes(toMinutes(s.arrival_time) + s.duration_minutes);
      return {
        poi, arrival: s.arrival_time, departure, durationMinutes: s.duration_minutes,
        driveMinutesFromPrev: s.drive_minutes_from_prev ?? 0,
        reason: s.reason?.trim() || null, tip: s.smart_insight?.trim() || null, slotLabel: s.visit_type ?? null,
      };
    });
    return {
      stops,
      startTime: stops[0].arrival,
      endTime: stops.at(-1)!.departure,
      driveMinutes: plan!.total_drive_minutes ?? stops.reduce((t, s) => t + s.driveMinutesFromPrev, 0),
      planned: true,
    };
  }

  let clock = toMinutes(dayStart);
  let prev: { lat: number; lng: number } | null = start;
  let driveTotal = 0;
  const stops = pois.map((poi): ScheduledStop => {
    const drive = prev ? estimateDriveMinutes(haversineKm(prev, point(poi))) : 0;
    driveTotal += drive;
    clock += drive;
    const duration = poi.duration_minutes || 60;
    const arrival = fromMinutes(clock);
    clock += duration;
    prev = point(poi);
    return { poi, arrival, departure: fromMinutes(clock), durationMinutes: duration, driveMinutesFromPrev: drive, reason: null, tip: null, slotLabel: null };
  });
  return {
    stops,
    startTime: stops[0]?.arrival ?? dayStart,
    endTime: stops.at(-1)?.departure ?? dayStart,
    driveMinutes: driveTotal,
    planned: false,
  };
}

/** Google Maps directions through every stop (from the start point when known). */
export function googleMapsRouteUrl(points: { lat: number; lng: number }[], origin?: { lat: number; lng: number } | null): string | null {
  if (points.length === 0) return null;
  const fmt = (p: { lat: number; lng: number }) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  const dest = points.at(-1)!;
  // Google Maps URLs accept up to 9 waypoints.
  const waypoints = points.slice(0, -1).slice(0, 9);
  const qs = new URLSearchParams({ api: '1', destination: fmt(dest), travelmode: 'driving' });
  if (origin) qs.set('origin', fmt(origin));
  if (waypoints.length) qs.set('waypoints', waypoints.map(fmt).join('|'));
  return `https://www.google.com/maps/dir/?${qs.toString()}`;
}
