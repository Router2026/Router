// What the client receives from the trip agents. Every place fact comes from the DB (via the plan);
// prose comes from agent 5. Internal notes (agent 2 match reasons, agent 6 notes) stay in `debug`,
// which only the admin endpoint sends.

import type { ConditionCode } from "./conditions-agent";
import type { PipelineResult } from "./pipeline";
import type { DayPlan, DropReason, Slot } from "./planner-agent";
import type { TripSummary } from "./summary-agent";
import { stopReasons } from "./reasons";

export interface ClientStop {
  id: number;
  name: string;
  category: string;
  region: string | null;
  lat: number;
  lng: number;
  image: string | null;
  difficulty: string | null;
  hasWater: boolean;
  hasShade: boolean;
  accessible: boolean;
  arrival: string;
  departure: string;
  visitMinutes: number;
  driveMinutesFromPrev: number;
  distanceFromPrevKm: number;
  waitMinutes: number;
  slot: Slot;
  tip: string | null;
  /** Why this stop is here, at this time. */
  reason: string;
  conditions: ConditionCode[];
}

export interface ClientPlan {
  title: string;
  overview: string;
  why: string;
  conditionsNote: string | null;
  safetyFooter: string;
  date: string;
  startTime: string;
  endTime: string;
  sunset: string;
  forecastAvailable: boolean;
  totalDriveMinutes: number;
  totalDistanceKm: number;
  stops: ClientStop[];
  /** Places left out and why — shown to the user so nothing disappears silently. */
  dropped: { id: number; name: string; reason: DropReason }[];
  rejected: { id: number; name: string; codes: string[] }[];
}

export function toClientStops(plan: DayPlan, summary: TripSummary): ClientStop[] {
  const reasons = stopReasons(plan);
  return plan.stops.map((s, i) => ({
    id: s.place.id,
    name: s.place.name,
    category: s.place.category,
    region: s.place.regionName,
    lat: s.place.lat,
    lng: s.place.lng,
    image: s.place.mainImage,
    difficulty: s.place.difficulty,
    hasWater: s.place.hasWater,
    hasShade: s.place.hasShade,
    accessible: s.place.accessible,
    arrival: s.arrivalTime,
    departure: s.departureTime,
    visitMinutes: s.visitMinutes,
    driveMinutesFromPrev: s.driveMinutesFromPrev,
    distanceFromPrevKm: s.distanceFromPrevKm,
    waitMinutes: s.waitMinutes,
    slot: s.slot,
    tip: summary.tips[s.place.id] ?? null,
    reason: reasons[i],
    conditions: s.conditions.map((c) => c.code),
  }));
}

export function toClientPlan(r: Pick<PipelineResult, "plan" | "summary" | "conditions" | "intent">): ClientPlan {
  return {
    title: r.summary.title,
    overview: r.summary.overview,
    why: r.summary.whyThisRoute,
    conditionsNote: r.summary.conditionsNote,
    safetyFooter: r.summary.safetyFooter,
    date: r.intent.date,
    startTime: r.plan.startTime,
    endTime: r.plan.endTime,
    sunset: r.plan.sunset,
    forecastAvailable: r.conditions.forecastAvailable,
    totalDriveMinutes: r.plan.totalDriveMinutes,
    totalDistanceKm: r.plan.totalDistanceKm,
    stops: toClientStops(r.plan, r.summary),
    dropped: r.plan.dropped.map((d) => ({ id: d.place.id, name: d.place.name, reason: d.reason })),
    rejected: r.conditions.rejected,
  };
}

/** Admin-only extras for tuning the agents. */
export function toDebug(r: PipelineResult) {
  return {
    intent: r.intent,
    review: r.review,
    meta: r.meta,
  };
}
