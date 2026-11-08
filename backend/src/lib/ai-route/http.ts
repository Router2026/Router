// Request parsing and response mapping for POST /api/ai/generate-route.
// Kept separate from the route handler so it can be unit-tested without Next.js.

import { z } from "zod";
import { isTripStyle, type TripStyle } from "./categories";
import { fallbackReasoning } from "./fallback";
import type { PlannedRoute } from "./generate";
import { GROUP_TYPES, MAX_STOPS, MIN_STOPS, type RoutePreferences } from "./plan-input";
import { parseTime } from "./sequence";

/** Shortest day window we accept, in minutes. */
export const MIN_WINDOW_MINUTES = 60;

const TimeSchema = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/);

const RequestSchema = z.object({
  region: z.string().trim().min(1).max(100),
  groupType: z.enum(GROUP_TYPES),
  styles: z.array(z.string().max(40)).max(12).default([]),
  startTime: TimeSchema.default("09:00"),
  endTime: TimeSchema.default("16:00"),
  userLocation: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .nullable()
    .optional(),
  maxStops: z.number().int().min(MIN_STOPS).max(MAX_STOPS).nullable().optional(),
  // Accepted for backward compatibility; food/coffee are not part of the nature planner.
  includeFood: z.boolean().optional(),
  includeCoffee: z.boolean().optional(),
});

export interface ParsedRouteRequest {
  region: string;
  groupType: RoutePreferences["groupType"];
  styles: TripStyle[];
  dayStart: string;
  dayEnd: string;
  start: { lat: number; lng: number } | null;
  maxStops: number | null;
}

export type ParseResult =
  | { ok: true; value: ParsedRouteRequest }
  | { ok: false; message: string };

/** Normalizes "9:05" to "09:05". */
function normalizeTime(t: string): string {
  const [h, m] = t.split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

export function parseRouteRequest(body: unknown): ParseResult {
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join(".") || "body";
    return { ok: false, message: `ערך לא תקין בשדה: ${field}` };
  }
  const v = parsed.data;
  const dayStart = normalizeTime(v.startTime);
  const dayEnd = normalizeTime(v.endTime);
  if (parseTime(dayEnd) - parseTime(dayStart) < MIN_WINDOW_MINUTES) {
    return { ok: false, message: "שעת הסיום חייבת להיות לפחות שעה אחרי שעת ההתחלה" };
  }

  return {
    ok: true,
    value: {
      region: v.region,
      groupType: v.groupType,
      // Unknown styles are ignored rather than rejected, so new UI options degrade gracefully.
      styles: [...new Set(v.styles.filter(isTripStyle))],
      dayStart,
      dayEnd,
      start: v.userLocation ?? null,
      maxStops: v.maxStops ?? null,
    },
  };
}

const STYLE_LABELS: Record<TripStyle, string> = {
  history: "היסטוריה", water: "מים", photo: "צילום", nature: "טבע",
  hiking: "טיולים", beach: "חוף", geology: "גיאולוגיה",
  wine: "נוף", village: "כפרים", family_activities: "לילדים",
};

const GROUP_LABELS: Record<RoutePreferences["groupType"], string> = {
  solo: "יחיד", couple: "זוג", family: "משפחה", friends: "חברים",
};

export interface ApiRouteStop {
  location_id: number;
  poi_name: string;
  category: string;
  latitude: number;
  longitude: number;
  main_image: string | null;
  order_index: number;
  arrival_time: string;
  departure_time: string;
  duration_minutes: number;
  drive_minutes_from_prev: number;
  distance_from_prev_km: number;
  smart_insight: string;
}

export interface ApiRoute {
  name: string;
  description: string;
  region: string;
  region_id: number;
  group_type: string;
  style: string;
  source: PlannedRoute["source"];
  start_time: string;
  end_time: string;
  total_duration_hours: number;
  total_distance_km: number;
  total_drive_minutes: number;
  stops: ApiRouteStop[];
}

/** Maps a planned route to the API response. Every stop field comes from the DB candidate. */
export function toApiRoute(
  route: PlannedRoute,
  req: ParsedRouteRequest,
  region: { id: number; name: string },
): ApiRoute {
  const totalMinutes = Math.max(0, parseTime(route.endTime) - parseTime(req.dayStart));
  return {
    name: route.title,
    description: `מסלול מותאם ל${GROUP_LABELS[req.groupType]} באזור ${region.name}`,
    region: region.name,
    region_id: region.id,
    group_type: req.groupType,
    style: req.styles.map((s) => STYLE_LABELS[s]).join(", ") || "טבע",
    source: route.source,
    start_time: req.dayStart,
    end_time: route.endTime,
    total_duration_hours: Math.round((totalMinutes / 60) * 10) / 10,
    total_distance_km: route.totalDistanceKm,
    total_drive_minutes: route.totalDriveMinutes,
    stops: route.stops.map((s) => ({
      location_id: s.candidate.locationId,
      poi_name: s.candidate.name,
      category: s.candidate.category,
      latitude: s.candidate.lat,
      longitude: s.candidate.lng,
      main_image: s.candidate.mainImage,
      order_index: s.orderIndex,
      arrival_time: s.arrivalTime,
      departure_time: s.departureTime,
      duration_minutes: s.visitMinutes,
      drive_minutes_from_prev: s.driveMinutesFromPrev,
      distance_from_prev_km: s.distanceFromPrevKm,
      smart_insight: s.reasoning || fallbackReasoning(s.candidate.category),
    })),
  };
}
