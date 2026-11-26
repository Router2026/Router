// Trip Bucket "smart build" on top of the agents. The user already picked the places, so
// agents 1 (intent), 2 (search) and 6 (review — it could swap places) are skipped:
//   3 conditions → 4 planner (respecting the selection) → 5 summary.
// Agents 3 and 4 are plain code, so the plan still works when the model is unavailable;
// only the prose falls back to a plain summary.

import type { BucketPoi, SmartPlan } from "@/lib/trip-bucket/types";
import { runConditionsAgent, type ConditionsReport, type WeatherFetcher } from "./conditions-agent";
import type { TripIntent } from "./intent-agent";
import { emptyUsage, israelToday, type AgentUsage } from "./llm";
import { MAX_LEG_MINUTES, runPlannerAgent, type DayPlan, type PlannerDeps, type Slot } from "./planner-agent";
import { planReason, stopReasons } from "./reasons";
import { conditionsDetail, plannerDetail, summaryDetail, type StepListener } from "./progress";
import { fallbackSummary, runSummaryAgent, type SummaryDeps, type TripSummary } from "./summary-agent";
import type { PoiCandidate } from "./types";

export const SLOT_LABEL_HE: Record<Slot, string> = { morning: "בוקר", midday: "צהריים", afternoon: "אחר הצהריים", sunset: "שקיעה" };

const DROP_REASON_HE: Record<string, string> = {
  no_daylight: "לא נשאר מספיק אור יום למסלול הליכה",
  day_full: "לא נכנס ביום עד החשכה",
  too_many_stops: "יותר מדי עצירות ליום אחד",
  second_hard_hike: "מסלול מאתגר שני באותו יום",
  hiking_limit: "יותר מדי שעות הליכה ביום אחד",
  too_far: "רחוק מדי מהעצירה הקודמת",
  past_end_time: "לא נכנס עד שעת הסיום",
};
const CONDITION_HE: Record<string, string> = {
  flash_flood_risk: "סכנת שיטפונות בנחל מדברי",
  heavy_rain_streams: "גשם כבד בנחלים",
  extreme_heat_hard_hike: "חום כבד במסלול מאתגר",
  extreme_heat_exposed: "חום כבד במקום ללא צל",
};

export function bucketPoiToCandidate(p: BucketPoi): PoiCandidate {
  return {
    id: Number(p.id),
    name: p.name,
    category: p.category,
    regionName: p.region || null,
    lat: p.latitude,
    lng: p.longitude,
    durationMinutes: p.duration_minutes || null,
    difficulty: p.difficulty || null,
    hasWater: !!p.has_water,
    hasShade: !!p.has_shade,
    accessible: !!p.accessible,
    rating: Number.isFinite(p.average_rating) ? p.average_rating : null,
    description: p.description ?? "",
    mainImage: null,
    sources: ["postgis"],
  };
}

export function bucketIntent(count: number, today: string, startTime = "08:00"): TripIntent {
  return {
    regions: [], styles: [], difficulty: "any", needs_water: false, needs_shade: false, needs_accessible: false,
    date: today, start_time: startTime, max_stops: count, anchor: null, search_query_he: "", language: "he",
  };
}

export interface BucketResult {
  plan: DayPlan;
  summary: TripSummary;
  conditions: ConditionsReport;
  /** Hebrew, user-facing: places left out and why. */
  warnings: string[];
  usage: AgentUsage;
}

export interface BucketDeps {
  now?: Date;
  /** The user's starting point: the first stop is the one nearest to it, with the drive there. */
  origin?: { lat: number; lng: number } | null;
  /** Live progress for the UI (agents 3 → 4 → 5). */
  onStep?: StepListener;
  fetchWeather?: WeatherFetcher;
  planner?: PlannerDeps;
  summary?: Omit<SummaryDeps, "usage">;
}

export async function runBucketPipeline(pois: BucketPoi[], deps: BucketDeps = {}): Promise<BucketResult> {
  const usage = emptyUsage();
  const today = israelToday(deps.now ?? new Date()).date;
  const places = pois.map(bucketPoiToCandidate);
  const intent = { ...bucketIntent(places.length, today), origin: deps.origin ?? null };

  const onStep = deps.onStep ?? (() => {});

  onStep("conditions", "start");
  const conditions = await runConditionsAgent(intent, places, [], { today, fetchWeather: deps.fetchWeather });
  onStep("conditions", "done", conditionsDetail(conditions));

  onStep("planner", "start");
  const plan = await runPlannerAgent(
    { intent, places: conditions.approved, sunset: conditions.sunset, respectSelection: true },
    deps.planner,
  );
  onStep("planner", "done", plannerDetail(plan));

  onStep("summary", "start");
  let summary: TripSummary;
  try {
    summary = await runSummaryAgent("", intent, plan, { ...deps.summary, usage });
  } catch (err) {
    console.error("[trip-agents:bucket] summary failed; using plain summary", err);
    summary = fallbackSummary(intent, plan);
  }
  onStep("summary", "done", summaryDetail(summary));

  const warnings = [
    ...conditions.rejected.map((r) => `${r.place.name} הוצא מהמסלול: ${r.notes.filter((n) => n.severity === "reject").map((n) => CONDITION_HE[n.code] ?? n.code).join(", ")}`),
    ...plan.dropped.map((d) => `${d.place.name} לא נכנס למסלול: ${DROP_REASON_HE[d.reason] ?? d.reason}`),
    // The user picked the places, so a long leg stays in the plan, but say so.
    // (Not the first stop: its drive is from the user's start point, which is expected to be long.)
    ...plan.stops
      .filter((s, i) => i > 0 && s.driveMinutesFromPrev > MAX_LEG_MINUTES)
      .map((s) => `הנסיעה אל ${s.place.name} ארוכה: כ-${s.driveMinutesFromPrev} דקות מהעצירה הקודמת`),
  ];
  return { plan, summary, conditions, warnings, usage };
}

/** The existing smart-build response shape (frontend TripBucketSheet / RouteGenerator). */
export function toSmartPlan(r: BucketResult, hasOrigin = false): SmartPlan {
  const reasons = stopReasons(r.plan, hasOrigin);
  return {
    route_title: r.summary.title,
    route_description: [r.summary.overview, r.summary.whyThisRoute].filter(Boolean).join(" "),
    overview: r.summary.overview,
    why: r.summary.whyThisRoute || planReason(r.plan),
    sunset: r.plan.sunset,
    total_drive_minutes: r.plan.totalDriveMinutes,
    stops: r.plan.stops.map((s, i) => ({
      location_id: String(s.place.id),
      poi_name: s.place.name,
      arrival_time: s.arrivalTime,
      duration_minutes: s.visitMinutes,
      smart_insight: r.summary.tips[s.place.id] ?? "",
      visit_type: SLOT_LABEL_HE[s.slot],
      reason: reasons[i],
      departure_time: s.departureTime,
      drive_minutes_from_prev: s.driveMinutesFromPrev,
      distance_from_prev_km: s.distanceFromPrevKm,
    })),
  };
}
