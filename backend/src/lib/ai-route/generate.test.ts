import { describe, it, expect, vi } from "vitest";

// generate.ts imports the default DB-backed candidate fetcher; tests inject their own.
vi.mock("@/lib/db/raw-client", () => ({ rawDb: { query: vi.fn() } }));

import { planRoute, NoCandidatesError, type PlanRouteDeps } from "./generate";
import { SelectorError, type StopSelector, type SelectionResponse } from "./groq";
import type { RoutePreferences } from "./plan-input";
import { makeCandidate } from "./test-fixtures";
import type { Candidate } from "./types";

const prefs: RoutePreferences = {
  regionName: "גולן", groupType: "couple", styles: ["water"], dayStart: "09:00", dayEnd: "16:00",
};

// 6 places in a small northern cluster, 60 min each -> target = round(420/85) = 5
const candidates: Candidate[] = Array.from({ length: 6 }, (_, i) =>
  makeCandidate({ key: `L${i + 1}`, locationId: 100 + i, name: `מקום ${i + 1}`, lat: 33 + i * 0.01, lng: 35.6, durationMinutes: 60 }),
);

function ok(json: unknown): SelectionResponse {
  return { json, raw: JSON.stringify(json), model: "m", mode: "json_object" };
}

function selectorFrom(...responses: Array<SelectionResponse | Error>): StopSelector & { selectStops: ReturnType<typeof vi.fn> } {
  const fn = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r);
    else fn.mockResolvedValueOnce(r);
  }
  return { selectStops: fn };
}

function deps(selector: StopSelector | null, extra: Partial<PlanRouteDeps> = {}): PlanRouteDeps {
  return {
    selector,
    fetchCandidates: vi.fn().mockResolvedValue({ candidates, usedFallback: false }),
    ...extra,
  };
}

const input = { regionId: 3, prefs, seed: "s" };

// planRoute logs failed AI attempts; keep test output clean.
vi.spyOn(console, "warn").mockImplementation(() => {});

describe("planRoute", () => {
  it("uses AI-selected stops, rebuilt from DB data, and schedules them", async () => {
    const selector = selectorFrom(ok({ title: "יום מים", stops: [
      { id: "L3", reasoning: "א", visitMinutes: 60 },
      { id: "L1", reasoning: "ב", visitMinutes: 60 },
      { id: "L2", reasoning: "ג", visitMinutes: 60 },
    ] }));
    const route = await planRoute(input, deps(selector));

    expect(route.source).toBe("ai");
    expect(route.title).toBe("יום מים");
    // Ordered geographically by the server, not by the LLM (direction is free without an origin).
    const ids = route.stops.map((s) => s.candidate.locationId);
    expect([[100, 101, 102], [102, 101, 100]]).toContainEqual(ids);
    expect(route.stops[0].arrivalTime).toBe("09:00");
    expect(route.diagnostics).toMatchObject({ aiAttempts: 1, aiError: null, rejectedIds: 0, targetStops: 5 });
  });

  it("passes resolved Hebrew categories and the seed to the candidate query", async () => {
    const d = deps(selectorFrom(ok({ stops: [{ id: "L1" }, { id: "L2" }] })));
    await planRoute(input, d);
    expect(d.fetchCandidates).toHaveBeenCalledWith(expect.objectContaining({
      regionId: 3, categories: ["מעיין", "נחל", "מים"], seed: "s", start: null,
    }));
  });

  it("drops hallucinated ids and tops up from DB candidates", async () => {
    const selector = selectorFrom(ok({ stops: [{ id: "L1" }, { id: "L2" }, { id: "L77" }, { name: "מקום שלא קיים" }] }));
    const route = await planRoute(input, deps(selector));

    expect(route.source).toBe("ai_partial");
    expect(route.diagnostics.rejectedIds).toBe(2);
    const ids = route.stops.map((s) => s.candidate.locationId);
    expect(ids).toEqual(expect.arrayContaining([100, 101]));
    for (const id of ids) expect(candidates.map((c) => c.locationId)).toContain(id);
  });

  it("repairs once when the first answer has too few valid ids", async () => {
    const selector = selectorFrom(
      ok({ stops: [{ id: "X1" }] }),
      ok({ stops: [{ id: "L1" }, { id: "L4" }] }),
    );
    const route = await planRoute(input, deps(selector));
    expect(selector.selectStops).toHaveBeenCalledTimes(2);
    expect(selector.selectStops.mock.calls[1][0].repair.prompt).toMatch(/only 0 valid ids/);
    expect(route.source).toBe("ai_partial");
  });

  it("repairs once on a parse error, then falls back", async () => {
    const selector = selectorFrom(
      new SelectorError("parse", "bad", "{oops"),
      new SelectorError("parse", "bad again", "{oops"),
    );
    const route = await planRoute(input, deps(selector));
    expect(selector.selectStops).toHaveBeenCalledTimes(2);
    expect(selector.selectStops.mock.calls[1][0].repair.previousRaw).toBe("{oops");
    expect(route.source).toBe("fallback");
    expect(route.stops.length).toBeGreaterThanOrEqual(2);
  });

  it("repairs on a wrong JSON shape", async () => {
    const selector = selectorFrom(ok({ days: [] }), ok({ stops: [{ id: "L1" }, { id: "L2" }] }));
    const route = await planRoute(input, deps(selector));
    expect(selector.selectStops).toHaveBeenCalledTimes(2);
    expect(route.source).toBe("ai");
  });

  it.each(["timeout", "rate_limited", "http"] as const)("does not retry on %s; uses fallback", async (kind) => {
    const selector = selectorFrom(new SelectorError(kind, kind));
    const route = await planRoute(input, deps(selector));
    expect(selector.selectStops).toHaveBeenCalledTimes(1);
    expect(route.source).toBe("fallback");
    expect(route.diagnostics.aiError).toBe(kind);
    expect(route.title).toBe("יום טבע בגולן");
  });

  it("uses the fallback when the selector is disabled", async () => {
    const route = await planRoute(input, deps(null));
    expect(route.source).toBe("fallback");
    expect(route.diagnostics.aiError).toBe("disabled");
    expect(route.stops.length).toBeGreaterThanOrEqual(2);
  });

  it("does not start an attempt when the time budget is spent", async () => {
    let t = 0;
    const selector: StopSelector = {
      selectStops: vi.fn(async () => {
        t += 24_000; // first call eats almost the whole budget
        return ok({ stops: [{ id: "BAD" }] });
      }),
    };
    const route = await planRoute(input, deps(selector, { now: () => t, budgetMs: 25_000 }));
    expect(selector.selectStops).toHaveBeenCalledTimes(1);
    expect(route.source).toBe("fallback");
  });

  it("caps each attempt's timeout at the remaining budget", async () => {
    const selector = selectorFrom(ok({ stops: [{ id: "L1" }, { id: "L2" }] }));
    await planRoute(input, deps(selector, { budgetMs: 8_000, attemptTimeoutMs: 15_000, now: () => 0 }));
    expect(selector.selectStops.mock.calls[0][1].timeoutMs).toBe(8_000);
  });

  it("skips the LLM when the request was already aborted", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const selector = selectorFrom(ok({ stops: [] }));
    const route = await planRoute({ ...input, signal: ctrl.signal }, deps(selector));
    expect(selector.selectStops).not.toHaveBeenCalled();
    expect(route.source).toBe("fallback");
  });

  it("throws NoCandidatesError when the region has no places", async () => {
    const d = deps(selectorFrom(), { fetchCandidates: vi.fn().mockResolvedValue({ candidates: [], usedFallback: false }) });
    await expect(planRoute(input, d)).rejects.toBeInstanceOf(NoCandidatesError);
  });

  it("reserves the drive home when a start point is given", async () => {
    const far = { lat: 32.08, lng: 34.78 }; // Tel Aviv, ~130km from the cluster
    const selector = selectorFrom(ok({ stops: candidates.slice(0, 5).map((c) => ({ id: c.key, visitMinutes: 60 })) }));
    const route = await planRoute({ ...input, prefs: { ...prefs, start: far } }, deps(selector));
    expect(route.stops[0].driveMinutesFromPrev).toBeGreaterThan(100);
    expect(route.diagnostics.droppedForTime).toBeGreaterThan(0);
  });

  it("propagates unexpected errors instead of hiding them", async () => {
    const selector = selectorFrom(new TypeError("bug"));
    await expect(planRoute(input, deps(selector))).rejects.toThrow("bug");
  });
});
