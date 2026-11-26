import { describe, it, expect } from 'vitest';
import type { POI } from '../api';
import { buildSchedule, estimateDriveMinutes, fromMinutes, googleMapsRouteUrl, type PlanMeta } from './routeSchedule';

const poi = (id: string, lat: number, lng: number, duration = 60): POI => ({
  id, name: `p${id}`, description: '', category: 'נחל', region: 'גליל עליון', latitude: lat, longitude: lng,
  images: [], main_image: '', thumbnail: '', difficulty: 'קל', has_water: false, has_shade: false, accessible: false,
  average_rating: 0, duration_minutes: duration,
} as POI);

describe('buildSchedule', () => {
  const pois = [poi('1', 33.0, 35.6, 90), poi('2', 33.1, 35.6, 45)];
  const plan: PlanMeta = {
    why: 'w', total_drive_minutes: 15,
    stops: [
      { location_id: '1', poi_name: 'p1', arrival_time: '08:30', departure_time: '10:00', duration_minutes: 90, reason: 'בבוקר', smart_insight: 'נעליים' },
      { location_id: '2', poi_name: 'p2', arrival_time: '10:15', duration_minutes: 45, drive_minutes_from_prev: 15 },
    ],
  };

  it("uses the agents' times, reasons and tips when the plan covers these stops", () => {
    const s = buildSchedule(pois, plan, null);
    expect(s.planned).toBe(true);
    expect(s.stops.map(x => [x.arrival, x.departure, x.reason, x.tip])).toEqual([
      ['08:30', '10:00', 'בבוקר', 'נעליים'],
      ['10:15', '11:00', null, null],
    ]);
    expect([s.startTime, s.endTime, s.driveMinutes]).toEqual(['08:30', '11:00', 15]);
  });

  it('estimates times when there is no plan, or the stops no longer match it', () => {
    for (const s of [buildSchedule(pois, null, null), buildSchedule([pois[1], pois[0]], { ...plan, stops: plan.stops.slice(0, 1) }, null)]) {
      expect(s.planned).toBe(false);
      expect(s.stops[0].arrival).toBe('09:00');
      expect(s.stops.every(x => x.reason === null)).toBe(true);
    }
    const s = buildSchedule(pois, null, null);
    // 0.1° lat ≈ 11.1 km × 1.3 road / 50 km/h ≈ 17 min → 15 (rounded to 5)
    expect(s.stops[1].driveMinutesFromPrev).toBe(15);
    expect(s.stops[1].arrival).toBe('10:45');
  });

  it('adds the drive from the start point', () => {
    const s = buildSchedule(pois, null, { lat: 32.9, lng: 35.6 });
    expect(s.stops[0].driveMinutesFromPrev).toBeGreaterThan(0);
    expect(s.stops[0].arrival).not.toBe('09:00');
  });
});

describe('helpers', () => {
  it('formats and estimates', () => {
    expect(fromMinutes(9 * 60 + 5)).toBe('09:05');
    expect(estimateDriveMinutes(0)).toBe(0);
  });

  it('builds a Google Maps route with waypoints', () => {
    const url = googleMapsRouteUrl([{ lat: 33, lng: 35.6 }, { lat: 33.1, lng: 35.7 }], { lat: 32.8, lng: 35.5 })!;
    const qs = new URL(url).searchParams;
    expect(qs.get('origin')).toBe('32.800000,35.500000');
    expect(qs.get('destination')).toBe('33.100000,35.700000');
    expect(qs.get('waypoints')).toBe('33.000000,35.600000');
    expect(googleMapsRouteUrl([])).toBeNull();
  });
});
