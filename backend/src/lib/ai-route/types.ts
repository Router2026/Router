// Shared types for the AI route planning pipeline.
// Flow: categories -> candidates (DB) -> LLM selects keys -> validate -> sequence.

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * A location from the `locations` table that the LLM is allowed to pick.
 * `key` is a short, request-scoped alias (e.g. "L7") shown to the LLM instead
 * of the real DB id. The server maps it back to `locationId`.
 */
export interface Candidate {
  key: string;
  locationId: number;
  name: string;
  category: string;
  /** Sanitized, truncated description. Safe to embed in a prompt as data. */
  description: string;
  lat: number;
  lng: number;
  durationMinutes: number;
  difficulty: string | null;
  hasWater: boolean;
  hasShade: boolean;
  accessible: boolean;
  rating: number | null;
  mainImage: string | null;
  /** Distance from the traveler's start point, when one was provided. */
  distanceFromStartM: number | null;
}

/** A stop after LLM output has been validated and rebuilt from DB data. */
export interface ValidatedStop {
  candidate: Candidate;
  reasoning: string;
  visitMinutes: number;
}

/** A stop with computed timing, ready to return to the client. */
export interface ScheduledStop extends ValidatedStop {
  orderIndex: number;
  arrivalTime: string; // "HH:MM"
  departureTime: string; // "HH:MM"
  driveMinutesFromPrev: number;
  distanceFromPrevKm: number;
}
