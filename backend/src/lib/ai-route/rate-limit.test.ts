import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/raw-client", () => ({ rawDb: { query: vi.fn() } }));

import { rawDb } from "@/lib/db/raw-client";
import { consumeRouteQuota, hourlyLimitFromEnv, DEFAULT_HOURLY_LIMIT } from "./rate-limit";

const mockQuery = (rawDb as unknown as { query: ReturnType<typeof vi.fn> }).query;
const reset = new Date("2026-11-08T15:00:00Z");

beforeEach(() => vi.clearAllMocks());

describe("consumeRouteQuota", () => {
  it("allows requests up to the limit and reports remaining", async () => {
    mockQuery.mockResolvedValue({ rows: [{ request_count: 3, reset_at: reset }] });
    const res = await consumeRouteQuota(42, 10, () => 1);
    expect(res).toEqual({ allowed: true, limit: 10, remaining: 7, resetAt: reset });
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/ON CONFLICT \(user_id, window_start\)/);
    expect(params).toEqual([42]);
  });

  it("allows exactly the limit and blocks the next request", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ request_count: 10, reset_at: reset }] });
    expect((await consumeRouteQuota(1, 10, () => 1)).allowed).toBe(true);
    mockQuery.mockResolvedValueOnce({ rows: [{ request_count: 11, reset_at: reset.toISOString() }] });
    const blocked = await consumeRouteQuota(1, 10, () => 1);
    expect(blocked).toMatchObject({ allowed: false, remaining: 0 });
    expect(blocked.resetAt.getTime()).toBe(reset.getTime());
  });

  it("occasionally prunes old windows without awaiting or failing", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ request_count: 1, reset_at: reset }] })
      .mockRejectedValueOnce(new Error("cleanup down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await consumeRouteQuota(1, 10, () => 0);
    expect(res.allowed).toBe(true);
    expect(mockQuery.mock.calls[1][0]).toMatch(/DELETE FROM ai_route_rate_limits/);
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("propagates DB errors on the counter itself (fail closed)", async () => {
    mockQuery.mockRejectedValueOnce(new Error("db down"));
    await expect(consumeRouteQuota(1, 10, () => 1)).rejects.toThrow("db down");
  });
});

describe("hourlyLimitFromEnv", () => {
  it("parses positive integers and falls back otherwise", () => {
    expect(hourlyLimitFromEnv("25")).toBe(25);
    expect(hourlyLimitFromEnv(undefined)).toBe(DEFAULT_HOURLY_LIMIT);
    expect(hourlyLimitFromEnv("0")).toBe(DEFAULT_HOURLY_LIMIT);
    expect(hourlyLimitFromEnv("abc")).toBe(DEFAULT_HOURLY_LIMIT);
  });
});
