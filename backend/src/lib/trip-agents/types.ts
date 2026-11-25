// Shared data passed between the trip-planning agents.

export type CandidateSource = "postgis" | "semantic";

/** A place from the `locations` table. Every field comes from the DB, never from model output. */
export interface PoiCandidate {
  id: number;
  name: string;
  category: string;
  regionName: string | null;
  lat: number;
  lng: number;
  /** null when the DB has no value; planners fall back to a per-category default. */
  durationMinutes: number | null;
  difficulty: string | null;
  hasWater: boolean;
  hasShade: boolean;
  accessible: boolean;
  rating: number | null;
  /** Sanitized, short. Empty for semantic-only hits (the list query has no description). */
  description: string;
  mainImage: string | null;
  sources: CandidateSource[];
  /** Distance from the request's anchor point (e.g. "ליד מצפה רמון"), when there is one. */
  distanceKm?: number | null;
  /** Why agent 2 picked it (model text, sanitized). Shown to later agents, never to users as fact. */
  matchReason?: string;
}

/** DB difficulty values (router.locations.difficulty). */
export const DIFFICULTY_TO_DB = { easy: "קל", moderate: "בינוני", hard: "מאתגר" } as const;
