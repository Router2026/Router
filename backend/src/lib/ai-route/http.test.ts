import { describe, it, expect } from "vitest";
import { parseRouteRequest, toApiRoute, type ParsedRouteRequest } from "./http";
import type { PlannedRoute } from "./generate";
import { makeCandidate } from "./test-fixtures";

describe("parseRouteRequest", () => {
  const base = { region: "גולן", groupType: "family" };

  it("applies defaults and filters unknown styles", () => {
    const res = parseRouteRequest({ ...base, styles: ["water", "bogus", "water"] });
    expect(res).toEqual({
      ok: true,
      value: { region: "גולן", groupType: "family", styles: ["water"], dayStart: "09:00", dayEnd: "16:00", start: null, maxStops: null },
    });
  });

  it("accepts an optional maxStops within 2-7", () => {
    const res = parseRouteRequest({ ...base, maxStops: 5 });
    expect(res.ok && res.value.maxStops).toBe(5);
    expect(parseRouteRequest({ ...base, maxStops: 9 }).ok).toBe(false);
    expect(parseRouteRequest({ ...base, maxStops: 1 }).ok).toBe(false);
  });

  it("normalizes times and keeps the user location", () => {
    const res = parseRouteRequest({ ...base, startTime: "8:30", endTime: "17:00", userLocation: { lat: 32.1, lng: 34.8 } });
    expect(res.ok && res.value).toMatchObject({ dayStart: "08:30", dayEnd: "17:00", start: { lat: 32.1, lng: 34.8 } });
  });

  it("accepts legacy includeFood/includeCoffee flags", () => {
    expect(parseRouteRequest({ ...base, includeFood: true, includeCoffee: false }).ok).toBe(true);
  });

  it.each([
    [{ groupType: "family" }, "region"],
    [{ ...base, groupType: "aliens" }, "groupType"],
    [{ ...base, startTime: "25:00" }, "startTime"],
    [{ ...base, userLocation: { lat: 200, lng: 0 } }, "userLocation.lat"],
    [{ ...base, region: "x".repeat(101) }, "region"],
  ])("rejects invalid input %#", (body, field) => {
    const res = parseRouteRequest(body);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toContain(field);
  });

  it("rejects non-object bodies", () => {
    expect(parseRouteRequest(null).ok).toBe(false);
    expect(parseRouteRequest("hi").ok).toBe(false);
  });

  it("rejects a window shorter than an hour or reversed", () => {
    expect(parseRouteRequest({ ...base, startTime: "10:00", endTime: "10:30" }).ok).toBe(false);
    expect(parseRouteRequest({ ...base, startTime: "16:00", endTime: "09:00" }).ok).toBe(false);
  });
});

describe("toApiRoute", () => {
  const req: ParsedRouteRequest = {
    region: "גולן", groupType: "couple", styles: ["water", "photo"], dayStart: "09:00", dayEnd: "16:00", start: null, maxStops: null,
  };
  const c = makeCandidate({ key: "L1", locationId: 55, name: "בניאס", category: "מעיין", lat: 33.24, lng: 35.69, mainImage: "img.jpg" });
  const route: PlannedRoute = {
    title: "יום מים", source: "ai",
    stops: [{
      candidate: c, reasoning: "", visitMinutes: 90, orderIndex: 0,
      arrivalTime: "09:00", departureTime: "10:30", driveMinutesFromPrev: 0, distanceFromPrevKm: 0,
    }],
    totalDriveMinutes: 0, totalDistanceKm: 0, endTime: "10:30",
    diagnostics: {} as PlannedRoute["diagnostics"],
  };

  it("maps every stop field from DB data and includes location_id", () => {
    const api = toApiRoute(route, req, { id: 4, name: "גולן" });
    expect(api.stops[0]).toEqual({
      location_id: 55, poi_name: "בניאס", category: "מעיין", latitude: 33.24, longitude: 35.69,
      main_image: "img.jpg", order_index: 0, arrival_time: "09:00", departure_time: "10:30",
      duration_minutes: 90, drive_minutes_from_prev: 0, distance_from_prev_km: 0,
      smart_insight: "עצירה מרעננת ליד המים, מתאימה למנוחה ולטבילה.",
    });
  });

  it("builds Hebrew metadata and totals", () => {
    const api = toApiRoute(route, req, { id: 4, name: "גולן" });
    expect(api).toMatchObject({
      name: "יום מים", region: "גולן", region_id: 4, group_type: "couple",
      style: "מים, צילום", source: "ai", total_duration_hours: 1.5, end_time: "10:30",
    });
    expect(api.description).toContain("זוג");
  });
});
