import type { POI } from '../api';
import type { BucketItem, UserLocation } from './types';

export interface RouteStopPoint {
  poi: POI;
  /** 1-based stop number shown on the marker. */
  index: number;
  lat: number;
  lng: number;
}

/** Stops in bucket order, skipping items without usable coordinates. */
export function buildRouteStops(items: BucketItem[]): RouteStopPoint[] {
  const stops: RouteStopPoint[] = [];
  for (const { poi } of items) {
    const lat = Number(poi.latitude);
    const lng = Number(poi.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
    stops.push({ poi, index: stops.length + 1, lat, lng });
  }
  return stops;
}

/** Points to fit in view: all stops, plus the user's position when known. */
export function routeBoundsPoints(stops: RouteStopPoint[], user: UserLocation | null): [number, number][] {
  const pts: [number, number][] = stops.map(s => [s.lat, s.lng]);
  if (user && pts.length) pts.unshift([user.lat, user.lng]);
  return pts;
}

/** Straight-line length of the route in km (user → stops when the location is known). */
export function routeLengthKm(stops: RouteStopPoint[], user: UserLocation | null): number {
  const pts = routeBoundsPoints(stops, user);
  let km = 0;
  for (let i = 1; i < pts.length; i++) km += haversineKm(pts[i - 1], pts[i]);
  return km;
}

function haversineKm([lat1, lng1]: [number, number], [lat2, lng2]: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
