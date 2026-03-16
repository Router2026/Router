import type { Poi } from "@/lib/db/schema";

export interface TripInput {
  groupSize: number;
  travelerType: "couple" | "friends" | "family" | "solo";
  durationDays: number;
  poiCategories: string[];
  areas: string[];
  subAreas: string[];
  dayStartTime: string;
  dayEndTime: string;
  difficulty: "easy" | "moderate" | "challenging" | "extreme";
  userLocation?: { lat: number; lng: number };
}

export interface TripStop {
  name: string;
  category: string;
  address: string;
  openingHours: string;
  reasoning: string;
  latitude: number;
  longitude: number;
  visitDurationMinutes: number;
}

export interface Accommodation {
  name: string;
  type: string;
  address: string;
  estimatedCostPerNight: number;
  notes: string;
}

export interface TripDay {
  day: number;
  stops: TripStop[];
  accommodation?: Accommodation;
}

export interface TripPlan {
  days: TripDay[];
}

export interface LLMProvider {
  generateTrip(input: TripInput, pois: Poi[]): Promise<TripPlan>;
  regenerateStop(
    plan: TripPlan,
    dayIndex: number,
    stopIndex: number,
    pois: Poi[],
  ): Promise<TripStop>;
}

export class LLMOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMOutputError";
  }
}
