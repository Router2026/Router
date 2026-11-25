// Agent 3 — enrichment & safety (deterministic: no LLM).
// Fetches the forecast for each candidate from Open-Meteo (free, no key) and applies fixed
// safety rules. A safety decision should not depend on a model's judgement, so this is code.
// Only place coordinates leave the server — no user data.
//
// Not covered: road closures (no reliable public API in Israel) and traffic (needs MAPBOX_TOKEN).

import type { TripIntent } from "./intent-agent";
import type { PoiCandidate } from "./types";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
export const WEATHER_TIMEOUT_MS = 5000;
/** Open-Meteo forecasts 16 days ahead (today + 15). */
export const MAX_FORECAST_DAYS_AHEAD = 15;
/** Spares from agent 2's pool assessed alongside the shortlist, so rejected places can be replaced. */
export const MAX_SPARES = 8;

// ── Thresholds ────────────────────────────────────────────────────────────────
// Desert flash floods start from rain far upstream, so a small amount (or a likely chance) is enough.
export const DESERT_FLOOD_MM = 2;
export const DESERT_FLOOD_PROB = 50;
export const STREAM_REJECT_MM = 15;
export const STREAM_WARN_MM = 5;
export const HEAT_WARN_C = 32;
export const HEAT_HARD_REJECT_C = 35;
export const HEAT_EXPOSED_REJECT_C = 38;
export const WIND_WARN_KMH = 60;

/** Categories where walking in or along a streambed / canyon is the activity. */
const STREAMBED = new Set(["נחל", "מסלול", "גיאולוגיה", "שמורת טבע", "מעיין", "מים"]);
/** Outdoor walking categories (heat exposure). */
const HIKING = new Set(["נחל", "מסלול", "שמורת טבע", "גיאולוגיה", "טבע", "יער"]);
const VIEWPOINT = new Set(["מצפה", "נוף"]);

/** Judean desert / Dead Sea / Negev / Arava, approximated by coordinates (region names in the DB are coarse). */
export function isDesert(lat: number, lng: number): boolean {
  return lat < 31.4 || (lat < 31.95 && lng > 35.25);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DayWeather {
  tempMaxC: number | null;
  precipMm: number | null;
  precipProb: number | null;
  gustsKmh: number | null;
  /** Rain the day before (matters for floods and muddy trails). */
  prevPrecipMm: number | null;
  sunrise: string | null; // "HH:MM"
  sunset: string | null; // "HH:MM"
}

/** Codes, so agent 5 can phrase them in the user's language. */
export type ConditionCode =
  | "flash_flood_risk"
  | "heavy_rain_streams"
  | "rain"
  | "extreme_heat_hard_hike"
  | "extreme_heat_exposed"
  | "heat"
  | "strong_wind"
  | "no_forecast";

export interface ConditionNote {
  code: ConditionCode;
  severity: "warning" | "reject";
  detail: string; // English, for logs and as model input
}

export interface AssessedPlace {
  place: PoiCandidate;
  weather: DayWeather | null;
  notes: ConditionNote[];
  rejected: boolean;
}

export interface ConditionsReport {
  date: string;
  forecastAvailable: boolean;
  /** Shortlist places that passed, in agent 2's order. */
  approved: AssessedPlace[];
  /** Pool places that passed — replacements for agents 4 / 6. */
  approvedSpares: AssessedPlace[];
  rejected: AssessedPlace[];
  /** Day-level sunrise / sunset (from the first place with data). */
  sunrise: string | null;
  sunset: string | null;
}

// ── Rules ─────────────────────────────────────────────────────────────────────

export function assessPlace(place: PoiCandidate, w: DayWeather | null): ConditionNote[] {
  if (!w) return [{ code: "no_forecast", severity: "warning", detail: "no forecast available for this date" }];
  const notes: ConditionNote[] = [];
  const rain = Math.max(w.precipMm ?? 0, w.prevPrecipMm ?? 0);
  const prob = w.precipProb ?? 0;
  const streambed = STREAMBED.has(place.category);
  const desert = isDesert(place.lat, place.lng);

  if (streambed && desert && (rain >= DESERT_FLOOD_MM || prob >= DESERT_FLOOD_PROB)) {
    notes.push({ code: "flash_flood_risk", severity: "reject", detail: `desert streambed, rain ${rain}mm / ${prob}% chance` });
  } else if (streambed && rain >= STREAM_REJECT_MM) {
    notes.push({ code: "heavy_rain_streams", severity: "reject", detail: `heavy rain ${rain}mm` });
  } else if (rain >= STREAM_WARN_MM || prob >= 60) {
    notes.push({ code: "rain", severity: "warning", detail: `rain ${rain}mm / ${prob}% chance` });
  }

  const t = w.tempMaxC;
  if (t !== null && HIKING.has(place.category)) {
    if (t >= HEAT_HARD_REJECT_C && place.difficulty === "מאתגר") {
      notes.push({ code: "extreme_heat_hard_hike", severity: "reject", detail: `${t}°C on a hard hike` });
    } else if (t >= HEAT_EXPOSED_REJECT_C && !place.hasShade) {
      notes.push({ code: "extreme_heat_exposed", severity: "reject", detail: `${t}°C without shade` });
    } else if (t >= HEAT_WARN_C) {
      notes.push({ code: "heat", severity: "warning", detail: `${t}°C` });
    }
  }

  if ((w.gustsKmh ?? 0) >= WIND_WARN_KMH && (VIEWPOINT.has(place.category) || HIKING.has(place.category))) {
    notes.push({ code: "strong_wind", severity: "warning", detail: `gusts ${w.gustsKmh} km/h` });
  }
  return notes;
}

// ── Open-Meteo ────────────────────────────────────────────────────────────────

/** ~11 km grid: nearby places share one forecast point, keeping the request small. */
const gridKey = (lat: number, lng: number) => `${lat.toFixed(1)},${lng.toFixed(1)}`;

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

interface OpenMeteoPoint {
  daily?: {
    time?: string[];
    temperature_2m_max?: (number | null)[];
    precipitation_sum?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    wind_gusts_10m_max?: (number | null)[];
    sunrise?: (string | null)[];
    sunset?: (string | null)[];
  };
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const hhmm = (iso: unknown) => (typeof iso === "string" && /T\d{2}:\d{2}/.test(iso) ? iso.slice(11, 16) : null);

export function parseDay(point: OpenMeteoPoint, date: string): DayWeather | null {
  const d = point.daily;
  const i = d?.time?.indexOf(date) ?? -1;
  if (!d || i < 0) return null;
  const prev = d.time!.indexOf(addDays(date, -1));
  return {
    tempMaxC: num(d.temperature_2m_max?.[i]),
    precipMm: num(d.precipitation_sum?.[i]),
    precipProb: num(d.precipitation_probability_max?.[i]),
    gustsKmh: num(d.wind_gusts_10m_max?.[i]),
    prevPrecipMm: prev >= 0 ? num(d.precipitation_sum?.[prev]) : null,
    sunrise: hhmm(d.sunrise?.[i]),
    sunset: hhmm(d.sunset?.[i]),
  };
}

export type WeatherFetcher = (points: { lat: number; lng: number }[], date: string) => Promise<(DayWeather | null)[]>;

export const fetchOpenMeteo: WeatherFetcher = async (points, date) => {
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat.toFixed(2)).join(","),
    longitude: points.map((p) => p.lng.toFixed(2)).join(","),
    daily: "temperature_2m_max,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max,sunrise,sunset",
    timezone: "Asia/Jerusalem",
    start_date: addDays(date, -1),
    end_date: date,
  });
  const res = await fetch(`${OPEN_METEO_URL}?${params}`, { signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  const body: unknown = await res.json();
  // One point → a single object; several → an array in request order.
  const list = (Array.isArray(body) ? body : [body]) as OpenMeteoPoint[];
  return points.map((_, i) => (list[i] ? parseDay(list[i], date) : null));
};

// ── Agent ─────────────────────────────────────────────────────────────────────

export interface ConditionsDeps {
  fetchWeather?: WeatherFetcher;
  /** YYYY-MM-DD in Israel (israelToday). */
  today: string;
}

export async function runConditionsAgent(
  intent: TripIntent,
  shortlist: PoiCandidate[],
  pool: PoiCandidate[],
  deps: ConditionsDeps,
): Promise<ConditionsReport> {
  const inShortlist = new Set(shortlist.map((c) => c.id));
  const spares = pool.filter((c) => !inShortlist.has(c.id)).slice(0, MAX_SPARES);
  const all = [...shortlist, ...spares];

  // Fetch one forecast per grid cell.
  const cells = new Map<string, { lat: number; lng: number }>();
  for (const c of all) cells.set(gridKey(c.lat, c.lng), { lat: c.lat, lng: c.lng });
  const keys = [...cells.keys()];

  let byCell = new Map<string, DayWeather | null>();
  let forecastAvailable = false;
  const ahead = daysBetween(deps.today, intent.date);
  if (keys.length && ahead >= 0 && ahead <= MAX_FORECAST_DAYS_AHEAD) {
    try {
      const days = await (deps.fetchWeather ?? fetchOpenMeteo)(keys.map((k) => cells.get(k)!), intent.date);
      byCell = new Map(keys.map((k, i) => [k, days[i] ?? null]));
      forecastAvailable = days.some((d) => d !== null);
    } catch (err) {
      // Fail open with a visible "no_forecast" warning on every place; agent 5 tells the user to check.
      console.error("[trip-agents:conditions] weather fetch failed", err);
    }
  }

  const assess = (place: PoiCandidate): AssessedPlace => {
    const weather = byCell.get(gridKey(place.lat, place.lng)) ?? null;
    const notes = assessPlace(place, weather);
    return { place, weather, notes, rejected: notes.some((n) => n.severity === "reject") };
  };

  const assessedShort = shortlist.map(assess);
  const assessedSpares = spares.map(assess);
  const firstWithSun = [...assessedShort, ...assessedSpares].find((a) => a.weather?.sunset);

  return {
    date: intent.date,
    forecastAvailable,
    approved: assessedShort.filter((a) => !a.rejected),
    approvedSpares: assessedSpares.filter((a) => !a.rejected),
    rejected: [...assessedShort, ...assessedSpares].filter((a) => a.rejected),
    sunrise: firstWithSun?.weather?.sunrise ?? null,
    sunset: firstWithSun?.weather?.sunset ?? null,
  };
}
