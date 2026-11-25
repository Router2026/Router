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
export const SLOT_ORDER_MAX_EXTRA_DRIVE = 30;
/**
 * Hard limit on driving between consecutive stops. Stops are chosen as a geographic cluster and
 * any longer leg drops the lower-priority stop: a shorter day beats a 68-minute jump to a
 * 45-minute stop. 30 (not 25) so winding roads in the Golan / Galilee / south don't cut close stops.
 */
export const MAX_LEG_MINUTES = 30;
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

export type DropReason = "too_many_stops" | "second_hard_hike" | "hiking_limit" | "no_daylight" | "day_full" | "too_far";

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

export interface SelectOptions {
  /** Trip Bucket: the user picked these places, so no hard-hike / hiking-time / distance limits. */
  respectSelection?: boolean;
  /** Geographic cluster rule: may place `k` join the already chosen indices? */
  isNear?: (k: number, chosen: number[]) => boolean;
  /** Places from this index on are spares: skipped silently instead of reported as dropped. */
  sparesFrom?: number;
}

/** Chooses which places make the day, in priority order (agent 2's ranking). */
export function selectStops(places: AssessedPlace[], maxStops: number, opts: SelectOptions = {}): {
  chosen: AssessedPlace[];
  chosenIdx: number[];
  dropped: DayPlan["dropped"];
} {
  const chosenIdx: number[] = [];
  const dropped: DayPlan["dropped"] = [];
  let hard = 0;
  let hiking = 0;
  places.forEach((a, k) => {
    const p = a.place;
    const drop = (reason: DropReason) => { if (k < (opts.sparesFrom ?? Infinity)) dropped.push({ place: p, reason }); };
    if (chosenIdx.length >= maxStops) return drop("too_many_stops");
    // A user-picked list (Trip Bucket) keeps every place; only daylight can drop one later.
    if (!opts.respectSelection) {
      if (isHike(p) && p.difficulty === "מאתגר" && hard >= MAX_HARD_HIKES) return drop("second_hard_hike");
      if (isHike(p) && hiking + visitMinutes(p) > MAX_HIKING_MINUTES) return drop("hiking_limit");
      if (opts.isNear && chosenIdx.length && !opts.isNear(k, chosenIdx)) return drop("too_far");
    }
    if (isHike(p)) { hiking += visitMinutes(p); if (p.difficulty === "מאתגר") hard++; }
    chosenIdx.push(k);
  });
  return { chosen: chosenIdx.map((k) => places[k]), chosenIdx, dropped };
}

/** Driving minutes between two places in either direction (Mapbox matrices are not symmetric). */
const legMinutes = (m: DistanceMatrix, a: number, b: number) => Math.max(m[a][b], m[b][a]);

/** Slots with at most one sunset spot (the first chosen viewpoint). */
function assignSlots(chosen: AssessedPlace[]): Slot[] {
  let sawSunset = false;
  return chosen.map((a): Slot => {
    const s = slotFor(a.place);
    if (s !== "sunset") return s;
    if (sawSunset) return "afternoon";
    sawSunset = true;
    return s;
  });
}

function chooseOrder(slots: Slot[], m: DistanceMatrix): { order: number[]; strategy: DayPlan["orderStrategy"] } {
  const order = slotOrder(slots, m);
  if (slots.length > 2) {
    const short = shortestOrder(slots, m);
    if (pathDrive(order, m) - pathDrive(short, m) > SLOT_ORDER_MAX_EXTRA_DRIVE) return { order: short, strategy: "shortest_drive" };
  }
  return { order, strategy: "time_of_day" };
}

// ── Agent ─────────────────────────────────────────────────────────────────────

export interface PlannerInput {
  intent: Pick<TripIntent, "start_time" | "max_stops">;
  /** Approved places, best first. */
  places: AssessedPlace[];
  /** Approved spares from the wider pool: used only to fill free stops, after `places`. */
  spares?: AssessedPlace[];
  sunset: string | null;
  /** Trip Bucket: the user picked these places — don't apply the hard-hike / hiking-time limits. */
  respectSelection?: boolean;
}

export interface PlannerDeps {
  matrix?: (places: PoiCandidate[]) => Promise<{ matrix: DistanceMatrix; source: DayPlan["travelSource"] }>;
}

export async function runPlannerAgent(input: PlannerInput, deps: PlannerDeps = {}): Promise<DayPlan> {
  const sunset = input.sunset ?? DEFAULT_SUNSET;
  const sunsetMin = parseTime(sunset);
  const startMin = parseTime(input.intent.start_time);
  const respect = !!input.respectSelection;
  // Shortlist first, then spares (used only to fill free stops). One travel matrix for all of them.
  const pool = [...input.places, ...(input.spares ?? [])];
  const { matrix: full, source } = await (deps.matrix ?? travelMatrix)(pool.map((a) => a.place));

  // 1. Choose stops as a geographic cluster: each new stop within MAX_LEG_MINUTES of a chosen one.
  const sel = selectStops(pool, input.intent.max_stops, {
    respectSelection: respect,
    sparesFrom: input.places.length,
    isNear: (k, chosenNow) => chosenNow.some((j) => legMinutes(full, j, k) <= MAX_LEG_MINUTES),
  });
  const dropped = sel.dropped;
  let idx = sel.chosenIdx; // indices into `pool` / `full`

  // 2. Order. A leg that is still too long (near the cluster is not next to its neighbour in the
  //    order) drops the lower-priority stop of the pair, then re-order.
  let chosen: AssessedPlace[];
  let slots: Slot[];
  let matrix: DistanceMatrix;
  let order: number[];
  let strategy: DayPlan["orderStrategy"];
  for (;;) {
    chosen = idx.map((k) => pool[k]);
    slots = assignSlots(chosen);
    const sub = idx;
    matrix = sub.map((a) => sub.map((b) => full[a][b]));
    ({ order, strategy } = chooseOrder(slots, matrix));
    if (respect) break;
    const m = matrix;
    const o = order;
    const long = o.findIndex((i, n) => n > 0 && m[o[n - 1]][i] > MAX_LEG_MINUTES);
    if (long < 0) break;
    const [a, b] = [o[long - 1], o[long]];
    const loser = idx[a] > idx[b] ? a : b; // higher pool index = lower priority
    if (idx[loser] < input.places.length) dropped.push({ place: pool[idx[loser]].place, reason: "too_far" });
    idx = idx.filter((_, n) => n !== loser);
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
