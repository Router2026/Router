/**
 * POST /api/trip-bucket/smart-build
 * ----------------------------------
 * Implements the RAG (Retrieval-Augmented Generation) flow for the
 * "Smart Build" route generation mode.
 *
 * Flow:
 *   1. Retrieval   — Fetch full POI metadata from the database for the
 *                    given IDs, including description, category, difficulty,
 *                    amenities, and coordinates.
 *   2. Augmentation — Inject the retrieved metadata into a structured prompt
 *                    that instructs the LLM on scheduling logic
 *                    (e.g. hike in the morning, café at noon, viewpoint at sunset).
 *   3. Generation  — The LLM returns a strictly typed JSON plan with
 *                    chronologically ordered stops and smart insights.
 *
 * Request body:
 *   { poi_ids: string[] }   — 2 to 15 POI IDs
 *
 * Response:
 *   {
 *     data: {
 *       mode: "smart",
 *       stops: SmartRouteStop[],
 *       smart_plan: SmartPlan,
 *       total_duration_minutes: number
 *     }
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api/response';
import { fetchBucketPois } from '@/lib/trip-bucket/bucket-db';
import { runSmartBuild } from '@/lib/trip-bucket/smart-build';

export const maxDuration = 60; // seconds — LLM calls can take 15–30 s

export async function POST(req: NextRequest) {
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

    console.log(`[SmartBuild] Starting RAG flow for ${pois.length} POIs`);

    // ── Steps 2 & 3: Augmentation + Generation (LLM call) ────────────────────
    const smartPlan = await runSmartBuild(pois);

    // ── Map the LLM result to the unified RouteStop shape ─────────────────────
    // Calculate total duration including visits
    const totalDurationMinutes = smartPlan.stops.reduce(
      (acc, stop) => acc + stop.duration_minutes,
      0,
    );

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
      }),
      { status: 200 },
    );
  } catch (err) {
    console.error('[POST /api/trip-bucket/smart-build]', err);
    return NextResponse.json(
      errorResponse(
        err instanceof Error ? err.message : 'Smart Build generation failed',
        'GENERATION_ERROR',
      ),
      { status: 500 },
    );
  }
}
