// Test helpers shared by the ai-route unit tests.
import type { Candidate, ValidatedStop } from "./types";

export function makeCandidate(overrides: Partial<Candidate> & { key: string; locationId: number }): Candidate {
  return {
    name: `Place ${overrides.locationId}`,
    category: "מעיין",
    description: "",
    lat: 33.0,
    lng: 35.5,
    durationMinutes: 60,
    difficulty: null,
    hasWater: false,
    hasShade: false,
    accessible: false,
    rating: 4,
    mainImage: null,
    distanceFromStartM: null,
    ...overrides,
  };
}

export function makeStop(c: Candidate, visitMinutes = c.durationMinutes): ValidatedStop {
  return { candidate: c, reasoning: "", visitMinutes };
}
