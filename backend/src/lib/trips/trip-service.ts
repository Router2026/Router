import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import type { Poi } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getLLMProvider } from "@/lib/llm/provider";
import { getRelevantPois } from "@/lib/poi/poi-service";
import type { Accommodation, TripInput, TripPlan, TripStop } from "@/types/llm";
import { TripPlanSchema } from "@/lib/llm/schemas";
import { z } from "zod";

// Lenient schema for reading trips from DB — coerces bad values so old data
// doesn't 404. sanitizePlan() filters any resulting invalid stops afterwards.
const TripPlanDbSchema = z.object({
  days: z.array(z.object({
    day: z.number().catch(1),
    stops: z.array(z.object({
      name: z.string().catch(""),
      category: z.string().catch(""),
      address: z.string().catch(""),
      openingHours: z.string().catch(""),
      reasoning: z.string().catch(""),
      latitude: z.number().catch(0),
      longitude: z.number().catch(0),
      visitDurationMinutes: z.number().catch(60).transform((v) => Math.max(15, Math.min(480, Math.round(v)))),
    })).catch([]),
    accommodation: z.object({
      name: z.string().catch(""),
      type: z.string().catch(""),
      address: z.string().catch(""),
      estimatedCostPerNight: z.number().catch(0),
      notes: z.string().catch(""),
    }).optional().catch(undefined),
  })).catch([]),
});
import type { TripRecord } from "@/types/trip";

const PLACEHOLDER_NAMES = new Set([
  "place name exactly as listed",
  "place name",
]);
const PLACEHOLDER_REASONS = new Set([
  "1-2 sentences why this suits the group",
  "1-2 sentences why this is a good replacement",
]);

function isValidStop(s: TripStop): boolean {
  const name = s.name?.trim().toLowerCase() ?? "";
  const reasoning = s.reasoning?.trim().toLowerCase() ?? "";
  return (
    !!name &&
    !PLACEHOLDER_NAMES.has(name) &&
    !!reasoning &&
    !PLACEHOLDER_REASONS.has(reasoning) &&
    !(s.latitude === 0 && s.longitude === 0)
  );
}

function isValidAccommodation(a: Accommodation | undefined): a is Accommodation {
  return !!a && !!a.name?.trim() && !!a.address?.trim() && a.estimatedCostPerNight >= 0;
}

function sanitizePlan(plan: TripPlan): TripPlan {
  const days = plan.days
    .map((day) => ({ ...day, stops: day.stops.filter(isValidStop) }))
    .filter((day) => day.stops.length > 0)
    .map((day, i, arr) => ({
      ...day,
      // Only keep valid accommodation on non-last days
      accommodation:
        i < arr.length - 1 && isValidAccommodation(day.accommodation)
          ? day.accommodation
          : undefined,
    }));
  return { days };
}

function missingCategories(plan: TripPlan, required: string[]): string[] {
  const present = new Set(
    plan.days.flatMap((d) => d.stops.map((s) => s.category.split(",")[0].trim()))
  );
  return required.filter((cat) => !present.has(cat));
}

export async function generateTrip(input: TripInput, poisOverride?: Poi[]): Promise<{ uuid: string; plan: TripPlan }> {
  const pois = poisOverride ?? await getRelevantPois(input.poiCategories, input.areas, input.subAreas);
  if (pois.length === 0) {
    throw new Error("No POIs available for the selected categories");
  }

  const llm = getLLMProvider();
  const plan = sanitizePlan(await llm.generateTrip(input, pois));

  // Log if any requested category is absent — skip retry to avoid doubling latency
  const missing = missingCategories(plan, input.poiCategories);
  if (missing.length > 0) {
    console.warn(`[generateTrip] Missing categories (not retrying): ${missing.join(", ")}`);
  }

  if (plan.days.length === 0) {
    throw new Error("Generated plan has no valid stops — please try again");
  }

  const uuid = crypto.randomUUID();
  await db.insert(trips).values({
    uuid,
    travelerType: input.travelerType,
    groupSize: input.groupSize,
    durationDays: input.durationDays,
    poiCategories: input.poiCategories,
    poiAreas: input.areas,
    poiSubAreas: input.subAreas ?? [],
    dayStartTime: input.dayStartTime,
    dayEndTime: input.dayEndTime,
    difficulty: input.difficulty,
    startLatitude: input.userLocation?.lat ?? null,
    startLongitude: input.userLocation?.lng ?? null,
    generatedPlan: plan,
  });

  return { uuid, plan };
}

export async function regenerateStop(
  uuid: string,
  dayIndex: number,
  stopIndex: number
): Promise<{ plan: TripPlan; stop: TripStop }> {
  const trip = await getTripByUuid(uuid);
  if (!trip) throw new Error("Trip not found");

  const { days } = trip.generatedPlan;
  if (dayIndex >= days.length) {
    throw Object.assign(new Error(`Day ${dayIndex + 1} does not exist in this trip`), { status: 400 });
  }
  if (stopIndex >= days[dayIndex].stops.length) {
    throw Object.assign(new Error(`Stop ${stopIndex + 1} does not exist on day ${dayIndex + 1}`), { status: 400 });
  }

  const pois = await getRelevantPois(trip.poiCategories, trip.poiAreas, trip.poiSubAreas);
  const llm = getLLMProvider();
  const newStop = await llm.regenerateStop(trip.generatedPlan, dayIndex, stopIndex, pois);
  if (!isValidStop(newStop)) {
    throw new Error("Regenerated stop was invalid — please try again");
  }

  // Splice new stop into plan
  const updatedPlan: TripPlan = {
    days: trip.generatedPlan.days.map((day, di) => {
      if (di !== dayIndex) return day;
      return {
        ...day,
        stops: day.stops.map((s, si) => (si === stopIndex ? newStop : s)),
      };
    }),
  };

  await db
    .update(trips)
    .set({ generatedPlan: updatedPlan })
    .where(eq(trips.uuid, uuid));

  return { plan: updatedPlan, stop: newStop };
}

export async function getTripByUuid(uuid: string): Promise<TripRecord | null> {
  const results = await db
    .select()
    .from(trips)
    .where(eq(trips.uuid, uuid))
    .limit(1);

  if (results.length === 0) return null;

  const row = results[0];

  // Try strict schema first (fast path for current-schema trips)
  const strict = TripPlanSchema.safeParse(row.generatedPlan);
  if (strict.success) {
    return { ...row, generatedPlan: strict.data };
  }

  // Fall back to lenient schema + sanitize for old/migrated trips
  const lenient = TripPlanDbSchema.safeParse(row.generatedPlan);
  if (!lenient.success) {
    console.error("[getTripByUuid] Stored plan is unreadable:", lenient.error.message);
    return null;
  }
  const recovered = sanitizePlan(lenient.data);
  if (recovered.days.length === 0) {
    console.error("[getTripByUuid] Stored plan has no valid stops after sanitization");
    return null;
  }
  return { ...row, generatedPlan: recovered };
}
