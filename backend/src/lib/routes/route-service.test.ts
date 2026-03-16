import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/raw-client", () => ({
  rawDb: { query: vi.fn() },
}));

import { rawDb } from "@/lib/db/raw-client";
import {
  getRoutes,
  getRouteById,
  createRoute,
  deleteRoute,
} from "./route-service";

const mockDb = rawDb as { query: ReturnType<typeof vi.fn> };

const sampleRoute = {
  id: 1,
  name: "Galilee Loop",
  description: null,
  region_id: 1,
  region: "צפון",
  user_id: 5,
  total_duration_hours: "6",
  difficulty: "בינוני",
  group_type: "משפחה",
  style: "טבע",
  created_at: new Date(),
};

const sampleStop = {
  id: 10,
  route_id: 1,
  location_id: 100,
  poi_name: "Ein Gedi",
  order_index: 0,
  arrival_time: "09:00",
  duration_minutes: 90,
  smart_insight: null,
  location_name: "Ein Gedi",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getRoutes", () => {
  it("returns all routes without userId filter", async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [sampleRoute] })
      .mockResolvedValueOnce({ rows: [sampleStop] });
    const result = await getRoutes();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Galilee Loop");
    expect(result[0].total_duration_hours).toBe(6);
    // First query should not have WHERE clause
    const [sql] = mockDb.query.mock.calls[0];
    expect(sql).not.toContain("WHERE r.user_id");
  });

  it("filters by userId when provided", async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [sampleRoute] })
      .mockResolvedValueOnce({ rows: [] });
    await getRoutes(5);
    const [sql] = mockDb.query.mock.calls[0];
    expect(sql).toContain("WHERE r.user_id = $1");
  });

  it("attaches stops to their routes", async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [sampleRoute] })
      .mockResolvedValueOnce({ rows: [sampleStop] });
    const result = await getRoutes();
    expect(result[0].stops).toHaveLength(1);
    expect(result[0].stops[0].poi_name).toBe("Ein Gedi");
  });

  it("returns empty array when no routes", async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] });
    const result = await getRoutes();
    expect(result).toEqual([]);
  });
});

describe("getRouteById", () => {
  it("returns route with stops", async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [sampleRoute] })
      .mockResolvedValueOnce({ rows: [sampleStop] });
    const result = await getRouteById(1);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(1);
    expect(result!.stops).toHaveLength(1);
  });

  it("returns null when not found", async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] });
    const result = await getRouteById(999);
    expect(result).toBeNull();
  });
});

describe("deleteRoute", () => {
  it("calls DELETE query with correct id", async () => {
    mockDb.query.mockResolvedValue({ rows: [] });
    await deleteRoute(42);
    const [sql, params] = mockDb.query.mock.calls[0];
    expect(sql).toContain("DELETE FROM routes");
    expect(params).toContain(42);
  });
});

describe("createRoute", () => {
  it("inserts route and stops, returns created route", async () => {
    const newRoute = { ...sampleRoute, id: 2 };
    mockDb.query
      .mockResolvedValueOnce({ rows: [newRoute] }) // INSERT route
      .mockResolvedValueOnce({ rows: [] }) // INSERT stop
      .mockResolvedValueOnce({ rows: [newRoute] }) // getRouteById query 1
      .mockResolvedValueOnce({ rows: [] }); // getRouteById query 2 (stops)

    const result = await createRoute({
      name: "Test Route",
      stops: [
        {
          order_index: 0,
          arrival_time: "09:00",
          duration_minutes: 60,
          poi_name: "Stop 1",
        },
      ],
    });
    expect(result).not.toBeNull();
    const insertCall = mockDb.query.mock.calls[0];
    expect(insertCall[0]).toContain("INSERT INTO routes");
  });
});
