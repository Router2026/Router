import { describe, it, expect } from "vitest";
import { selectFallbackStops, topUpStops, fallbackReasoning } from "./fallback";
import { makeCandidate, makeStop } from "./test-fixtures";

// A cluster in the north and one far-away place in the south.
const n1 = makeCandidate({ key: "L1", locationId: 1, lat: 33.00, lng: 35.60, category: "מעיין" });
const n2 = makeCandidate({ key: "L2", locationId: 2, lat: 33.02, lng: 35.61, category: "מעיין" });
const n3 = makeCandidate({ key: "L3", locationId: 3, lat: 33.03, lng: 35.62, category: "מצפה" });
const far = makeCandidate({ key: "L4", locationId: 4, lat: 30.60, lng: 34.80, category: "גיאולוגיה" });
const all = [n1, far, n2, n3];

describe("selectFallbackStops", () => {
  it("starts from the top-ranked candidate and clusters nearby places", () => {
    const res = selectFallbackStops(all, 3);
    expect(res.map((s) => s.candidate.locationId)).not.toContain(4);
    expect(res[0].candidate.locationId).toBe(1);
  });

  it("prefers a new category over a slightly closer repeat", () => {
    // n2 is closer to n1 than n3, but n3 adds a new category within the penalty margin.
    const res = selectFallbackStops([n1, n2, n3], 2);
    expect(res.map((s) => s.candidate.category)).toEqual(["מעיין", "מצפה"]);
  });

  it("anchors to a start point when given", () => {
    const res = selectFallbackStops(all, 1, new Set(), { lat: 30.5, lng: 34.8 });
    expect(res[0].candidate.locationId).toBe(4);
  });

  it("respects exclusions, count and empty input", () => {
    expect(selectFallbackStops(all, 10, new Set([1, 2]))).toHaveLength(2);
    expect(selectFallbackStops([], 3)).toEqual([]);
    expect(selectFallbackStops(all, 0)).toEqual([]);
  });

  it("uses DB duration and Hebrew reasoning", () => {
    const [s] = selectFallbackStops([n3], 1);
    expect(s.visitMinutes).toBe(n3.durationMinutes);
    expect(s.reasoning).toBe(fallbackReasoning("מצפה"));
    expect(fallbackReasoning("unknown")).toMatch(/מקום מומלץ/);
  });
});

describe("topUpStops", () => {
  it("adds nearby unused places until target, keeping existing stops first", () => {
    const res = topUpStops([makeStop(n1)], all, 3);
    expect(res).toHaveLength(3);
    expect(res[0].candidate.locationId).toBe(1);
    expect(new Set(res.map((s) => s.candidate.locationId)).size).toBe(3);
    expect(res.map((s) => s.candidate.locationId)).not.toContain(4);
  });

  it("returns a copy unchanged when already at target", () => {
    const stops = [makeStop(n1), makeStop(n2)];
    const res = topUpStops(stops, all, 2);
    expect(res).toEqual(stops);
    expect(res).not.toBe(stops);
  });
});
