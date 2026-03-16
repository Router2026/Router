import type { TripInput, TripPlan } from "@/types/llm";
import type { Poi } from "@/lib/db/schema";

export function buildGenerateTripPrompt(input: TripInput, pois: Poi[]): string {
  const poiList = pois
    .map((p) => {
      const desc = p.description ? p.description.slice(0, 80) : "";
      return `- ${p.name} (${p.category}): ${desc}`;
    })
    .join("\n");

  const locationHint = input.userLocation
    ? `\nThe traveler's starting point is at latitude ${input.userLocation.lat.toFixed(4)}, longitude ${input.userLocation.lng.toFixed(4)}. Each day begins and ends at this starting point. On Day 1, begin with the stop geographically closest to the starting point. On all days, account for driving to the first stop and back from the last stop — estimate driving time as distance ÷ 70 km/h × 1.3.`
    : "";

  const DIFFICULTY_GUIDE: Record<string, string> = {
    easy: "Prefer short walks (under 2 km), café visits, and accessible attractions. Avoid strenuous hikes. Keep visit durations shorter to avoid fatigue.",
    moderate:
      "Mix of light activities and moderate hikes (2–5 km). Balance physical activity with relaxed stops.",
    challenging:
      "Include longer hikes (5–10 km) and physically demanding trails. Fewer rest stops, more active experiences.",
    extreme:
      "Prioritize the most strenuous multi-hour hikes and trails (10+ km). Maximize physical challenge; minimize passive stops.",
  };
  const difficultyHint = `\nTrip difficulty: ${input.difficulty}. ${DIFFICULTY_GUIDE[input.difficulty]}`;

  // Compute available minutes per day and target stop count
  const [startH, startM] = input.dayStartTime.split(":").map(Number);
  const [endH, endM] = input.dayEndTime.split(":").map(Number);
  const availableMinutes = endH * 60 + endM - (startH * 60 + startM);

  // Average visit duration by category (minutes), excluding campsite which fills a whole day
  const AVG_DURATION: Record<string, number> = {
    restaurant: 75,
    coffee_trail: 30,
    hiking_trail: 120,
    attraction: 90,
    campsite: 480,
  };
  const hasCampsite = input.poiCategories.includes("campsite");
  const nonCampCategories = input.poiCategories.filter((c) => c !== "campsite");
  const avgDuration =
    nonCampCategories.length > 0
      ? nonCampCategories.reduce((sum, c) => sum + (AVG_DURATION[c] ?? 75), 0) /
        nonCampCategories.length
      : 75;
  // Target: fill the day; campsite days use one long stop, others pack the window
  const targetStops = hasCampsite
    ? 1
    : Math.max(2, Math.round(availableMinutes / (avgDuration + 15)));

  return `You are an expert Israeli trip planner. Create a ${input.durationDays}-day itinerary for ${input.groupSize} ${input.travelerType}(s) in the following regions: ${input.areas.join(", ")}. Interested in: ${input.poiCategories.join(", ")}.${locationHint}${difficultyHint}

Each day runs from ${input.dayStartTime} to ${input.dayEndTime} (${availableMinutes} minutes total). Travel time between stops is ~15 minutes. FILL THE ENTIRE DAY — aim for exactly ${targetStops} stops per day so that the sum of visitDurationMinutes plus travel buffers uses up all ${availableMinutes} available minutes. Do not leave the day half-empty.

Available places to include:
${poiList}

Rules:
- Only use places from the list above
- Order stops logically by location to minimize travel
- MANDATORY: the full itinerary must include at least one stop from EACH of these categories: ${input.poiCategories.join(", ")}. Do not skip any of them.
- Each stop must have a clear reason why it suits this group
- Write ALL text fields (reasoning, openingHours, accommodation notes) in Hebrew
- For every day EXCEPT the last day, include an "accommodation" object with a real place to sleep near that day's area
- Accommodation types: מלון (hotel), צימר (zimmer/B&B), הוסטל (hostel), אירוח כפרי (rural guesthouse)
- estimatedCostPerNight is the total per-night cost in NIS for the whole group
- Return ONLY valid JSON, no markdown, no explanation

Required JSON format:
{
  "days": [
    {
      "day": 1,
      "stops": [
        {
          "name": "Place name exactly as listed",
          "category": "category from listing",
          "address": "address from listing",
          "openingHours": "hours from listing or Unknown",
          "reasoning": "1-2 sentences why this suits the group",
          "latitude": 0.0,
          "longitude": 0.0,
          "visitDurationMinutes": 60
        }
      ],
      "accommodation": {
        "name": "שם מקום הלינה",
        "type": "מלון / צימר / הוסטל / אירוח כפרי",
        "address": "כתובת",
        "estimatedCostPerNight": 500,
        "notes": "הערות קצרות על המקום"
      }
    }
  ]
}

Note: the last day has no "accommodation" field. All other days must include it.
visitDurationMinutes guide: coffee_trail=30, restaurant=75, attraction=90, hiking_trail=120, campsite=480.`;
}

export function buildRegenerateStopPrompt(
  plan: TripPlan,
  dayIndex: number,
  stopIndex: number,
  pois: Poi[],
): string {
  if (dayIndex < 0 || dayIndex >= plan.days.length) {
    throw new Error(
      `Invalid dayIndex ${dayIndex} — plan has ${plan.days.length} days`,
    );
  }
  const day = plan.days[dayIndex];
  if (stopIndex < 0 || stopIndex >= day.stops.length) {
    throw new Error(
      `Invalid stopIndex ${stopIndex} — day ${dayIndex + 1} has ${day.stops.length} stops`,
    );
  }
  const currentStop = day.stops[stopIndex];
  const otherStopsInDay = day.stops
    .filter((_, i) => i !== stopIndex)
    .map((s) => s.name)
    .join(", ");

  const usedNames = plan.days.flatMap((d) => d.stops.map((s) => s.name));
  const availablePois = pois.filter((p) => !usedNames.includes(p.name));

  const poiList = availablePois
    .map(
      (p) =>
        `- ${p.name} (${p.category}, ${p.region}): ${p.description}. Hours: ${p.openingHours ?? "Unknown"}. Address: ${p.address}`,
    )
    .join("\n");

  return `You are an expert Israeli trip planner. Replace one stop in a trip itinerary.

Stop to replace: "${currentStop.name}" (${currentStop.category}) on Day ${dayIndex + 1}
Other stops that day: ${otherStopsInDay || "none"}

Available replacements (not already in the plan):
${poiList}

Choose the best replacement that:
- Is the same category (${currentStop.category}) or similar
- Works geographically with the other stops that day
- Has not been used elsewhere in the plan

Write the reasoning in Hebrew. Return ONLY valid JSON for the single replacement stop:
{
  "name": "Place name exactly as listed",
  "category": "category",
  "address": "address",
  "openingHours": "hours or Unknown",
  "reasoning": "1-2 sentences why this is a good replacement",
  "latitude": 0.0,
  "longitude": 0.0,
  "visitDurationMinutes": 60
}`;
}
