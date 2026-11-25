// Agent 4 — planning & optimisation (deterministic: no LLM).
// Picks the day's stops from the places agent 3 approved, assigns each a time-of-day slot
// (hard hikes early, water/shade at midday, viewpoints at sunset), orders them with travel
// times, and builds a schedule that ends by dark.

import { defaultVisitMinutes } from "@/lib/ai-route/categories";
import { estimateDriveMinutes, formatTime, haversineMeters, parseTime, ROAD_FACTOR } from "@/lib/ai-route/sequence";
import { fetchMapboxMatrix } from "@/lib/trip-bucket/mapbox-matrix";
import { heldKarp, type DistanceMatrix } from "@/lib/trip-bucket/tsp-engine";
import type { AssessedPlace, ConditionNote } from "./conditions-agent";
import type { TripIntent } from "./intent-agent";
import type { PoiCandidate } from "./types";

export type Slot = "morning" | "midday" | "afternoon" | "sunset";
const SLOT_RANK: Record<Slot, number> = { morning: 0, midday: 1, afternoon: 2, sunset: 3 };

const VIEWPOINT = new Set(["מצפה", "נוף", "חוף"]);
const HIKING = new Set(["נחל", "מסלול", "שמורת טבע", "גיאולוגיה", "טבע"]);
const COOL = new Set(["מעיין", "מים", "יער"]);

export const MIN_VISIT = 20;
export const MAX_VISIT = 300;
/** Above this much walking in one day, extra hikes are dropped. */
export const MAX_HIKING_MINUTES = 360;
export const MAX_HARD_HIKES = 1;
/** A hike must start at least this long before sunset. */
export const HIKE_DAYLIGHT_BUFFER = 90;
/** Viewpoints/beaches end up to 30 min after sunset; everything else by sunset. */
export const AFTER_SUNSET_GRACE = 30;
/** Sunset spot: arrive about an hour before sunset; wait at most this long for it. */
export const SUNSET_ARRIVE_BEFORE = 60;
export const MAX_SUNSET_WAIT = 90;
/** If slot order costs this much more driving than the shortest order, use the shortest order. */
export const SLOT_ORDER_MAX_EXTRA_DRIVE = 60;
/** Used when the forecast had no sunset (November-ish in Israel). */
export const DEFAULT_SUNSET = "16:45";

export interface PlannedStop {
  place: PoiCandidate;
  slot: Slot;
  visitMinutes: number;
  arrivalTime: string;
  departureTime: string;
  driveMinutesFromPrev: number;
  distanceFromPrevKm: number;
  /** Minutes spent waiting before this stop (e.g. for sunset). */
  waitMinutes: number;
  conditions: ConditionNote[];
}

export type DropReason = "too_many_stops" | "second_hard_hike" | "hiking_limit" | "no_daylight" | "day_full";

export interface DayPlan {
  stops: PlannedStop[];
  dropped: { place: PoiCandidate; reason: DropReason }[];
  startTime: string;
  endTime: string;
  sunset: string;
  totalDriveMinutes: number;
  totalDistanceKm: number;
  totalHikingMinutes: number;
  travelSource: "mapbox" | "estimate";
  orderStrategy: "time_of_day" | "shortest_drive";
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function visitMinutes(p: PoiCandidate): number {
  const v = p.durationMinutes ?? defaultVisitMinutes(p.category);
  return Math.min(MAX_VISIT, Math.max(MIN_VISIT, Math.round(v)));
}

export function isHike(p: PoiCandidate): boolean {
  return HIKING.has(p.category);
}

export function slotFor(p: PoiCandidate): Slot {
  if (VIEWPOINT.has(p.category)) return "sunset";
  if (isHike(p) && (p.difficulty === "מאתגר" || visitMinutes(p) >= 150)) return "morning";
  if (COOL.has(p.category) || p.hasWater || p.hasShade) return "midday";
  if (isHike(p)) return "morning";
  return "afternoon";
}

/** Driving-minutes matrix: Mapbox when MAPBOX_TOKEN is set, else straight-line × road factor. */
export async function travelMatrix(places: PoiCandidate[]): Promise<{ matrix: DistanceMatrix; source: DayPlan["travelSource"] }> {
  const nodes = places.map((p) => ({ id: String(p.id), name: p.name, latitude: p.lat, longitude: p.lng, duration_minutes: 0 }));
  const mapbox = places.length > 1 ? await fetchMapboxMatrix(nodes).catch(() => null) : null;
  if (mapbox) return { matrix: mapbox, source: "mapbox" };
  const matrix = places.map((a) => places.map((b) => (a === b ? 0 : estimateDriveMinutes(haversineMeters(a, b)))));
  return { matrix, source: "estimate" };
}

function pathDrive(order: number[], m: DistanceMatrix): number {
  let t = 0;
  for (let i = 1; i < order.length; i++) t += m[order[i - 1]][order[i]];
  return t;
}

/** Slot order; within a slot, nearest neighbour from the previous stop. */
export function slotOrder(slots: Slot[], m: DistanceMatrix): number[] {
  const idx = slots.map((_, i) => i).sort((a, b) => SLOT_RANK[slots[a]] - SLOT_RANK[slots[b]] || a - b);
  const order: number[] = [];
  for (const rank of [0, 1, 2, 3]) {
    const group = new Set(idx.filter((i) => SLOT_RANK[slots[i]] === rank));
    while (group.size) {
      const last = order.at(-1);
      let best = -1;
      for (const i of group) if (best < 0 || (last !== undefined && m[last][i] < m[last][best])) best = i;
      order.push(best);
      group.delete(best);
    }
  }
  return order;
}

/** Shortest open path; a sunset spot (if any) is pinned as the last stop. */
export function shortestOrder(slots: Slot[], m: DistanceMatrix): number[] {
  const sunset = slots.findIndex((s) => s === "sunset");
  const all = slots.map((_, i) => i);
  if (sunset < 0) return heldKarp(m).map((k) => all[k]);
  // Pin the sunset spot as node 0 of a fixed-start tour, then reverse so it comes last.
  const nodes = [sunset, ...all.filter((i) => i !== sunset)];
  const sub = nodes.map((i) => nodes.map((j) => m[j][i])); // transposed: we walk the path backwards
  return heldKarp(sub, true).map((k) => nodes[k]).reverse();
}

/** Chooses which places make the day, in priority order (agent 2's ranking). */
export function selectStops(places: AssessedPlace[], maxStops: number): {
  chosen: AssessedPlace[];
  dropped: DayPlan["dropped"];
} {
  const chosen: AssessedPlace[] = [];
  const dropped: DayPlan["dropped"] = [];
  let hard = 0;
  let hiking = 0;
  for (const a of places) {
    const p = a.place;
    if (chosen.length >= maxStops) { dropped.push({ place: p, reason: "too_many_stops" }); continue; }
    if (isHike(p) && p.difficulty === "מאתגר" && hard >= MAX_HARD_HIKES) { dropped.push({ place: p, reason: "second_hard_hike" }); continue; }
    if (isHike(p) && hiking + visitMinutes(p) > MAX_HIKING_MINUTES) { dropped.push({ place: p, reason: "hiking_limit" }); continue; }
    if (isHike(p)) { hiking += visitMinutes(p); if (p.difficulty === "מאתגר") hard++; }
    chosen.push(a);
  }
  return { chosen, dropped };
}

// ── Agent ─────────────────────────────────────────────────────────────────────

export interface PlannerInput {
  intent: Pick<TripIntent, "start_time" | "max_stops">;
  /** Approved places, best first. */
  places: AssessedPlace[];
  /** Approved spares from the wider pool: used only to fill free stops, after `places`. */
  spares?: AssessedPlace[];
  sunset: string | null;
}

export interface PlannerDeps {
  matrix?: (places: PoiCandidate[]) => Promise<{ matrix: DistanceMatrix; source: DayPlan["travelSource"] }>;
}

export async function runPlannerAgent(input: PlannerInput, deps: PlannerDeps = {}): Promise<DayPlan> {
  const sunset = input.sunset ?? DEFAULT_SUNSET;
  const sunsetMin = parseTime(sunset);
  const startMin = parseTime(input.intent.start_time);
  const { chosen, dropped: shortlistDropped } = selectStops(input.places, input.intent.max_stops);
  // Fill free stops from spares (same rules); spares that don't fit aren't reported as dropped.
  const free = input.intent.max_stops - chosen.length;
  if (free > 0 && input.spares?.length) {
    const fill = selectStops([...chosen, ...input.spares], input.intent.max_stops).chosen.slice(chosen.length);
    chosen.push(...fill);
  }
  const dropped = shortlistDropped;

  // Slots, with at most one sunset spot (the first chosen viewpoint).
  let sawSunset = false;
  const slots = chosen.map((a): Slot => {
    const s = slotFor(a.place);
    if (s !== "sunset") return s;
    if (sawSunset) return "afternoon";
    sawSunset = true;
    return s;
  });

  const places = chosen.map((a) => a.place);
  const { matrix, source } = await (deps.matrix ?? travelMatrix)(places);

  let order = slotOrder(slots, matrix);
  let strategy: DayPlan["orderStrategy"] = "time_of_day";
  if (places.length > 2) {
    const short = shortestOrder(slots, matrix);
    if (pathDrive(order, matrix) - pathDrive(short, matrix) > SLOT_ORDER_MAX_EXTRA_DRIVE) {
      order = short;
      strategy = "shortest_drive";
    }
  }

  const stops: PlannedStop[] = [];
  let clock = startMin;
  let prev = -1;
  let totalDrive = 0;
  let totalMeters = 0;
  let hikingMinutes = 0;

  for (const i of order) {
    const a = chosen[i];
    const p = a.place;
    const visit = visitMinutes(p);
    const drive = prev < 0 ? 0 : Math.round(matrix[prev][i]);
    let arrival = clock + drive;
    let wait = 0;
    let slot = slots[i];
    if (slot === "sunset") {
      const ideal = sunsetMin - SUNSET_ARRIVE_BEFORE;
      // Wait for sunset only if it's worth it; a partial wait would still miss it.
      if (arrival < ideal && ideal - arrival <= MAX_SUNSET_WAIT) {
        wait = ideal - arrival;
        arrival = ideal;
      } else if (arrival < ideal) {
        slot = "afternoon";
      }
    }
    const departure = arrival + visit;
    const limit = sunsetMin + (VIEWPOINT.has(p.category) ? AFTER_SUNSET_GRACE : 0);

    const needsLight = isHike(p) && arrival > sunsetMin - HIKE_DAYLIGHT_BUFFER;
    if (stops.length > 0 && (needsLight || departure > limit)) {
      dropped.push({ place: p, reason: needsLight ? "no_daylight" : "day_full" });
      continue; // later stops may still fit (e.g. a short viewpoint)
    }

    const meters = prev < 0 ? 0 : haversineMeters(chosen[prev].place, p);
    stops.push({
      place: p,
      slot,
      visitMinutes: visit,
      arrivalTime: formatTime(arrival),
      departureTime: formatTime(departure),
      driveMinutesFromPrev: drive,
      distanceFromPrevKm: Math.round((meters * ROAD_FACTOR) / 100) / 10,
      waitMinutes: wait,
      conditions: a.notes,
    });
    clock = departure;
    prev = i;
    totalDrive += drive;
    totalMeters += meters;
    if (isHike(p)) hikingMinutes += visit;
  }

  return {
    stops,
    dropped,
    startTime: formatTime(startMin),
    endTime: formatTime(clock),
    sunset,
    totalDriveMinutes: totalDrive,
    totalDistanceKm: Math.round((totalMeters * ROAD_FACTOR) / 100) / 10,
    totalHikingMinutes: hikingMinutes,
    travelSource: source,
    orderStrategy: strategy,
  };
}
