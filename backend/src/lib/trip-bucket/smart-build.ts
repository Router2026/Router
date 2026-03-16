/**
 * Smart Build — RAG (Retrieval-Augmented Generation) Flow
 * ---------------------------------------------------------
 * Retrieval:  Full POI metadata is fetched from the database (bucket-db.ts)
 * Augmentation: The data is injected into a structured LLM prompt that asks
 *               for an optimal, chronologically logical day plan.
 * Generation: The LLM returns strict JSON which we parse and validate.
 *
 * The prompt design prioritises:
 *   - Chronological logic (sunrise activities → afternoon → sunset)
 *   - POI character matching (hike early, cafés mid-morning, viewpoints at dusk)
 *   - Minimal backtracking (spatial awareness from coordinates)
 *   - Clear, actionable smart_insight per stop
 */

import Anthropic from '@anthropic-ai/sdk';
import type { BucketPoi, SmartStop, SmartPlan } from './types';

// ── Prompt Builder ────────────────────────────────────────────────────────────

/**
 * Build the RAG-augmented prompt.
 * The POI metadata (retrieved from DB) is injected as structured context
 * so the LLM can make informed scheduling decisions.
 */
function buildSmartBuildPrompt(pois: BucketPoi[]): string {
  const poiContext = pois.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    region: p.region,
    description: p.description.slice(0, 200), // truncate for token efficiency
    duration_minutes: p.duration_minutes,
    difficulty: p.difficulty,
    has_water: p.has_water,
    has_shade: p.has_shade,
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  return `You are an expert travel planner for Israel. You have been given a list of Points of Interest (POIs) that a user wants to visit in a single day.

Your task is to create an optimal, chronologically logical day itinerary by ordering these exact POIs. Do NOT add or remove any POIs — use exactly the ones provided.

## Scheduling Intelligence Rules:
1. Physically demanding activities (hiking, climbing) → schedule in the MORNING (07:00–11:00) when energy is high and heat is lower.
2. Cafés, food stops, light cultural sites → LATE MORNING or MIDDAY (11:00–14:00).
3. Shaded sites, museums, indoor attractions → AFTERNOON (14:00–17:00) to avoid peak heat.
4. Viewpoints, sunset spots, romantic/scenic locations → LATE AFTERNOON or EVENING (17:00–20:00).
5. Minimise backtracking: consider the latitude/longitude coordinates to create a geographically flowing route.
6. Assign realistic arrival times starting at 08:00.

## POI Data (retrieved from database):
${JSON.stringify(poiContext, null, 2)}

## Required Output Format:
Respond with ONLY a valid JSON object — no markdown, no explanation, no code fences. The JSON must exactly match this schema:

{
  "route_title": "string — a catchy, descriptive day-trip title",
  "route_description": "string — 2-3 sentence summary of the day's flow and character",
  "stops": [
    {
      "location_id": "string — exact id from the POI data above",
      "poi_name": "string — exact name from the POI data above",
      "arrival_time": "string — HH:MM format (24h)",
      "duration_minutes": number — recommended visit duration in minutes,
      "smart_insight": "string — one compelling sentence explaining WHY this time slot fits this place",
      "visit_type": "string — short label e.g. 'morning hike', 'coffee break', 'sunset viewpoint'"
    }
  ]
}`;
}

// ── JSON Extractor ────────────────────────────────────────────────────────────

/**
 * Robustly extract JSON from LLM output that may contain surrounding text
 * or markdown code fences.
 */
function extractJsonFromLlmResponse(raw: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(raw.trim());
  } catch {
    // Strip markdown fences and retry
    const stripped = raw
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```$/m, '')
      .trim();
    try {
      return JSON.parse(stripped);
    } catch {
      // Last resort: find the outermost { ... } block
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start !== -1 && end > start) {
        return JSON.parse(raw.slice(start, end + 1));
      }
      throw new Error('No valid JSON found in LLM response');
    }
  }
}

// ── Validator ─────────────────────────────────────────────────────────────────

function validateSmartPlan(raw: unknown, expectedIds: Set<string>): SmartPlan {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('LLM response is not an object');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.route_title !== 'string' || !obj.route_title) {
    throw new Error('Missing route_title');
  }
  if (typeof obj.route_description !== 'string') {
    throw new Error('Missing route_description');
  }
  if (!Array.isArray(obj.stops) || obj.stops.length === 0) {
    throw new Error('stops must be a non-empty array');
  }

  const stops: SmartStop[] = obj.stops.map((s: Record<string, unknown>, idx: number) => {
    if (typeof s.location_id !== 'string') throw new Error(`Stop ${idx}: missing location_id`);
    if (typeof s.poi_name !== 'string') throw new Error(`Stop ${idx}: missing poi_name`);
    if (typeof s.arrival_time !== 'string') throw new Error(`Stop ${idx}: missing arrival_time`);
    if (typeof s.duration_minutes !== 'number') throw new Error(`Stop ${idx}: missing duration_minutes`);
    return {
      location_id: s.location_id,
      poi_name: s.poi_name,
      arrival_time: s.arrival_time,
      duration_minutes: s.duration_minutes,
      smart_insight: typeof s.smart_insight === 'string' ? s.smart_insight : '',
      visit_type: typeof s.visit_type === 'string' ? s.visit_type : '',
    };
  });

  // Verify all returned stop IDs were in the original request
  for (const stop of stops) {
    if (!expectedIds.has(stop.location_id)) {
      console.warn(`[SmartBuild] LLM returned unexpected location_id: ${stop.location_id} — keeping anyway`);
    }
  }

  return {
    route_title: obj.route_title as string,
    route_description: obj.route_description as string,
    stops,
  };
}

// ── Main LLM call ─────────────────────────────────────────────────────────────

/**
 * Run the Smart Build RAG flow:
 * 1. Build an augmented prompt with full POI metadata (Augmentation).
 * 2. Call the Anthropic Claude API (Generation).
 * 3. Parse and validate the structured JSON response.
 *
 * @param pois - Full POI records retrieved from DB (Retrieval step done by caller)
 * @returns    Validated SmartPlan with chronologically ordered stops
 */
export async function runSmartBuild(pois: BucketPoi[]): Promise<SmartPlan> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildSmartBuildPrompt(pois);
  const expectedIds = new Set(pois.map(p => p.id));

  const message = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = message.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('Anthropic returned no text content');
  }

  const rawJson = extractJsonFromLlmResponse(block.text);
  return validateSmartPlan(rawJson, expectedIds);
}
