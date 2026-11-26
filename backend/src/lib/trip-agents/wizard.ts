// The route planner form (TripPlanner → POST /api/ai/generate-route) on top of the trip agents.
// The form already gives region, styles, group, hours and stop count, so agent 1 is skipped:
// the intent is built here, agents 2–6 run, and the result is mapped to the existing ApiRoute
// shape so the page and saving keep working unchanged.

import { resolveCategories, type TripStyle } from "@/lib/ai-route/categories";
import { GROUP_LABELS, STYLE_LABELS, type ApiRoute, type ParsedRouteRequest } from "@/lib/ai-route/http";
import { MAX_STOPS as FORM_MAX_STOPS, MIN_STOPS as FORM_MIN_STOPS } from "@/lib/ai-route/plan-input";
import { parseTime } from "@/lib/ai-route/sequence";
import type { TripIntent } from "./intent-agent";
import { israelToday } from "./llm";
import type { PipelineResult } from "./pipeline";
import { planReason, stopReasons } from "./reasons";

/** Hebrew search phrase per style (agent 2's semantic search). */
const STYLE_PHRASE: Record<TripStyle, string> = {
  water: "מעיינות ומסלולי מים",
  nature: "שמורות טבע ונוף",
  hiking: "מסלולי הליכה",
  photo: "תצפיות ונקודות צילום",
  beach: "חופים",
  history: "אתרים היסטוריים",
  geology: "תופעות גיאולוגיות",
  wine: "נוף כפרי",
  village: "כפרים ואתרים היסטוריים",
  family_activities: "מקומות מתאימים לילדים",
};

/** Typical visit + driving per stop, to size the day when the form doesn't give a count. */
const MINUTES_PER_STOP = 105;

export function stopsForWindow(dayStart: string, dayEnd: string, maxStops: number | null): number {
  const fit = Math.round((parseTime(dayEnd) - parseTime(dayStart)) / MINUTES_PER_STOP);
  const cap = maxStops ?? FORM_MAX_STOPS;
  return Math.max(FORM_MIN_STOPS, Math.min(cap, FORM_MAX_STOPS, fit));
}

export function wizardIntent(req: ParsedRouteRequest, regionSlug: string, now: Date = new Date()): TripIntent {
  const styles = req.styles;
  const phrase = styles.length ? styles.map((s) => STYLE_PHRASE[s]).join(", ") : "טבע ונוף";
  return {
    regions: [regionSlug],
    styles,
    // Families get easy places; other groups take what fits.
    difficulty: req.groupType === "family" ? "easy" : "any",
    needs_water: styles.includes("water"),
    needs_shade: false,
    needs_accessible: false,
    date: israelToday(now).date,
    start_time: req.dayStart,
    end_time: req.dayEnd,
    max_stops: stopsForWindow(req.dayStart, req.dayEnd, req.maxStops),
    anchor: null, // the region decides the area; the start point only adds the drive there
    origin: req.start,
    search_query_he: req.groupType === "family" ? `${phrase} מתאים למשפחות` : phrase,
    language: "he",
  };
}

/** What the user asked, in their words, for agents 6 (review) and 5 (summary). */
export function wizardRequestText(req: ParsedRouteRequest, regionName: string): string {
  const styles = req.styles.map((s) => STYLE_LABELS[s]).join(", ");
  const categories = resolveCategories(req.styles).join(", ");
  return [
    `טיול יום באזור ${regionName} ל${GROUP_LABELS[req.groupType]}`,
    styles ? `בסגנון: ${styles} (${categories})` : "",
    `בין ${req.dayStart} ל-${req.dayEnd}`,
  ].filter(Boolean).join(", ");
}

/** Agents result → the route planner's existing response shape. */
export function agentsToApiRoute(r: PipelineResult, req: ParsedRouteRequest, region: { id: number; name: string }): ApiRoute {
  const totalMinutes = Math.max(0, parseTime(r.plan.endTime) - parseTime(req.dayStart));
  const reasons = stopReasons(r.plan, !!req.start);
  return {
    name: r.summary.title,
    description: r.summary.overview,
    why: r.summary.whyThisRoute || planReason(r.plan),
    sunset: r.plan.sunset,
    region: region.name,
    region_id: region.id,
    group_type: req.groupType,
    style: req.styles.map((s) => STYLE_LABELS[s]).join(", ") || "טבע",
    source: "ai",
    start_time: req.dayStart,
    end_time: r.plan.endTime,
    total_duration_hours: Math.round((totalMinutes / 60) * 10) / 10,
    total_distance_km: r.plan.totalDistanceKm,
    total_drive_minutes: r.plan.totalDriveMinutes,
    stops: r.plan.stops.map((s, i) => ({
      location_id: s.place.id,
      poi_name: s.place.name,
      category: s.place.category,
      latitude: s.place.lat,
      longitude: s.place.lng,
      main_image: s.place.mainImage,
      order_index: i,
      arrival_time: s.arrivalTime,
      departure_time: s.departureTime,
      duration_minutes: s.visitMinutes,
      drive_minutes_from_prev: s.driveMinutesFromPrev,
      distance_from_prev_km: s.distanceFromPrevKm,
      smart_insight: r.summary.tips[s.place.id] ?? "",
      reason: reasons[i],
    })),
  };
}
