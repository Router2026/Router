import { describe, it, expect, beforeEach } from 'vitest';
import type { TripStop } from '../api';
import {
  computeLiveState, distanceM, emptyProgress, loadProgress, markArrived, markDone, markSkipped,
  saveProgress, sunsetAt, toLiveStops, undoLast,
  clearPendingRecap, getPendingRecap, listDueRecaps, recordPendingRecap,
} from './liveTrip';

const stops = toLiveStops([
  { poi_name: 'A', arrival_time: '09:00', duration_minutes: 60, location_id: 1, latitude: 33, longitude: 35.6 },
  { poi_name: 'B', arrival_time: '10:30', duration_minutes: 90, location_id: 2, latitude: 33.1, longitude: 35.6 },
  { poi_name: 'C', arrival_time: '12:30', duration_minutes: 60, location_id: 3, latitude: 33.2, longitude: 35.6 },
] as TripStop[]);
const H = (h: number, m = 0) => h * 60 + m;
const p0 = emptyProgress('2026-11-27');

describe('computeLiveState', () => {
  it('is on time heading to the first stop before its arrival', () => {
    const s = computeLiveState(stops, p0, H(8, 30));
    expect(s.phase).toBe('enroute');
    expect(s.current?.name).toBe('A');
    expect(s.delay).toBe(0);
    expect(s.projectedEnd).toBe(H(13, 30));
  });

  it('counts lateness while still on the way', () => {
    const s = computeLiveState(stops, p0, H(9, 20));
    expect(s.delay).toBe(20);
    expect(s.projectedEnd).toBe(H(13, 50));
  });

  it('at a stop: time left and delay from the projected departure', () => {
    const p = markArrived(p0, '1', H(9, 15));
    const s = computeLiveState(stops, p, H(9, 45));
    expect(s.phase).toBe('at');
    expect(s.minutesLeftHere).toBe(30);
    expect(s.delay).toBe(15); // leaves 10:15 instead of 10:00
  });

  it('overstaying pushes the delay with the clock', () => {
    const p = markArrived(p0, '1', H(9));
    const s = computeLiveState(stops, p, H(10, 40));
    expect(s.minutesLeftHere).toBe(-40);
    expect(s.delay).toBe(40);
  });

  it('done and skipped stops move to the next one; all closed = finished', () => {
    let p = markDone(p0, '1');
    expect(computeLiveState(stops, p, H(10)).current?.name).toBe('B');
    p = markSkipped(p, '2');
    expect(computeLiveState(stops, p, H(10)).current?.name).toBe('C');
    p = markDone(p, '3');
    expect(computeLiveState(stops, p, H(14)).phase).toBe('finished');
    p = undoLast(p, stops);
    expect(computeLiveState(stops, p, H(14)).current?.name).toBe('C');
  });

  it('has no delay without a schedule', () => {
    const plain = toLiveStops([{ poi_name: 'X', arrival_time: '', duration_minutes: 30 } as TripStop]);
    const s = computeLiveState(plain, p0, H(12));
    expect(s.delay).toBeNull();
    expect(s.projectedEnd).toBeNull();
  });
});

describe('sunsetAt', () => {
  // Tel Aviv: ~16:49 UTC at the June solstice, ~14:39 UTC at the December one.
  it.each([
    [new Date(2026, 5, 21), 16 * 60 + 49],
    [new Date(2026, 11, 21), 14 * 60 + 39],
  ])('matches published times within 4 minutes (%s)', (date, utcMin) => {
    const d = sunsetAt(date, 32.08, 34.78)!;
    expect(Math.abs(d.getUTCHours() * 60 + d.getUTCMinutes() - utcMin)).toBeLessThanOrEqual(4);
  });
});

describe('progress storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips today and starts clean on another day', () => {
    saveProgress('t1', markDone(p0, '1'));
    expect(loadProgress('t1', '2026-11-27').done).toEqual(['1']);
    expect(loadProgress('t1', '2026-11-28').done).toEqual([]);
  });
});

it('distanceM: 0.1° of latitude is ~11.1km', () => {
  expect(Math.round(distanceM({ lat: 33, lng: 35.6 }, { lat: 33.1, lng: 35.6 }) / 100)).toBe(111);
});

describe('pending recaps', () => {
  beforeEach(() => localStorage.clear());
  const base = { tripId: 't1', name: 'יום בגליל', done: ['1'], finished: false };

  it('ignores a trip with nothing done', () => {
    recordPendingRecap({ ...base, date: '2026-11-27', done: [] });
    expect(getPendingRecap('t1')).toBeNull();
  });

  it('is due once finished, or from the next day, and expires after a week', () => {
    recordPendingRecap({ ...base, date: '2026-11-27' });
    expect(listDueRecaps('2026-11-27')).toHaveLength(0);
    expect(listDueRecaps('2026-11-28')).toHaveLength(1);
    expect(listDueRecaps('2026-12-10')).toHaveLength(0);
    recordPendingRecap({ ...base, date: '2026-11-27', finished: true });
    expect(listDueRecaps('2026-11-27')).toHaveLength(1);
  });

  it('clears', () => {
    recordPendingRecap({ ...base, date: '2026-11-27', finished: true });
    clearPendingRecap('t1');
    expect(listDueRecaps('2026-11-27')).toEqual([]);
  });
});
