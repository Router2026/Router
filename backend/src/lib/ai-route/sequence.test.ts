import { describe, it, expect } from "vitest";
import {
  haversineMeters, estimateDriveMinutes, orderPoints, orderStops, pathLength,
  parseTime, formatTime, buildSchedule, LEG_OVERHEAD_MINUTES,
} from "./sequence";
import { makeCandidate, makeStop } from "./test-fixtures";

describe("haversineMeters", () => {
  it("is zero for the same point and ~111km per degree of latitude", () => {
    expect(haversineMeters({ lat: 32, lng: 35 }, { lat: 32, lng: 35 })).toBe(0);
    const d = haversineMeters({ lat: 32, lng: 35 }, { lat: 33, lng: 35 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("matches a known distance (Tel Aviv -> Jerusalem ~54km)", () => {
    const d = haversineMeters({ lat: 32.0853, lng: 34.7818 }, { lat: 31.7683, lng: 35.2137 });
    expect(d / 1000).toBeGreaterThan(50);
    expect(d / 1000).toBeLessThan(58);
  });
});

describe("estimateDriveMinutes", () => {
  it("returns 0 for no distance and adds overhead otherwise", () => {
    expect(estimateDriveMinutes(0)).toBe(0);
    // 10km straight -> 13km road at 60km/h = 13min + overhead
    expect(estimateDriveMinutes(10_000)).toBe(13 + LEG_OVERHEAD_MINUTES);
  });
});

describe("orderPoints", () => {
  // Points on a line, given in scrambled order.
  const line = [
    { lat: 33.0, lng: 35.0 }, // 0
    { lat: 33.3, lng: 35.0 }, // 1
    { lat: 33.1, lng: 35.0 }, // 2
    { lat: 33.4, lng: 35.0 }, // 3
    { lat: 33.2, lng: 35.0 }, // 4
  ];

  it("handles trivial inputs", () => {
    expect(orderPoints([])).toEqual([]);
    expect(orderPoints([{ lat: 1, lng: 1 }])).toEqual([0]);
  });

  it("finds the straight-line order without an origin", () => {
    const order = orderPoints(line);
    const lats = order.map((i) => line[i].lat);
    const asc = [...lats].sort((a, b) => a - b);
    expect(lats.join() === asc.join() || lats.join() === [...asc].reverse().join()).toBe(true);
  });

  it("starts from the point nearest to the origin", () => {
    const order = orderPoints(line, { origin: { lat: 33.5, lng: 35.0 } });
    expect(order.map((i) => line[i].lat)).toEqual([33.4, 33.3, 33.2, 33.1, 33.0]);
  });

  it("is never longer than the input order", () => {
    const pts = [
      { lat: 32.9, lng: 35.6 }, { lat: 33.2, lng: 35.5 }, { lat: 32.8, lng: 35.4 },
      { lat: 33.1, lng: 35.7 }, { lat: 33.0, lng: 35.45 }, { lat: 32.95, lng: 35.75 },
    ];
    const identity = pts.map((_, i) => i);
    const opts = { origin: { lat: 32.7, lng: 35.3 }, roundTrip: true };
    expect(pathLength(pts, orderPoints(pts, opts), opts)).toBeLessThanOrEqual(pathLength(pts, identity, opts));
  });

  it("returns a permutation of all indices", () => {
    const order = orderPoints(line, { origin: { lat: 32, lng: 35 } });
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("orderStops", () => {
  it("reorders stop objects by geography", () => {
    const far = makeStop(makeCandidate({ key: "L1", locationId: 1, lat: 33.5, lng: 35 }));
    const near = makeStop(makeCandidate({ key: "L2", locationId: 2, lat: 33.0, lng: 35 }));
    const ordered = orderStops([far, near], { origin: { lat: 32.9, lng: 35 } });
    expect(ordered.map((s) => s.candidate.key)).toEqual(["L2", "L1"]);
  });
});

describe("parseTime / formatTime", () => {
  it("round-trips valid times", () => {
    expect(parseTime("09:05")).toBe(545);
    expect(parseTime("9:05")).toBe(545);
    expect(formatTime(545)).toBe("09:05");
  });

  it("rejects invalid input", () => {
    expect(() => parseTime("24:00")).toThrow();
    expect(() => parseTime("9am")).toThrow();
    expect(() => parseTime("12:60")).toThrow();
  });

  it("clamps formatTime to the same day", () => {
    expect(formatTime(-10)).toBe("00:00");
    expect(formatTime(2000)).toBe("23:59");
  });
});

describe("buildSchedule", () => {
  const a = makeCandidate({ key: "L1", locationId: 1, lat: 33.0, lng: 35.5 });
  const b = makeCandidate({ key: "L2", locationId: 2, lat: 33.1, lng: 35.5 }); // ~11km from a
  const c = makeCandidate({ key: "L3", locationId: 3, lat: 33.2, lng: 35.5 });

  it("starts at dayStart without an origin and adds drive time between stops", () => {
    const s = buildSchedule([makeStop(a, 60), makeStop(b, 60)], { dayStart: "09:00", dayEnd: "17:00" });
    expect(s.stops[0]).toMatchObject({ orderIndex: 0, arrivalTime: "09:00", departureTime: "10:00", driveMinutesFromPrev: 0 });
    const drive = s.stops[1].driveMinutesFromPrev;
    expect(drive).toBeGreaterThan(LEG_OVERHEAD_MINUTES);
    expect(parseTime(s.stops[1].arrivalTime)).toBe(600 + drive);
    expect(s.totalDistanceKm).toBeGreaterThan(14);
    expect(s.dropped).toHaveLength(0);
  });

  it("includes the drive from the origin to the first stop", () => {
    const s = buildSchedule([makeStop(a)], { dayStart: "09:00", dayEnd: "17:00", origin: { lat: 32.9, lng: 35.5 } });
    expect(s.stops[0].driveMinutesFromPrev).toBeGreaterThan(0);
    expect(s.stops[0].arrivalTime).not.toBe("09:00");
  });

  it("drops trailing stops that do not fit, but always keeps the first", () => {
    const s = buildSchedule([makeStop(a, 120), makeStop(b, 120), makeStop(c, 120)], { dayStart: "09:00", dayEnd: "12:00" });
    expect(s.stops.map((x) => x.candidate.key)).toEqual(["L1"]);
    expect(s.dropped.map((x) => x.candidate.key)).toEqual(["L2", "L3"]);

    const tiny = buildSchedule([makeStop(a, 300)], { dayStart: "09:00", dayEnd: "10:00" });
    expect(tiny.stops).toHaveLength(1);
  });

  it("reserves time for the drive home when returnToOrigin is set", () => {
    const origin = { lat: 32.0, lng: 34.8 }; // far away (~130km)
    const stops = [makeStop(a, 60), makeStop(b, 60)];
    const opts = { dayStart: "08:00", dayEnd: "13:30", origin };
    expect(buildSchedule(stops, opts).stops).toHaveLength(2);
    expect(buildSchedule(stops, { ...opts, returnToOrigin: true }).stops).toHaveLength(1);
  });

  it("rejects an end time before the start time", () => {
    expect(() => buildSchedule([], { dayStart: "16:00", dayEnd: "09:00" })).toThrow();
  });
});
