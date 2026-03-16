import { z } from "zod";

export const POI_CATEGORIES = [
  "restaurant",
  "coffee_trail",
  "hiking_trail",
  "attraction",
  "campsite",
] as const;

export const REGION_HIERARCHY = {
  galilee: {
    label: "גליל וצפון",
    emoji: "🌿",
    subAreas: {
      upper_galilee: "גליל עליון",
      lower_galilee: "גליל תחתון וכינרת",
      golan: "רמת הגולן",
      haifa_carmel: "חיפה, הכרמל ועכו",
      jezreel_valley: "עמק יזרעאל",
    },
  },
  jerusalem: {
    label: "ירושלים וסביבות",
    emoji: "🕌",
    subAreas: {
      jerusalem_city: "ירושלים",
      jerusalem_hills: "הרי ירושלים",
      dead_sea: "ים המלח",
      judean_desert: "מדבר יהודה",
    },
  },
  tel_aviv: {
    label: "תל אביב וגוש דן",
    emoji: "🏙️",
    subAreas: {
      tel_aviv_city: "תל אביב–יפו",
      sharon: "השרון",
      dan_region: "גוש דן",
      shephelah: "שפלה ומרכז",
    },
  },
  negev: {
    label: "נגב ודרום",
    emoji: "🏜️",
    subAreas: {
      beer_sheva: "באר שבע ואזור",
      mitzpe_ramon: "מצפה רמון",
      dead_sea_south: "ים המלח הדרומי",
      arava_eilat: "ערבה ואילת",
    },
  },
} as const;

export type RegionKey = keyof typeof REGION_HIERARCHY;
export type SubAreaKey = {
  [R in RegionKey]: keyof (typeof REGION_HIERARCHY)[R]["subAreas"];
}[RegionKey];

export const REGIONS = Object.keys(REGION_HIERARCHY) as RegionKey[];

export const ALL_SUB_AREAS = Object.values(REGION_HIERARCHY).flatMap((r) =>
  Object.keys(r.subAreas),
) as string[];

export const TripInputSchema = z
  .object({
    groupSize: z.number().int().min(1).max(20),
    travelerType: z.enum(["couple", "friends", "family", "solo"]),
    durationDays: z.number().int().min(1).max(14),
    poiCategories: z
      .array(z.enum(POI_CATEGORIES))
      .min(1, "בחר/י לפחות סוג אחד של פעילות"),
    areas: z.array(z.string()).min(1, "בחר/י לפחות אזור גיאוגרפי אחד"),
    subAreas: z.array(z.string()).default([]),
    dayStartTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .default("09:00"),
    dayEndTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .default("20:00"),
    difficulty: z
      .enum(["easy", "moderate", "challenging", "extreme"])
      .default("moderate"),
    userLocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
  })
  .refine(
    (data) => {
      const toMin = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };
      return toMin(data.dayStartTime) < toMin(data.dayEndTime);
    },
    { message: "שעת הסיום חייבת להיות אחרי שעת ההתחלה", path: ["dayEndTime"] },
  );

export const RegenerateStopSchema = z.object({
  dayIndex: z.number().int().min(0),
  stopIndex: z.number().int().min(0),
});
