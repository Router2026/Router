import { z } from "zod";

const POI_CATEGORIES = ["restaurant", "coffee_trail", "hiking_trail", "attraction", "campsite"] as const;

export const PoiRecordSchema = z.object({
  name: z.string().min(1),
  category: z.enum(POI_CATEGORIES),
  region: z.string().min(1),
  description: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  openingHours: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  isActive: z.boolean().optional().default(true),
});

export const DataSourceSchema = z.object({
  name: z.string().min(1),
  category: z.enum(POI_CATEGORIES),
  sourceUrl: z.string().url(),
  syncCadenceHours: z.number().int().min(1).default(168),
  isActive: z.boolean().optional().default(true),
});
