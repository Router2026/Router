import { describe, it, expect, beforeEach } from 'vitest';
import type { Trip } from '../api';
import {
  MAX_TILES, clearSavedTrips, getSavedTrip, isTripSaved, latToTileY, listSavedTrips, lngToTileX,
  refreshSavedTrip, removeSavedTrip, tileUrl, tilesForPoints,
} from './offlineTrips';

const trip = (id: string, name = `t${id}`): Trip => ({ id, name, total_duration_hours: 5, stops: [] } as unknown as Trip);

describe('tile math', () => {
  it('matches the standard slippy-map tile for Tel Aviv at z12', () => {
    // 32.08N 34.78E → x 2443, y 1662 at zoom 12
    expect(lngToTileX(34.78, 12)).toBe(2443);
    expect(latToTileY(32.08, 12)).toBe(1662);
  });

  it('builds the Esri URL in z/y/x order', () => {
    expect(tileUrl('12/1660/2443')).toMatch(/\/tile\/12\/1660\/2443$/);
  });
});

describe('tilesForPoints', () => {
  it('returns nothing without points', () => {
    expect(tilesForPoints([])).toEqual([]);
  });

  it('covers every stop at the deepest saved zoom for a compact day', () => {
    const pts = [{ lat: 33.0, lng: 35.6 }, { lat: 33.05, lng: 35.62 }];
    const tiles = tilesForPoints(pts);
    for (const p of pts) expect(tiles).toContain(`16/${latToTileY(p.lat, 16)}/${lngToTileX(p.lng, 16)}`);
    expect(new Set(tiles).size).toBe(tiles.length);
  });

  it('stays under the cap by dropping the highest zooms for a long day', () => {
    const pts = [{ lat: 29.55, lng: 34.95 }, { lat: 33.2, lng: 35.6 }]; // Eilat → Golan
    const tiles = tilesForPoints(pts);
    expect(tiles.length).toBeLessThanOrEqual(MAX_TILES);
    expect(tiles.some(t => t.startsWith('9/'))).toBe(true);
    expect(tiles.some(t => t.startsWith('16/'))).toBe(false);
  });
});

describe('saved trip store', () => {
  beforeEach(() => localStorage.clear());

  it('lists, refreshes, removes and clears saved trips', () => {
    localStorage.setItem('router_offline_trips', JSON.stringify({
      a: { trip: trip('a'), savedAt: '2026-01-01T00:00:00Z', tiles: 3 },
      b: { trip: trip('b'), savedAt: '2026-02-01T00:00:00Z', tiles: 3 },
    }));
    expect(listSavedTrips().map(s => s.trip.id)).toEqual(['b', 'a']);

    refreshSavedTrip(trip('a', 'renamed'));
    expect(getSavedTrip('a')?.trip.name).toBe('renamed');
    refreshSavedTrip(trip('c')); // not saved → not added
    expect(isTripSaved('c')).toBe(false);

    removeSavedTrip('a');
    expect(isTripSaved('a')).toBe(false);
    clearSavedTrips();
    expect(listSavedTrips()).toEqual([]);
  });

  it('survives corrupt storage', () => {
    localStorage.setItem('router_offline_trips', '{not json');
    expect(listSavedTrips()).toEqual([]);
  });
});
