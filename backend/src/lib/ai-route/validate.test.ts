import { describe, it, expect } from "vitest";
import { validatePlan, clampVisitMinutes, InvalidPlanShapeError, MAX_VISIT_MINUTES } from "./validate";
import { makeCandidate } from "./test-fixtures";

const candidates = [
  makeCandidate({ key: "L1", locationId: 101, name: "עין גדי", lat: 31.46, lng: 35.39, durationMinutes: 90 }),
  makeCandidate({ key: "L2", locationId: 102, name: "נחל עמוד", lat: 32.9, lng: 35.5 }),
  makeCandidate({ key: "L3", locationId: 103, name: "מצפה גדות", lat: 33.0, lng: 35.6, durationMinutes: 30 }),
];

describe("validatePlan", () => {
  it("rebuilds stops from candidate data, ignoring LLM-provided coordinates/names", () => {
    const res = validatePlan(
      { title: "יום של מים", stops: [{ id: "L2", reasoning: "מים זורמים", visitMinutes: 100, latitude: 0, name: "Fake" }] },
      candidates,
    );
    expect(res.stops).toHaveLength(1);
    expect(res.stops[0].candidate).toBe(candidates[1]);
    expect(res.stops[0].candidate.lat).toBe(32.9);
    expect(res.stops[0]).toMatchObject({ reasoning: "מים זורמים", visitMinutes: 100 });
    expect(res.title).toBe("יום של מים");
  });

  it("rejects hallucinated ids that are not in the candidate list", () => {
    const res = validatePlan({ stops: [{ id: "L99" }, { id: "L1" }, { id: "123" }] }, candidates);
    expect(res.stops.map((s) => s.candidate.locationId)).toEqual([101]);
    expect(res.rejected.map((r) => r.reason)).toEqual(["unknown_id", "unknown_id"]);
  });

  it("rejects a real DB id passed instead of the key", () => {
    const res = validatePlan({ stops: [{ id: 101 }] }, candidates);
    expect(res.stops).toHaveLength(0);
    expect(res.rejected[0].reason).toBe("unknown_id");
  });

  it("normalizes key case/whitespace and accepts the `key` alias", () => {
    const res = validatePlan({ stops: [{ id: " l1 " }, { key: "L3" }] }, candidates);
    expect(res.stops.map((s) => s.candidate.key)).toEqual(["L1", "L3"]);
  });

  it("drops duplicates, including the same place by key and by name", () => {
    const res = validatePlan({ stops: [{ id: "L1" }, { id: "L1" }, { name: "עֵין גֶּדִי" }] }, candidates);
    expect(res.stops).toHaveLength(1);
    expect(res.rejected.map((r) => r.reason)).toEqual(["duplicate", "duplicate"]);
  });

  it("falls back to exact (normalized) name match only against candidates", () => {
    const res = validatePlan({ stops: [{ name: "נחל עמוד" }, { name: "הכותל המערבי" }] }, candidates);
    expect(res.stops.map((s) => s.candidate.locationId)).toEqual([102]);
    expect(res.matchedByName).toBe(1);
    expect(res.rejected[0].reason).toBe("unknown_id");
  });

  it("enforces maxStops", () => {
    const res = validatePlan({ stops: [{ id: "L1" }, { id: "L2" }, { id: "L3" }] }, candidates, { maxStops: 2 });
    expect(res.stops).toHaveLength(2);
    expect(res.rejected[0].reason).toBe("over_limit");
  });

  it("marks non-object stops as malformed", () => {
    const res = validatePlan({ stops: ["L1", null, { id: "L2" }] }, candidates);
    expect(res.stops).toHaveLength(1);
    expect(res.rejected.map((r) => r.reason)).toEqual(["malformed", "malformed"]);
  });

  it("uses the DB duration when visitMinutes is missing and accepts snake_case", () => {
    const res = validatePlan({ stops: [{ id: "L1" }, { id: "L3", visit_minutes: 45 }] }, candidates);
    expect(res.stops.map((s) => s.visitMinutes)).toEqual([90, 45]);
  });

  it("sanitizes reasoning and title", () => {
    const res = validatePlan({ title: "<b>x</b>", stops: [{ id: "L1", reason: "a\n`b`" }] }, candidates);
    expect(res.stops[0].reasoning).toBe("a b");
    expect(res.title).toBe("b x /b");
  });

  it("throws InvalidPlanShapeError on a wrong top-level shape", () => {
    expect(() => validatePlan({ days: [] }, candidates)).toThrow(InvalidPlanShapeError);
    expect(() => validatePlan(null, candidates)).toThrow(InvalidPlanShapeError);
  });
});

describe("clampVisitMinutes", () => {
  it("clamps into range and rounds", () => {
    expect(clampVisitMinutes(5, 60)).toBe(15);
    expect(clampVisitMinutes(10_000, 60)).toBe(MAX_VISIT_MINUTES);
    expect(clampVisitMinutes(44.6, 60)).toBe(45);
  });

  it("uses the fallback for missing, zero, negative or NaN values", () => {
    expect(clampVisitMinutes(undefined, 70)).toBe(70);
    expect(clampVisitMinutes(0, 70)).toBe(70);
    expect(clampVisitMinutes(-3, 70)).toBe(70);
    expect(clampVisitMinutes(Number.NaN, 70)).toBe(70);
  });
});
