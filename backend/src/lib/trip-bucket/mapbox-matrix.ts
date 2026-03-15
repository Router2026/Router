/**
 * Mapbox Directions Distance Matrix
 * ----------------------------------
 * Fetches real-world travel times and distances between a set of POI
 * coordinates using the Mapbox Matrix API.
 *
 * Falls back gracefully to a Haversine-based matrix when:
 *   - MAPBOX_TOKEN is not configured
 *   - The API call fails
 *   - There are more than 25 nodes (Mapbox Matrix limit per request)
 *
 * Docs: https://docs.mapbox.com/api/navigation/matrix/
 */

import { haversineKm, type TspNode, type DistanceMatrix } from './tsp-engine';

const MAPBOX_BASE = 'https://api.mapbox.com/directions-matrix/v1/mapbox/driving';
/** Mapbox Matrix API limit per single request */
const MAPBOX_MAX_NODES = 25;
/** Average driving speed assumption for fallback (km/h) */
const AVG_SPEED_KMH = 60;

interface MapboxMatrixResponse {
  code: string;
  durations: number[][] | null; // seconds
  distances: number[][] | null; // meters
}

/**
 * Build a travel-time matrix (minutes) using the Mapbox Directions Matrix API.
 * Returns null when Mapbox is unavailable — callers should fall back to Haversine.
 */
export async function fetchMapboxMatrix(
  nodes: TspNode[],
): Promise<DistanceMatrix | null> {
  const token = process.env.MAPBOX_TOKEN;
  if (!token || nodes.length > MAPBOX_MAX_NODES) {
    return null;
  }

  // Build the coordinate string: "lng,lat;lng,lat;..."
  const coords = nodes
    .map(n => `${n.longitude},${n.latitude}`)
    .join(';');

  const url = `${MAPBOX_BASE}/${coords}?annotations=duration,distance&access_token=${token}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.error(`[Mapbox Matrix] HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as MapboxMatrixResponse;
    if (data.code !== 'Ok' || !data.durations) {
      console.error('[Mapbox Matrix] Non-OK response:', data.code);
      return null;
    }

    // Convert seconds → minutes; replace null cells with Haversine estimate
    const n = nodes.length;
    const matrix: DistanceMatrix = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const rawSeconds = data.durations[i]?.[j];
        if (rawSeconds != null && rawSeconds > 0) {
          matrix[i][j] = rawSeconds / 60; // seconds → minutes
        } else if (i !== j) {
          // Fallback: Haversine → minutes at average speed
          const km = haversineKm(
            nodes[i].latitude, nodes[i].longitude,
            nodes[j].latitude, nodes[j].longitude,
          );
          matrix[i][j] = (km / AVG_SPEED_KMH) * 60;
        }
      }
    }

    return matrix;
  } catch (err) {
    console.error('[Mapbox Matrix] Fetch failed:', err);
    return null;
  }
}
