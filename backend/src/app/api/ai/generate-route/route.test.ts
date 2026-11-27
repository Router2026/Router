import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/tokens", () => ({ getUserFromRequest: vi.fn() }));
vi.mock("@/lib/db/raw-client", () => ({ rawDb: { query: vi.fn() } }));
vi.mock("@/lib/ai-route/rate-limit", () => ({ consumeRouteQuota: vi.fn() }));
vi.mock("@/lib/ai-route/daily-budget", () => ({ consumeDailyAiBudget: vi.fn() }));
// The planner switch: Groq by default in these tests; the agent tests below opt in.
vi.mock("@/lib/trip-agents/wizard-planner", () => ({
  routePlanner: vi.fn(() => "groq"),
  planWithAgents: vi.fn(),
  AgentsTimeoutError: class AgentsTimeoutError extends Error {},
}));
vi.mock("@/lib/ai-route/generate", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai-route/generate")>()),
  planRoute: vi.fn(),
}));

import { POST } from "./route";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { rawDb } from "@/lib/db/raw-client";
import { consumeRouteQuota } from "@/lib/ai-route/rate-limit";
import { consumeDailyAiBudget } from "@/lib/ai-route/daily-budget";
import { planRoute, NoCandidatesError, type PlannedRoute } from "@/lib/ai-route/generate";
import { makeCandidate } from "@/lib/ai-route/test-fixtures";
import { AgentsTimeoutError, planWithAgents, routePlanner } from "@/lib/trip-agents/wizard-planner";

const mockUser = getUserFromRequest as ReturnType<typeof vi.fn>;
const mockQuery = (rawDb as unknown as { query: ReturnType<typeof vi.fn> }).query;
const mockQuota = consumeRouteQuota as ReturnType<typeof vi.fn>;
const mockPlan = planRoute as ReturnType<typeof vi.fn>;

function request(body: unknown) {
  return new NextRequest("http://localhost/api/ai/generate-route", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json", Authorization: "Bearer t" },
  });
}

const validBody = { region: "גולן", groupType: "family", styles: ["water"] };
const resetAt = new Date(Date.now() + 30 * 60_000);

const planned: PlannedRoute = {
  title: "יום מים", source: "ai",
  stops: [{
    candidate: makeCandidate({ key: "L1", locationId: 77, name: "בניאס" }),
    reasoning: "מתאים", visitMinutes: 60, orderIndex: 0,
    arrivalTime: "09:00", departureTime: "10:00", driveMinutesFromPrev: 0, distanceFromPrevKm: 0,
  }],
  totalDriveMinutes: 0, totalDistanceKm: 0, endTime: "10:00",
  diagnostics: {
    candidateCount: 1, usedCategoryFallback: false, targetStops: 1, aiAttempts: 1, aiError: null,
    rejectedIds: 0, matchedByName: 0, droppedForTime: 0, aiMs: 5,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mockUser.mockResolvedValue({ id: 5, email: "a@b.c", is_admin: false });
  mockQuery.mockResolvedValue({ rows: [{ id: 3, name: "גולן", slug: "golan_hermon" }] });
  (routePlanner as ReturnType<typeof vi.fn>).mockReturnValue("groq");
  mockQuota.mockResolvedValue({ allowed: true, limit: 10, remaining: 9, resetAt });
  mockPlan.mockResolvedValue(planned);
  (consumeDailyAiBudget as ReturnType<typeof vi.fn>).mockResolvedValue(true);
});

describe("POST /api/ai/generate-route", () => {
  it("allows any signed-in (non-admin) user and returns stops with location_id", async () => {
    const res = await POST(request(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.stops[0]).toMatchObject({ location_id: 77, poi_name: "בניאס", smart_insight: "מתאים" });
    expect(json.data.source).toBe("ai");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("9");
    expect(mockQuota).toHaveBeenCalledWith(5);
    expect(mockPlan.mock.calls[0][0]).toMatchObject({ regionId: 3, prefs: { groupType: "family", styles: ["water"] } });
  });

  it("returns 401 for anonymous users without touching the DB", async () => {
    mockUser.mockResolvedValue(null);
    const res = await POST(request(validBody));
    expect(res.status).toBe(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON or fields, without consuming quota", async () => {
    expect((await POST(request("{not json"))).status).toBe(400);
    const res = await POST(request({ ...validBody, groupType: "aliens" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(mockQuota).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown region, without consuming quota", async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await POST(request(validBody));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("UNKNOWN_REGION");
    expect(mockQuota).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when over quota, without calling the planner", async () => {
    mockQuota.mockResolvedValue({ allowed: false, limit: 10, remaining: 0, resetAt });
    const res = await POST(request(validBody));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(mockPlan).not.toHaveBeenCalled();
  });

  it("returns 404 when the region has no locations", async () => {
    mockPlan.mockRejectedValue(new NoCandidatesError());
    const res = await POST(request(validBody));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NO_LOCATIONS");
  });

  it("hides internal error details from the client", async () => {
    mockPlan.mockRejectedValue(new Error("password=hunter2 connection refused"));
    const res = await POST(request(validBody));
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("hunter2");
    expect(text).toContain("GENERATION_ERROR");
  });

  describe("trip agents (default planner)", () => {
    const agentRoute = {
      name: "יום מים בגולן", description: "תכננתי לך יום ש…", region: "גולן", region_id: 3, group_type: "family",
      style: "מים", source: "ai", start_time: "09:00", end_time: "14:00", total_duration_hours: 5, total_distance_km: 20,
      total_drive_minutes: 30, stops: [{ location_id: 9, poi_name: "יהודיה", category: "שמורת טבע", latitude: 32.9, longitude: 35.7,
        main_image: null, order_index: 0, arrival_time: "09:00", departure_time: "11:00", duration_minutes: 120,
        drive_minutes_from_prev: 0, distance_from_prev_km: 0, smart_insight: "הביאו נעלי מים" }],
    };

    it("uses the agents and skips Groq when they return a route", async () => {
      (routePlanner as ReturnType<typeof vi.fn>).mockReturnValue("agents");
      (planWithAgents as ReturnType<typeof vi.fn>).mockResolvedValue(agentRoute);
      const res = await POST(request(validBody));
      expect(res.status).toBe(200);
      expect((await res.json()).data.name).toBe("יום מים בגולן");
      expect(mockPlan).not.toHaveBeenCalled();
      expect((planWithAgents as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatchObject({ id: 3, slug: "golan_hermon" });
    });

    it("falls back to Groq when the agents fail or find too little", async () => {
      (routePlanner as ReturnType<typeof vi.fn>).mockReturnValue("agents");
      (planWithAgents as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("anthropic down"));
      let res = await POST(request(validBody));
      expect(res.status).toBe(200);
      expect((await res.json()).data.stops[0].poi_name).toBe("בניאס");

      (planWithAgents as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      res = await POST(request(validBody));
      expect((await res.json()).data.stops[0].poi_name).toBe("בניאס");
      expect(mockPlan).toHaveBeenCalledTimes(2);
    });

    it("after an agents timeout, plans deterministically (no Groq model call) so the request ends in time", async () => {
      (routePlanner as ReturnType<typeof vi.fn>).mockReturnValue("agents");
      (planWithAgents as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new AgentsTimeoutError("slow"));
      const res = await POST(request(validBody));
      expect(res.status).toBe(200);
      expect(mockPlan.mock.calls[0][1]).toEqual({ selector: null });
    });

    it("streams the agents' progress and then the route when asked for NDJSON", async () => {
      (routePlanner as ReturnType<typeof vi.fn>).mockReturnValue("agents");
      (planWithAgents as ReturnType<typeof vi.fn>).mockImplementation(async (_i: unknown, _r: unknown, _b: unknown, onStep: (s: string, p: string, d?: string) => void) => {
        onStep("search", "start");
        onStep("search", "done", "מצאתי 8 מקומות");
        return agentRoute;
      });
      const req = new NextRequest("http://localhost/api/ai/generate-route", {
        method: "POST", body: JSON.stringify(validBody),
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson", Authorization: "Bearer t" },
      });
      const res = await POST(req);
      expect(res.headers.get("content-type")).toContain("application/x-ndjson");
      const ev = (await res.text()).trim().split(String.fromCharCode(10)).map((l) => JSON.parse(l));
      expect(ev[0]).toEqual({ type: "step", step: "search", phase: "start" });
      expect(ev[1]).toEqual({ type: "step", step: "search", phase: "done", detail: "מצאתי 8 מקומות" });
      expect(ev.at(-1)).toMatchObject({ type: "result", data: { name: "יום מים בגולן" } });
    });

    it("streams a fallback step when the agents fail", async () => {
      (routePlanner as ReturnType<typeof vi.fn>).mockReturnValue("agents");
      (planWithAgents as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("down"));
      const req = new NextRequest("http://localhost/api/ai/generate-route", {
        method: "POST", body: JSON.stringify(validBody),
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson", Authorization: "Bearer t" },
      });
      const ev = (await (await POST(req)).text()).trim().split(String.fromCharCode(10)).map((l) => JSON.parse(l));
      expect(ev.map((e) => e.step ?? e.type)).toEqual(["fallback", "fallback", "result"]);
    });

    it("ROUTE_PLANNER=groq skips the agents entirely", async () => {
      await POST(request(validBody));
      expect(planWithAgents).not.toHaveBeenCalled();
      expect(mockPlan).toHaveBeenCalled();
    });
    it("once the daily AI budget is spent, skips the agents and Groq and plans deterministically", async () => {
      (routePlanner as ReturnType<typeof vi.fn>).mockReturnValue("agents");
      (consumeDailyAiBudget as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      const res = await POST(request(validBody));
      expect(res.status).toBe(200);
      expect(planWithAgents).not.toHaveBeenCalled();
      expect(mockPlan.mock.calls[0][1]).toEqual({ selector: null });
    });
  });
});
