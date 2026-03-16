import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, setAuthToken } from "./api";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockOk(body: unknown) {
  return {
    ok: true,
    json: () => Promise.resolve(body),
  };
}

function mockError(status: number, body: unknown) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve(body),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setAuthToken(null);
});

afterEach(() => {
  setAuthToken(null);
});

describe("api auth", () => {
  it("auth.login returns user and token", async () => {
    mockFetch.mockResolvedValue(
      mockOk({
        data: {
          user: { id: 1, username: "alice", xp_points: 0, level: "מתחיל" },
          token: "abc",
        },
      }),
    );
    const result = await api.auth.login("alice@test.com", "pass");
    expect(result.token).toBe("abc");
    expect(result.user.username).toBe("alice");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("auth.login throws ApiError on 401", async () => {
    mockFetch.mockResolvedValue(
      mockError(401, { error: { message: "Invalid credentials" } }),
    );
    await expect(api.auth.login("x@x.com", "wrong")).rejects.toThrow(
      "Invalid credentials",
    );
  });

  it("auth.register returns requiresVerification", async () => {
    mockFetch.mockResolvedValue(mockOk({ data: { user: {} } }));
    const result = await api.auth.register("a@b.com", "pass", "Alice", "alice");
    expect(result.requiresVerification).toBe(true);
  });

  it("auth.me calls /auth/me and maps user", async () => {
    mockFetch.mockResolvedValue(
      mockOk({
        data: { id: 2, username: "bob", xp_points: 100, level: "חוקר" },
      }),
    );
    const user = await api.auth.me("tok");
    expect(user.username).toBe("bob");
    expect(user.xp_points).toBe(100);
  });
});

describe("api locations", () => {
  it("list returns mapped POIs", async () => {
    mockFetch.mockResolvedValue(
      mockOk({
        data: [
          {
            id: 1,
            name: "test",
            latitude: "32.0",
            longitude: "35.0",
            images: [],
            average_rating: "4.5",
          },
        ],
      }),
    );
    const pois = await api.locations.list();
    expect(pois).toHaveLength(1);
    expect(pois[0].id).toBe("1");
    expect(pois[0].latitude).toBe(32.0);
    expect(pois[0].average_rating).toBe(4.5);
  });

  it("list passes region filter in query string", async () => {
    mockFetch.mockResolvedValue(mockOk({ data: [] }));
    await api.locations.list({ region: "north" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("region=north"),
      expect.any(Object),
    );
  });

  it("get fetches single location by id", async () => {
    mockFetch.mockResolvedValue(
      mockOk({
        data: {
          id: 5,
          name: "Ein Gedi",
          latitude: "31.0",
          longitude: "35.3",
          images: [],
          average_rating: "4.8",
        },
      }),
    );
    const poi = await api.locations.get("5");
    expect(poi.name).toBe("Ein Gedi");
  });
});

describe("api trips (routes)", () => {
  it("list returns mapped trips", async () => {
    mockFetch.mockResolvedValue(
      mockOk({
        data: [
          { id: 1, name: "Route 1", total_duration_hours: "3", stops: [] },
        ],
      }),
    );
    const trips = await api.trips.list();
    expect(trips[0].name).toBe("Route 1");
    expect(trips[0].total_duration_hours).toBe(3);
  });

  it("delete calls DELETE /routes/:id", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await api.trips.delete("42");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/routes/42",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("setAuthToken", () => {
  it("sets Authorization header on subsequent calls", async () => {
    setAuthToken("my-token");
    mockFetch.mockResolvedValue(mockOk({ data: [] }));
    await api.locations.list();
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["Authorization"]).toBe("Bearer my-token");
  });

  it("does not send Authorization header when token is null", async () => {
    setAuthToken(null);
    mockFetch.mockResolvedValue(mockOk({ data: [] }));
    await api.locations.list();
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["Authorization"]).toBeUndefined();
  });
});
