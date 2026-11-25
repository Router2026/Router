/**
 * POST /api/trip-bucket/smart-build
 * ----------------------------------
 * "Smart Build" for the Trip Bucket, using the trip agents (lib/trip-agents/bucket.ts):
 *   1. Fetch the picked POIs from the DB.
 *   2. Agent 3 — weather / safety (Open-Meteo); unsafe places are left out with a warning.
 *   3. Agent 4 — order and schedule (time-of-day slots, travel times, daylight); keeps every
 *      place the user picked unless it no longer fits before dark.
 *   4. Agent 5 — title, overview and one tip per stop (falls back to plain text without the model).
 *
 * Request body:  { poi_ids: string[] }   — 2 to 15 POI IDs
 * Response:      { data: { mode: "smart", stops, smart_plan, total_duration_minutes,
 *                          total_distance_km, warnings: string[], safety_footer, sunset } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api/response';
import { fetchBucketPois } from '@/lib/trip-bucket/bucket-db';
import { runBucketPipeline, toSmartPlan } from '@/lib/trip-agents/bucket';
import { checkRateLimit, clientIp } from '@/lib/auth/rate-limit';

/** Public endpoint that calls a paid model (agent 5) — limit per IP. */
const RATE_LIMIT_PER_MIN = 10;

export const maxDuration = 60; // seconds — weather + one summary model call

export async function POST(req: NextRequest) {
  if (!(await checkRateLimit(`smart-build:${clientIp(req)}`, RATE_LIMIT_PER_MIN, 60_000))) {
    return NextResponse.json(errorResponse('Too many requests, try again in a minute', 'RATE_LIMITED'), {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
  }
  try {
    const body = await req.json();
    const { poi_ids } = body as { poi_ids?: string[] };

    // ── Validation ────────────────────────────────────────────────────────────
    if (!Array.isArray(poi_ids) || poi_ids.length < 2) {
      return NextResponse.json(
        errorResponse('poi_ids must be an array of at least 2 IDs', 'VALIDATION_ERROR'),
        { status: 400 },
      );
    }
    if (poi_ids.length > 15) {
      return NextResponse.json(
        errorResponse('Maximum 15 POIs supported for Smart Build', 'VALIDATION_ERROR'),
        { status: 400 },
      );
    }

    // ── Step 1: Retrieval — fetch full POI records from DB ────────────────────
    const pois = await fetchBucketPois(poi_ids);

    if (pois.length < 2) {
      return NextResponse.json(
        errorResponse('Could not find enough valid POIs for the provided IDs', 'NOT_FOUND'),
        { status: 404 },
      );
    }

    // ── Steps 2 & 3: trip agents 3 (conditions) → 4 (planner) → 5 (summary) ─
    const result = await runBucketPipeline(pois);
    const smartPlan = toSmartPlan(result);
    console.log(`[SmartBuild] ${pois.length} POIs → ${smartPlan.stops.length} stops, ${result.warnings.length} warnings, model calls ${result.usage.calls}`);

    // Day length from first arrival to last departure (visits + driving).
    const [sh, sm] = result.plan.startTime.split(':').map(Number);
    const [eh, em] = result.plan.endTime.split(':').map(Number);
    const totalDurationMinutes = Math.max(0, eh * 60 + em - (sh * 60 + sm));

    const stops = smartPlan.stops.map((stop, i) => ({
      poi_id:           stop.location_id,
      poi_name:         stop.poi_name,
      arrival_time:     stop.arrival_time,
      duration_minutes: stop.duration_minutes,
      smart_insight:    stop.smart_insight,
      order_index:      i,
    }));

    // ── Response ──────────────────────────────────────────────────────────────
    return NextResponse.json(
      successResponse({
        mode:                   'smart',
        stops,
        smart_plan:             smartPlan,  // full plan for rich UI rendering
        total_duration_minutes: totalDurationMinutes,
        total_distance_km:      result.plan.totalDistanceKm,
        // Places left out (unsafe conditions / no daylight) — never drop a user's place silently.
        warnings:               result.warnings,
        safety_footer:          result.summary.safetyFooter,
        sunset:                 result.plan.sunset,
      }),
      { status: 200 },
    );
  } catch (err) {
    console.error('[POST /api/trip-bucket/smart-build]', err);
    return NextResponse.json(
      // Internal error details stay in the server log.
      errorResponse('Smart Build generation failed', 'GENERATION_ERROR'),
      { status: 500 },
    );
  }
}

export { OPTIONS } from "@/lib/api/cors";
