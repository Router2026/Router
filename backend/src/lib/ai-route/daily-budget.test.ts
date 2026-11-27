import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/raw-client", () => ({ rawDb: { query: vi.fn() } }));

import { rawDb } from "@/lib/db/raw-client";
import { consumeDailyAiBudget, dailyLimitFromEnv, DEFAULT_DAILY_LIMIT } from "./daily-budget";

const mockQuery = (rawDb as unknown as { query: ReturnType<typeof vi.fn> }).query;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("consumeDailyAiBudget", () => {
  it("allows up to the limit and blocks after it, counting atomically per Israel day", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ request_count: 5 }] });
    expect(await consumeDailyAiBudget(5, () => 1)).toBe(true);
    expect(mockQuery.mock.calls[0][0]).toMatch(/ON CONFLICT \(day\)/);
    expect(mockQuery.mock.calls[0][0]).toMatch(/Asia\/Jerusalem/);
    mockQuery.mockResolvedValueOnce({ rows: [{ request_count: 6 }] });
    expect(await consumeDailyAiBudget(5, () => 1)).toBe(false);
  });

  it("fails open when the counter is unavailable", async () => {
    mockQuery.mockRejectedValueOnce(new Error('relation "ai_daily_budget" does not exist'));
    expect(await consumeDailyAiBudget(5, () => 1)).toBe(true);
  });

  it("reads the limit from env with a safe default", () => {
    expect(dailyLimitFromEnv("50")).toBe(50);
    expect(dailyLimitFromEnv(undefined)).toBe(DEFAULT_DAILY_LIMIT);
    expect(dailyLimitFromEnv("-1")).toBe(DEFAULT_DAILY_LIMIT);
  });
});
