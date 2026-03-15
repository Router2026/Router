import { z } from "zod";

export const TripStopSchema = z.object({
  name: z.string().min(1),
  category: z.string().default("attraction"),
  address: z.string().default(""),
  openingHours: z.string().default(""),
  reasoning: z.string().default(""),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  visitDurationMinutes: z
    .number()
    .default(60)
    .transform((v) => Math.max(15, Math.min(480, Math.round(v)))),
});

export const AccommodationSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  address: z.string().min(1),
  estimatedCostPerNight: z.number().min(0).max(100_000),
  notes: z.string().default(""),
});

export const TripPlanSchema = z.object({
  days: z.array(
    z.object({
      day: z.number().int().min(1),
      stops: z.array(TripStopSchema),
      accommodation: AccommodationSchema.optional(),
    })
  ),
});
