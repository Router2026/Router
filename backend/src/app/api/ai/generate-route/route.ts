import { NextRequest, NextResponse } from "next/server";
import { generateTrip } from "@/lib/trips/trip-service";
import { successResponse, errorResponse } from "@/lib/api/response";
import { rawDb } from "@/lib/db/raw-client";
import type { TripInput } from "@/types/llm";
import type { Poi } from "@/lib/db/schema";

export const maxDuration = 60; // seconds — LLM calls can take 10-30s

// Maps Router app's region name to the main app's area/subArea keys
const REGION_MAP: Record<string, { area: string; subArea: string }> = {
  "גולן":           { area: "galilee",   subArea: "golan" },
  "גליל עליון":    { area: "galilee",   subArea: "upper_galilee" },
  "גליל תחתון":    { area: "galilee",   subArea: "lower_galilee" },
  "כרמל":           { area: "galilee",   subArea: "haifa_carmel" },
  "עמק יזרעאל":    { area: "galilee",   subArea: "jezreel_valley" },
  "מרכז":           { area: "tel_aviv",  subArea: "dan_region" },
  "שרון":           { area: "tel_aviv",  subArea: "sharon" },
  "ירושלים":        { area: "jerusalem", subArea: "jerusalem_city" },
  "דרום":           { area: "negev",     subArea: "beer_sheva" },
  "אילת":           { area: "negev",     subArea: "arava_eilat" },
  "נגב":            { area: "negev",     subArea: "mitzpe_ramon" },
  "ערבה":           { area: "negev",     subArea: "arava_eilat" },
};

// Maps Router trip styles to POI categories
const STYLE_TO_CATEGORIES: Record<string, string[]> = {
  history:          ["attraction"],
  water:            ["hiking_trail"],
  photo:            ["attraction"],
  nature:           ["hiking_trail"],
  hiking:           ["hiking_trail"],
  beach:            ["hiking_trail"],
  geology:          ["hiking_trail"],
  wine:             ["restaurant"],
  village:          ["attraction"],
  family_activities:["attraction"],
};

// Maps group type to traveler type + group size
const GROUP_MAP: Record<string, { travelerType: TripInput["travelerType"]; groupSize: number }> = {
  solo:    { travelerType: "solo",    groupSize: 1 },
  couple:  { travelerType: "couple",  groupSize: 2 },
  family:  { travelerType: "family",  groupSize: 4 },
  friends: { travelerType: "friends", groupSize: 3 },
};

export async function POST(req: NextRequest) {
  try {
    const { getUserFromRequest } = await import("@/lib/auth/tokens");
    const user = await getUserFromRequest(req);
    if (!user?.is_admin) {
      return NextResponse.json(errorResponse("Admin access required", "FORBIDDEN"), { status: 403 });
    }

    const body = await req.json();
    const {
      region, groupType, styles = [],
      startTime = "09:00", endTime = "16:00",
      includeFood = false, includeCoffee = false,
      userLocation = null,
    } = body;

    if (!region || !groupType) {
      return NextResponse.json(errorResponse("region and groupType are required", "VALIDATION_ERROR"), { status: 400 });
    }

    const regionMapping = REGION_MAP[region];
    if (!regionMapping) {
      return NextResponse.json(errorResponse(`Unknown region: ${region}`, "VALIDATION_ERROR"), { status: 400 });
    }

    const groupMapping = GROUP_MAP[groupType] ?? GROUP_MAP["friends"];
    const times = { start: startTime, end: endTime };

    // Build requested POI categories from styles
    const requestedCategories = new Set<string>();
    for (const style of styles) {
      for (const cat of STYLE_TO_CATEGORIES[style] ?? []) {
        requestedCategories.add(cat);
      }
    }
    if (includeFood) requestedCategories.add("restaurant");
    if (includeCoffee) requestedCategories.add("coffee_trail");
    if (requestedCategories.size === 0) requestedCategories.add("attraction");

    // Always include attraction + hiking_trail as a base so the query never returns empty
    const queryCategories = [...new Set([...requestedCategories, "attraction", "hiking_trail"])];

    // Resolve region_id once — avoids a JOIN and an unindexed name scan on every call
    const { rows: regionRows } = await rawDb.query(
      `SELECT id FROM regions WHERE name = $1 LIMIT 1`,
      [region]
    );
    if (!regionRows.length) {
      return NextResponse.json(errorResponse(`Unknown region: ${region}`, "VALIDATION_ERROR"), { status: 400 });
    }
    const regionId = regionRows[0].id;

    // Fetch locations using the indexed (region_id, category) lookup — no JOIN needed
    const { rows: locationRows } = await rawDb.query(
      `SELECT name, description, category, latitude, longitude, duration_minutes
       FROM locations
       WHERE region_id = $1
         AND category = ANY($2)
       ORDER BY RANDOM()
       LIMIT 40`,
      [regionId, queryCategories]
    );

    // Only tell the LLM about categories that actually have locations in the DB
    const presentCategories = new Set(locationRows.map(r => r.category as string));
    const finalCategories = [...requestedCategories].filter(c => presentCategories.has(c));
    if (finalCategories.length === 0) {
      // Fallback: use whatever categories are present
      finalCategories.push(...presentCategories);
    }
    if (finalCategories.length === 0) {
      return NextResponse.json(errorResponse("No locations found for the selected region and styles", "NOT_FOUND"), { status: 404 });
    }

    const input: TripInput = {
      travelerType: groupMapping.travelerType,
      groupSize: groupMapping.groupSize,
      durationDays: 1,
      poiCategories: finalCategories as TripInput["poiCategories"],
      areas: [regionMapping.area],
      subAreas: [regionMapping.subArea],
      dayStartTime: times.start,
      dayEndTime: times.end,
      difficulty: "moderate",
      userLocation: userLocation ?? undefined,
    };

    // Map Router locations to Poi shape for the LLM (only categories the LLM will use)
    const finalCategorySet = new Set(finalCategories);
    const hebrewPois: Poi[] = locationRows
      .filter(r => finalCategorySet.has(r.category as string))
      .map((r, i) => ({
      id: String(i),
      name: r.name as string,
      category: (r.category as Poi["category"]) ?? "attraction",
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
    const stops = plan.days[0]?.stops.map((s, i) => {
      const [startH, startM] = times.start.split(":").map(Number);
      const offsetMinutes = plan.days[0].stops
        .slice(0, i)
        .reduce((acc, prev) => acc + prev.visitDurationMinutes + 15, 0);
      const arrivalMin = startH * 60 + startM + offsetMinutes;
      const h = Math.floor(arrivalMin / 60).toString().padStart(2, "0");
      const m = (arrivalMin % 60).toString().padStart(2, "0");
      return {
        poi_name: s.name,
        arrival_time: `${h}:${m}`,
        duration_minutes: s.visitDurationMinutes,
        smart_insight: s.reasoning,
        order_index: i,
      };
    }) ?? [];

    const totalHours = stops.reduce((acc, s) => acc + s.duration_minutes, 0) / 60;

    const STYLE_LABELS: Record<string, string> = {
      history: "היסטוריה", water: "מים", photo: "צילום", nature: "טבע",
      hiking: "טיולים", beach: "חוף", geology: "גיאולוגיה",
      wine: "יין ואוכל", village: "כפרים", family_activities: "לילדים",
    };
    const GROUP_LABELS: Record<string, string> = { solo: "יחיד", couple: "זוג", family: "משפחה", friends: "חברים" };
    const styleLabel = (styles as string[]).map(s => STYLE_LABELS[s] ?? s).join("/") || "טבע";
    const groupLabel = GROUP_LABELS[groupType] ?? groupType;

    return NextResponse.json(
      successResponse({
        id: uuid,
        name: `טיול ${styleLabel} ב${region}`,
        description: `מסלול מותאם ל${groupLabel} באזור ${region}`,
        region,
        group_type: groupType,
        style: (styles as string[]).map(s => STYLE_LABELS[s] ?? s).join(", "),
        total_duration_hours: Math.round(totalHours * 10) / 10,
        stops,
      }),
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/ai/generate-route]", err);
    return NextResponse.json(
      errorResponse(
        err instanceof Error ? err.message : "Route generation failed",
        "GENERATION_ERROR"
      ),
      { status: 500 }
    );
  }
}

export { OPTIONS } from "@/lib/api/cors";
