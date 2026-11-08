import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/tokens", () => ({ getUserFromRequest: vi.fn() }));
vi.mock("@/lib/db/raw-client", () => ({ rawDb: { query: vi.fn() } }));
vi.mock("@/lib/ai-route/rate-limit", () => ({ consumeRouteQuota: vi.fn() }));
vi.mock("@/lib/ai-route/generate", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai-route/generate")>()),
  planRoute: vi.fn(),
}));

import { POST } from "./route";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { rawDb } from "@/lib/db/raw-client";
import { consumeRouteQuota } from "@/lib/ai-route/rate-limit";
import { planRoute, NoCandidatesError, type PlannedRoute } from "@/lib/ai-route/generate";
import { makeCandidate } from "@/lib/ai-route/test-fixtures";

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
  mockQuery.mockResolvedValue({ rows: [{ id: 3, name: "גולן" }] });
  mockQuota.mockResolvedValue({ allowed: true, limit: 10, remaining: 9, resetAt });
  mockPlan.mockResolvedValue(planned);
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
});
