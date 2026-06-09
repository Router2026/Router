/**
 * TSP Engine — Dynamic Programming Held-Karp Algorithm
 * -----------------------------------------------------
 * Solves the Traveling Salesman Problem to find the optimal visiting order
 * for a set of POIs, minimizing total travel time/distance.
 *
 * Supports an optional fixed start node (e.g. user's live location):
 *   - When provided, node 0 is pinned as origin and excluded from the
 *     permutation search. The DP only optimises over nodes [1..n-1].
 *   - When omitted, the first POI in the array is used as the start.
 *
 * Time complexity:  O(n² · 2ⁿ)  — practical up to ~20 nodes.
 * Space complexity: O(n · 2ⁿ)
 *
 * For larger inputs (n > 20) we fall back to a greedy nearest-neighbor
 * heuristic, which runs in O(n²) and produces a good (not optimal) result.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TspNode {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  duration_minutes: number;
}

/** Symmetric distance matrix — distanceMatrix[i][j] = travel time in minutes */
export type DistanceMatrix = number[][];

export interface TspResult {
  /** Ordered node list — optimal or heuristic visiting sequence (excludes start node) */
  orderedNodes: TspNode[];
  /** Total estimated travel time between stops (minutes) */
  totalTravelMinutes: number;
  /** Total straight-line distance (km) */
  totalDistanceKm: number;
}

// ── Haversine distance ────────────────────────────────────────────────────────

export function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Build a Haversine-based distance matrix (minutes at 60 km/h).
 * Accepts an optional leading "virtual" start node so the matrix can
 * include user location at index 0.
 */
export function buildHaversineMatrix(nodes: TspNode[]): DistanceMatrix {
  const n = nodes.length;
  const matrix: DistanceMatrix = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const km = haversineKm(
        nodes[i].latitude, nodes[i].longitude,
        nodes[j].latitude, nodes[j].longitude,
      );
      const minutes = km; // 60 km/h → 1 km ≈ 1 min
      matrix[i][j] = minutes;
      matrix[j][i] = minutes;
    }
  }
  return matrix;
}

// ── Held-Karp DP TSP with fixed start ────────────────────────────────────────

/**
 * Held-Karp with a FIXED start node (node 0 is the origin).
 * Permutes only nodes [1..n-1].
 */
function heldKarpFixedStart(matrix: DistanceMatrix): number[] {
  const n = matrix.length;
  const INF = Number.MAX_SAFE_INTEGER / 2;
  const m = n - 1; // number of POI nodes
  const FULL = (1 << m) - 1;

  const dp: number[][] = Array.from({ length: 1 << m }, () => new Array(n).fill(INF));
  const parent: number[][] = Array.from({ length: 1 << m }, () => new Array(n).fill(-1));

  for (let v = 1; v < n; v++) {
    dp[1 << (v - 1)][v] = matrix[0][v];
  }

  for (let mask = 1; mask <= FULL; mask++) {
    for (let u = 1; u < n; u++) {
      if (!(mask & (1 << (u - 1)))) continue;
      if (dp[mask][u] === INF) continue;
      for (let v = 1; v < n; v++) {
        if (mask & (1 << (v - 1))) continue;
        const nextMask = mask | (1 << (v - 1));
        const cost = dp[mask][u] + matrix[u][v];
        if (cost < dp[nextMask][v]) {
          dp[nextMask][v] = cost;
          parent[nextMask][v] = u;
        }
      }
    }
  }

  let lastNode = 1;
  let minCost = INF;
  for (let u = 1; u < n; u++) {
    if (dp[FULL][u] < minCost) { minCost = dp[FULL][u]; lastNode = u; }
  }

  const path: number[] = [];
  let mask = FULL;
  let cur = lastNode;
  while (cur !== -1 && cur !== 0) {
    path.unshift(cur);
    const prev = parent[mask][cur];
    mask ^= 1 << (cur - 1);
    cur = prev;
  }
  return [0, ...path];
}

/**
 * Standard Held-Karp (no fixed start — finds globally optimal starting node).
 */
function heldKarpStandard(matrix: DistanceMatrix): number[] {
  const n = matrix.length;
  const INF = Number.MAX_SAFE_INTEGER / 2;
  const FULL_MASK = (1 << n) - 1;

  const dp: number[][] = Array.from({ length: 1 << n }, () => new Array(n).fill(INF));
  const parent: number[][] = Array.from({ length: 1 << n }, () => new Array(n).fill(-1));

  dp[1][0] = 0;

  for (let mask = 1; mask <= FULL_MASK; mask++) {
    for (let u = 0; u < n; u++) {
      if (!(mask & (1 << u))) continue;
      if (dp[mask][u] === INF) continue;
      for (let v = 0; v < n; v++) {
        if (mask & (1 << v)) continue;
        const nextMask = mask | (1 << v);
        const cost = dp[mask][u] + matrix[u][v];
        if (cost < dp[nextMask][v]) {
          dp[nextMask][v] = cost;
          parent[nextMask][v] = u;
        }
      }
    }
  }

  let lastNode = 0;
  let minCost = INF;
  for (let u = 0; u < n; u++) {
    if (dp[FULL_MASK][u] < minCost) { minCost = dp[FULL_MASK][u]; lastNode = u; }
  }

  const path: number[] = [];
  let mask = FULL_MASK;
  let cur = lastNode;
  while (cur !== -1) {
    path.unshift(cur);
    const prev = parent[mask][cur];
    mask ^= 1 << cur;
    cur = prev;
  }
  return path;
}

/**
 * Held-Karp exact TSP.
 *
 * @param matrix     Full (n×n) travel-time matrix including the start node at index 0.
 * @param fixedStart When true, node 0 is treated as a fixed origin (user location).
 *                   The DP permutes only nodes [1..n-1] to find the optimal order.
 *                   When false (default), the algorithm finds the globally optimal
 *                   starting node as well.
 * @returns          Ordered visiting sequence as node indices (includes 0 only when
 *                   fixedStart=true, as the first element).
 */
export function heldKarp(matrix: DistanceMatrix, fixedStart = false): number[] {
  const n = matrix.length;
  if (n === 1) return [0];
  if (n === 2) return [0, 1];
  return fixedStart ? heldKarpFixedStart(matrix) : heldKarpStandard(matrix);
}

// ── Greedy Nearest-Neighbor fallback ─────────────────────────────────────────

function nearestNeighbor(matrix: DistanceMatrix, fixedStart: boolean): number[] {
  const n = matrix.length;
  const visited = new Array(n).fill(false);
  const path: number[] = [0];
  visited[0] = true;

  for (let step = 1; step < n; step++) {
    const last = path[path.length - 1];
    let bestNext = -1;
    let bestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (!visited[j] && matrix[last][j] < bestDist) {
        bestDist = matrix[last][j];
        bestNext = j;
      }
    }
    path.push(bestNext);
    visited[bestNext] = true;
  }

  return path;
}

// ── Public solver ─────────────────────────────────────────────────────────────

/**
 * Solve the TSP for the given nodes.
 *
 * @param nodes      Array of POI nodes. When `fixedStart=true`, the caller should
 *                   prepend the user-location node at index 0 before calling.
 * @param matrix     Corresponding distance matrix.
 * @param fixedStart Pin node 0 as the route origin (user's live location).
 *                   The returned `orderedNodes` will start with that node.
 */
export function solveTsp(
  nodes: TspNode[],
  matrix: DistanceMatrix,
  fixedStart = false,
): TspResult {
  const n = nodes.length;
  if (n === 0) return { orderedNodes: [], totalTravelMinutes: 0, totalDistanceKm: 0 };
  if (n === 1) return { orderedNodes: nodes, totalTravelMinutes: 0, totalDistanceKm: 0 };

  const ordering = n <= 20
    ? heldKarp(matrix, fixedStart)
    : nearestNeighbor(matrix, fixedStart);

  const orderedNodes = ordering.map(i => nodes[i]);

  let totalTravelMinutes = 0;
  let totalDistanceKm = 0;
  for (let k = 0; k < ordering.length - 1; k++) {
    const from = ordering[k];
    const to = ordering[k + 1];
    totalTravelMinutes += matrix[from][to];
    totalDistanceKm += haversineKm(
      nodes[from].latitude, nodes[from].longitude,
      nodes[to].latitude, nodes[to].longitude,
    );
  }

  return { orderedNodes, totalTravelMinutes, totalDistanceKm };
}