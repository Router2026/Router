import { describe, it, expect } from 'vitest'
import { buildRouteStops, routeBoundsPoints, routeLengthKm } from './routeGeometry'
import type { POI } from '../api'

const item = (id: string, lat: unknown, lng: unknown) => ({
  poi: { id, name: id, latitude: lat, longitude: lng } as unknown as POI,
  addedAt: 0,
})

describe('routeGeometry', () => {
  it('numbers stops in bucket order and skips invalid coordinates', () => {
    const stops = buildRouteStops([item('a', 32.1, 35.1), item('bad', 0, 0), item('nan', 'x', 35), item('b', '31.5', '34.9')])
    expect(stops.map(s => [s.poi.id, s.index, s.lat, s.lng])).toEqual([['a', 1, 32.1, 35.1], ['b', 2, 31.5, 34.9]])
  })

  it('includes the user location first in the bounds only when there are stops', () => {
    const stops = buildRouteStops([item('a', 32, 35)])
    expect(routeBoundsPoints(stops, { lat: 31, lng: 34 })).toEqual([[31, 34], [32, 35]])
    expect(routeBoundsPoints([], { lat: 31, lng: 34 })).toEqual([])
  })

  it('sums straight-line distance along the route', () => {
    // Jerusalem → Tel Aviv ≈ 54 km
    const stops = buildRouteStops([item('j', 31.7683, 35.2137), item('t', 32.0853, 34.7818)])
    expect(routeLengthKm(stops, null)).toBeGreaterThan(50)
    expect(routeLengthKm(stops, null)).toBeLessThan(58)
    expect(routeLengthKm(buildRouteStops([item('a', 32, 35)]), null)).toBe(0)
  })
})
