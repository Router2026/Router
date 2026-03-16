import { NextRequest, NextResponse } from "next/server";
import { generateTrip } from "@/lib/trips/trip-service";
import { successResponse, errorResponse } from "@/lib/api/response";
import { rawDb } from "@/lib/db/raw-client";
import type { TripInput } from "@/types/llm";
import type { Poi } from "@/lib/db/schema";

export const maxDuration = 60; // seconds — LLM calls can take 10-30s

// Maps Router app's region name to the main app's area/subArea keys
const REGION_MAP: Record<string, { area: string; subArea: string }> = {
  גולן: { area: "galilee", subArea: "golan" },
  "גליל עליון": { area: "galilee", subArea: "upper_galilee" },
  "גליל תחתון": { area: "galilee", subArea: "lower_galilee" },
  כרמל: { area: "galilee", subArea: "haifa_carmel" },
  "עמק יזרעאל": { area: "galilee", subArea: "jezreel_valley" },
  מרכז: { area: "tel_aviv", subArea: "dan_region" },
  שרון: { area: "tel_aviv", subArea: "sharon" },
  ירושלים: { area: "jerusalem", subArea: "jerusalem_city" },
  דרום: { area: "negev", subArea: "beer_sheva" },
  אילת: { area: "negev", subArea: "arava_eilat" },
  נגב: { area: "negev", subArea: "mitzpe_ramon" },
  ערבה: { area: "negev", subArea: "arava_eilat" },
};

// Maps Router trip styles to POI categories
const STYLE_TO_CATEGORIES: Record<string, string[]> = {
  history: ["attraction"],
  water: ["hiking_trail"],
  photo: ["attraction"],
  nature: ["hiking_trail"],
  hiking: ["hiking_trail"],
  beach: ["hiking_trail"],
  geology: ["hiking_trail"],
  wine: ["restaurant"],
  village: ["attraction"],
  family_activities: ["attraction"],
};

// Maps group type to traveler type + group size
const GROUP_MAP: Record<
  string,
  { travelerType: TripInput["travelerType"]; groupSize: number }
> = {
  solo: { travelerType: "solo", groupSize: 1 },
  couple: { travelerType: "couple", groupSize: 2 },
  family: { travelerType: "family", groupSize: 4 },
  friends: { travelerType: "friends", groupSize: 3 },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      region,
      groupType,
      styles = [],
      startTime = "09:00",
      endTime = "16:00",
      includeFood = false,
      includeCoffee = false,
      userLocation = null,
    } = body;

    if (!region || !groupType) {
      return NextResponse.json(
        errorResponse("region and groupType are required", "VALIDATION_ERROR"),
        { status: 400 },
      );
    }

    const regionMapping = REGION_MAP[region];
    if (!regionMapping) {
      return NextResponse.json(
        errorResponse(`Unknown region: ${region}`, "VALIDATION_ERROR"),
        {
          status: 400,
        },
      );
    }

    const groupMapping = GROUP_MAP[groupType] ?? GROUP_MAP["friends"];
    const times = { start: startTime, end: endTime };

    // Build POI categories from styles
    const categorySet = new Set<string>();
    for (const style of styles) {
      for (const cat of STYLE_TO_CATEGORIES[style] ?? []) {
        categorySet.add(cat);
      }
    }
    if (includeFood) categorySet.add("restaurant");
    if (includeCoffee) categorySet.add("coffee_trail");
    if (categorySet.size === 0) categorySet.add("attraction"); // fallback

    const input: TripInput = {
      travelerType: groupMapping.travelerType,
      groupSize: groupMapping.groupSize,
      durationDays: 1,
      poiCategories: [...categorySet] as TripInput["poiCategories"],
      areas: [regionMapping.area],
      subAreas: [regionMapping.subArea],
      dayStartTime: times.start,
      dayEndTime: times.end,
      difficulty: "moderate",
      userLocation: userLocation ?? undefined,
    };

    // Fetch Hebrew-named locations from the Router's locations table
    const { rows: locationRows } = await rawDb.query(
      `SELECT l.name, l.description, l.category, l.latitude, l.longitude, l.duration_minutes
       FROM locations l
       JOIN regions r ON r.id = l.region_id
       WHERE r.name = $1
       LIMIT 25`,
      [region],
    );

    // Map Router locations to Poi shape for the LLM
    const hebrewPois: Poi[] = locationRows.map((r, i) => ({
      id: String(i),
      name: r.name as string,
      category: "attraction" as Poi["category"],
      region: regionMapping.area,
      description: (r.description as string) || "",
      address: "",
      latitude: parseFloat(r.latitude as string),
      longitude: parseFloat(r.longitude as string),
      subRegion: regionMapping.subArea,
      visitDurationMinutes: (r.duration_minutes as number) ?? 60,
      openingHours: null,
      sourceUrl: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const poisForLLM = hebrewPois.length > 0 ? hebrewPois : undefined;
    const { uuid, plan } = await generateTrip(input, poisForLLM);

    // Convert the rich plan to the Router app's Trip format
    const stops =
      plan.days[0]?.stops.map((s, i) => {
        const [startH, startM] = times.start.split(":").map(Number);
        const offsetMinutes = plan.days[0].stops
          .slice(0, i)
          .reduce((acc, prev) => acc + prev.visitDurationMinutes + 15, 0);
        const arrivalMin = startH * 60 + startM + offsetMinutes;
        const h = Math.floor(arrivalMin / 60)
          .toString()
          .padStart(2, "0");
        const m = (arrivalMin % 60).toString().padStart(2, "0");
        return {
          poi_name: s.name,
          arrival_time: `${h}:${m}`,
          duration_minutes: s.visitDurationMinutes,
          smart_insight: s.reasoning,
          order_index: i,
        };
      }) ?? [];

    const totalHours =
      stops.reduce((acc, s) => acc + s.duration_minutes, 0) / 60;

    const STYLE_LABELS: Record<string, string> = {
      history: "היסטוריה",
      water: "מים",
      photo: "צילום",
      nature: "טבע",
      hiking: "טיולים",
      beach: "חוף",
      geology: "גיאולוגיה",
      wine: "יין ואוכל",
      village: "כפרים",
      family_activities: "לילדים",
    };
    const GROUP_LABELS: Record<string, string> = {
      solo: "יחיד",
      couple: "זוג",
      family: "משפחה",
      friends: "חברים",
    };
    const styleLabel =
      (styles as string[]).map((s) => STYLE_LABELS[s] ?? s).join("/") || "טבע";
    const groupLabel = GROUP_LABELS[groupType] ?? groupType;

    return NextResponse.json(
      successResponse({
        id: uuid,
        name: `טיול ${styleLabel} ב${region}`,
        description: `מסלול מותאם ל${groupLabel} באזור ${region}`,
        region,
        group_type: groupType,
        style: (styles as string[]).map((s) => STYLE_LABELS[s] ?? s).join(", "),
        total_duration_hours: Math.round(totalHours * 10) / 10,
        stops,
      }),
      { status: 201 },
    );
  } catch (err) {
    console.error("[POST /api/ai/generate-route]", err);
    return NextResponse.json(
      errorResponse(
        err instanceof Error ? err.message : "Route generation failed",
        "GENERATION_ERROR",
      ),
      { status: 500 },
    );
  }
}
