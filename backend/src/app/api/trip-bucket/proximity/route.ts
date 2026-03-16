/**
 * POST /api/trip-bucket/proximity
 * --------------------------------
 * Receives an ordered list of POI IDs from the user's Trip Bucket,
 * fetches their coordinates from the database (with PostGIS support),
 * builds a real travel-time distance matrix via Mapbox Directions API
 * (falls back to Haversine when Mapbox is unavailable), and runs the
 * Held-Karp Dynamic Programming TSP algorithm to find the optimal
 * visiting order.
 *
 * Request body:
 *   { poi_ids: string[] }   — 2 to 20 POI IDs (integers as strings)
 *
 * Response:
 *   {
 *     data: {
 *       mode: "proximity",
 *       stops: RouteStop[],
 *       total_distance_km: number,
 *       total_duration_minutes: number
 *     }
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api/response';
import { fetchBucketPois, toTspNodes } from '@/lib/trip-bucket/bucket-db';
import { buildHaversineMatrix, solveTsp } from '@/lib/trip-bucket/tsp-engine';
import { fetchMapboxMatrix } from '@/lib/trip-bucket/mapbox-matrix';

// Arrival time scheduling constants
const DAY_START_HOUR = 8; // 08:00
const DAY_START_MIN = 0;
const TRANSITION_BUFFER_MIN = 10; // buffer between stops

export const maxDuration = 30; // seconds — route computation can take a few seconds

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { poi_ids } = body as { poi_ids?: string[] };

    // ── Validation ────────────────────────────────────────────────────────────
    if (!Array.isArray(poi_ids) || poi_ids.length < 2) {
      return NextResponse.json(
        errorResponse('poi_ids must be an array of at least 2 IDs', 'VALIDATION_ERROR'),
        { status: 400 }
      );
    }
    if (poi_ids.length > 20) {
      return NextResponse.json(
        errorResponse('Maximum 20 POIs supported for proximity optimization', 'VALIDATION_ERROR'),
        { status: 400 }
      );
    }

    // ── Step 1: Retrieval — fetch full POI metadata (including PostGIS coords) ─
    const pois = await fetchBucketPois(poi_ids);

    if (pois.length < 2) {
      return NextResponse.json(
        errorResponse('Could not find enough valid POIs for the provided IDs', 'NOT_FOUND'),
        { status: 404 }
      );
    }

    const nodes = toTspNodes(pois);

    // ── Step 2: Build distance matrix ─────────────────────────────────────────
    // Prefer real Mapbox travel times; fall back to straight-line Haversine.
    let matrix = await fetchMapboxMatrix(nodes);
    const usedMapbox = matrix !== null;
    if (!matrix) {
      matrix = buildHaversineMatrix(nodes);
    }

    console.log(
      `[Proximity] ${nodes.length} nodes, matrix source: ${usedMapbox ? 'Mapbox' : 'Haversine'}`
    );

    // ── Step 3: Run DP-TSP solver ─────────────────────────────────────────────
    const { orderedNodes, totalTravelMinutes, totalDistanceKm } = solveTsp(nodes, matrix);

    // ── Step 4: Assign arrival times ──────────────────────────────────────────
    let cursor = DAY_START_HOUR * 60 + DAY_START_MIN; // minutes from midnight

    const stops = orderedNodes.map((node, i) => {
      const hh = Math.floor(cursor / 60)
        .toString()
        .padStart(2, '0');
      const mm = (cursor % 60).toString().padStart(2, '0');
      const arrival_time = `${hh}:${mm}`;

      // Advance cursor: visit duration + travel to next stop + buffer
      const travelToNext =
        i < orderedNodes.length - 1
          ? matrix![nodes.findIndex((n) => n.id === node.id)][
              nodes.findIndex((n) => n.id === orderedNodes[i + 1].id)
            ]
          : 0;

      cursor += node.duration_minutes + Math.round(travelToNext) + TRANSITION_BUFFER_MIN;

      return {
        poi_id: node.id,
        poi_name: node.name,
        arrival_time,
        duration_minutes: node.duration_minutes,
        order_index: i,
      };
    });

    // ── Response ──────────────────────────────────────────────────────────────
    return NextResponse.json(
      successResponse({
        mode: 'proximity',
        stops,
        total_distance_km: Math.round(totalDistanceKm * 10) / 10,
        total_duration_minutes: Math.round(totalTravelMinutes),
        matrix_source: usedMapbox ? 'mapbox' : 'haversine',
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error('[POST /api/trip-bucket/proximity]', err);
    return NextResponse.json(
      errorResponse(
        err instanceof Error ? err.message : 'Proximity route generation failed',
        'GENERATION_ERROR'
      ),
      { status: 500 }
    );
  }
}
