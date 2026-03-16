import { describe, it, expect } from 'vitest';
import { haversineKm, buildHaversineMatrix, heldKarp, solveTsp, type TspNode } from './tsp-engine';

function makeNode(id: string, lat: number, lng: number): TspNode {
  return { id, name: `Node ${id}`, latitude: lat, longitude: lng, duration_minutes: 60 };
}

describe('haversineKm', () => {
  it('returns 0 for same point', () => {
    expect(haversineKm(32.0, 35.0, 32.0, 35.0)).toBe(0);
  });

  it('returns approximately correct distance between two known points', () => {
    // Tel Aviv to Jerusalem ~ 60km straight-line
    const dist = haversineKm(32.0853, 34.7818, 31.7683, 35.2137);
    expect(dist).toBeGreaterThan(50);
    expect(dist).toBeLessThan(80);
  });

  it('is symmetric', () => {
    const d1 = haversineKm(32.0, 35.0, 31.5, 34.5);
    const d2 = haversineKm(31.5, 34.5, 32.0, 35.0);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });
});

describe('buildHaversineMatrix', () => {
  it('diagonal is always 0', () => {
    const nodes = [makeNode('A', 32.0, 35.0), makeNode('B', 31.5, 34.5), makeNode('C', 33.0, 36.0)];
    const matrix = buildHaversineMatrix(nodes);
    for (let i = 0; i < nodes.length; i++) {
      expect(matrix[i][i]).toBe(0);
    }
  });

  it('matrix is symmetric', () => {
    const nodes = [makeNode('A', 32.0, 35.0), makeNode('B', 31.5, 34.5)];
    const matrix = buildHaversineMatrix(nodes);
    expect(matrix[0][1]).toBeCloseTo(matrix[1][0], 5);
  });
});

describe('solveTsp', () => {
  it('returns empty result for 0 nodes', () => {
    const result = solveTsp([], [], false);
    expect(result.orderedNodes).toHaveLength(0);
    expect(result.totalTravelMinutes).toBe(0);
    expect(result.totalDistanceKm).toBe(0);
  });

  it('returns single node unchanged', () => {
    const nodes = [makeNode('A', 32.0, 35.0)];
    const matrix = buildHaversineMatrix(nodes);
    const result = solveTsp(nodes, matrix, false);
    expect(result.orderedNodes).toHaveLength(1);
    expect(result.orderedNodes[0].id).toBe('A');
    expect(result.totalTravelMinutes).toBe(0);
  });

  it('returns both nodes for 2-node input', () => {
    const nodes = [makeNode('A', 32.0, 35.0), makeNode('B', 31.5, 34.5)];
    const matrix = buildHaversineMatrix(nodes);
    const result = solveTsp(nodes, matrix, false);
    expect(result.orderedNodes).toHaveLength(2);
  });

  it('returns all nodes for multi-stop input', () => {
    const nodes = [
      makeNode('A', 32.0, 35.0),
      makeNode('B', 31.5, 34.5),
      makeNode('C', 33.0, 36.0),
      makeNode('D', 31.0, 35.5),
    ];
    const matrix = buildHaversineMatrix(nodes);
    const result = solveTsp(nodes, matrix, false);
    expect(result.orderedNodes).toHaveLength(4);
    // All original nodes appear exactly once
    const ids = result.orderedNodes.map((n) => n.id).sort();
    expect(ids).toEqual(['A', 'B', 'C', 'D']);
  });

  it('TSP result has shorter or equal travel distance than naive order', () => {
    // Place 4 nodes in a clearly non-optimal order
    // Optimal order: A -> B -> C -> D (goes in one direction)
    const nodes = [
      makeNode('A', 31.0, 35.0), // start
      makeNode('C', 33.0, 35.0), // far jump
      makeNode('B', 32.0, 35.0), // then back
      makeNode('D', 34.0, 35.0), // then far again
    ];
    const matrix = buildHaversineMatrix(nodes);
    const result = solveTsp(nodes, matrix, false);

    // Naive distance: A->C->B->D
    const naiveDist = matrix[0][1] + matrix[1][2] + matrix[2][3];
    // TSP distance
    const tspDist = result.totalTravelMinutes;

    expect(tspDist).toBeLessThanOrEqual(naiveDist + 0.001);
  });

  it('with fixedStart=true, first node is preserved as origin', () => {
    const nodes = [
      makeNode('start', 32.0, 35.0),
      makeNode('A', 31.5, 34.5),
      makeNode('B', 33.0, 36.0),
    ];
    const matrix = buildHaversineMatrix(nodes);
    const result = solveTsp(nodes, matrix, true);
    expect(result.orderedNodes[0].id).toBe('start');
    expect(result.orderedNodes).toHaveLength(3);
  });
});

describe('heldKarp', () => {
  it('single node returns [0]', () => {
    expect(heldKarp([[0]])).toEqual([0]);
  });

  it('two nodes returns [0, 1]', () => {
    expect(
      heldKarp([
        [0, 5],
        [5, 0],
      ])
    ).toEqual([0, 1]);
  });
});
