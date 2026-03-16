import type { TripPlan } from '@/types/llm';

export type { TripInput, TripStop, TripDay, TripPlan } from '@/types/llm';

export interface GenerateTripResponse {
  tripId: string;
  plan: TripPlan;
}

export interface TripRecord {
  id: string;
  uuid: string;
  travelerType: string;
  groupSize: number;
  durationDays: number;
  poiCategories: string[];
  poiAreas: string[];
  poiSubAreas: string[];
  dayStartTime: string;
  dayEndTime: string;
  difficulty: string;
  startLatitude: number | null;
  startLongitude: number | null;
  generatedPlan: TripPlan;
  createdAt: Date;
}
