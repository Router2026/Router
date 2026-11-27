import { describe, it, expect } from 'vitest';
import type { Trip } from '../api';
import { defaultTripDate, foldLine, icsLocal, safeFileName, stopTimes, tripToGpx, tripToIcs } from './tripExport';

const trip = {
  id: '7', name: 'גליל & גולן', description: 'יום <מים>', total_duration_hours: 5,
  stops: [
    { poi_name: 'נחל עיון', arrival_time: '09:00', duration_minutes: 90, latitude: 33.25, longitude: 35.57, reason: 'בוקר, לפני החום; מים' },
    { poi_name: 'בניאס', arrival_time: '11:00', duration_minutes: 60, latitude: 33.25, longitude: 35.69 },
    { poi_name: 'בלי מיקום', arrival_time: '13:00', duration_minutes: 30 },
  ],
} as unknown as Trip;

describe('tripToGpx', () => {
  const gpx = tripToGpx(trip);
  it('has a waypoint and a route point per stop with coordinates', () => {
    expect(gpx.match(/<wpt /g)).toHaveLength(2);
    expect(gpx.match(/<rtept /g)).toHaveLength(2);
    expect(gpx).toContain('<wpt lat="33.250000" lon="35.570000">');
  });
  it('escapes XML', () => {
    expect(gpx).toContain('<name>גליל &amp; גולן</name>');
    expect(gpx).toContain('יום &lt;מים&gt;');
    expect(gpx).not.toContain('<מים>');
  });
});

describe('stopTimes', () => {
  it('uses planned times and rolls over midnight', () => {
    const t = stopTimes([
      { poi_name: 'a', arrival_time: '22:00', duration_minutes: 90 },
      { poi_name: 'b', arrival_time: '00:30', duration_minutes: 60 },
    ] as Trip['stops']);
    expect(t.map(x => [x.start, x.end])).toEqual([[1320, 1410], [1470, 1530]]);
  });
  it('chains a trip without times from 09:00 with estimated drives', () => {
    const t = stopTimes([
      { poi_name: 'a', arrival_time: '', duration_minutes: 60, latitude: 33, longitude: 35.6 },
      { poi_name: 'b', arrival_time: '', duration_minutes: 60, latitude: 33.1, longitude: 35.6 },
    ] as Trip['stops']);
    expect(t[0].start).toBe(540);
    expect(t[1].start).toBeGreaterThan(t[0].end);
  });
});

describe('tripToIcs', () => {
  const ics = tripToIcs(trip, '2026-12-03', new Date('2026-11-27T10:00:00Z'));
  it('is a valid calendar with one event per stop', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain('DTSTART:20261203T090000');
    expect(ics).toContain('DTEND:20261203T103000');
    expect(ics).toContain('DTSTAMP:20261127T100000Z');
    expect(ics).toContain('GEO:33.250000;35.570000');
  });
  it('escapes text and never has a line over 75 octets', () => {
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('DESCRIPTION:בוקר\\, לפני החום\\; מים');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

it('icsLocal crosses into the next day', () => {
  expect(icsLocal('2026-12-31', 1470)).toBe('20270101T003000');
});

it('foldLine keeps multi-byte characters whole', () => {
  const folded = foldLine('SUMMARY:' + 'א'.repeat(60));
  expect(folded.split('\r\n ').join('')).toBe('SUMMARY:' + 'א'.repeat(60));
});

it('safeFileName strips characters Windows rejects', () => {
  expect(safeFileName('גליל: יום "א"/ב', 'gpx')).toBe('גליל יום אב.gpx');
});

it('defaultTripDate: today before the first stop, tomorrow after', () => {
  expect(defaultTripDate(trip, new Date(2026, 10, 27, 7, 0))).toBe('2026-11-27');
  expect(defaultTripDate(trip, new Date(2026, 10, 27, 10, 0))).toBe('2026-11-28');
});
