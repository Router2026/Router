import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/trip-bucket/mapbox-matrix', () => ({ fetchMapboxMatrix: vi.fn(async () => null) }))

import { runPlannerAgent, selectStops, slotFor, slotOrder, visitMinutes, travelMatrix, MAX_HIKING_MINUTES, MAX_LEG_MINUTES } from './planner-agent'
import type { AssessedPlace } from './conditions-agent'
import type { PoiCandidate } from './types'

function poi(id: number, over: Partial<PoiCandidate> = {}): PoiCandidate {
  return {
    id, name: `p${id}`, category: 'אתר היסטורי', regionName: null, lat: 32.8, lng: 35.5, durationMinutes: 60,
    difficulty: 'קל', hasWater: false, hasShade: false, accessible: false, rating: 4.5, description: '',
    mainImage: null, sources: ['postgis'], ...over,
  }
}
const ok = (p: PoiCandidate): AssessedPlace => ({ place: p, weather: null, notes: [], rejected: false })

/** Uniform 20-minute drives unless overridden. */
function flatMatrix(n: number, minutes = 20) {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : minutes)))
}
const deps = (m?: number[][]) => ({ matrix: vi.fn(async (ps: PoiCandidate[]) => ({ matrix: m ?? flatMatrix(ps.length), source: 'estimate' as const })) })

describe('slotFor / visitMinutes', () => {
  it('puts hard or long hikes in the morning, water/shade at midday, viewpoints at sunset', () => {
    expect(slotFor(poi(1, { category: 'נחל', difficulty: 'מאתגר' }))).toBe('morning')
    expect(slotFor(poi(1, { category: 'מסלול', durationMinutes: 180 }))).toBe('morning')
    expect(slotFor(poi(1, { category: 'מעיין' }))).toBe('midday')
    expect(slotFor(poi(1, { category: 'מצפה' }))).toBe('sunset')
    expect(slotFor(poi(1))).toBe('afternoon')
  })

  it('clamps visit length and falls back to the category default', () => {
    expect(visitMinutes(poi(1, { durationMinutes: 5 }))).toBe(20)
    expect(visitMinutes(poi(1, { durationMinutes: 900 }))).toBe(300)
    expect(visitMinutes(poi(1, { category: 'נחל', durationMinutes: null }))).toBe(120)
  })
})

describe('selectStops', () => {
  it('respects max stops, one hard hike and the daily hiking limit', () => {
    const hard = (id: number) => poi(id, { category: 'נחל', difficulty: 'מאתגר', durationMinutes: 120 })
    const long = (id: number) => poi(id, { category: 'מסלול', durationMinutes: MAX_HIKING_MINUTES - 100 })
    const r = selectStops([hard(1), hard(2), long(3), poi(4), poi(5)].map(ok), 3)
    expect(r.chosen.map((a) => a.place.id)).toEqual([1, 4, 5])
    expect(r.dropped).toEqual([
      { place: expect.objectContaining({ id: 2 }), reason: 'second_hard_hike' },
      { place: expect.objectContaining({ id: 3 }), reason: 'hiking_limit' },
    ])
  })
})

describe('slotOrder', () => {
  it('orders by slot and uses nearest neighbour inside a slot', () => {
    // 0: afternoon, 1: morning, 2: morning (far from 1), 3: morning (near 1)
    const m = flatMatrix(4, 50)
    m[1][3] = m[3][1] = 5
    expect(slotOrder(['afternoon', 'morning', 'morning', 'morning'], m)).toEqual([1, 3, 2, 0])
  })
})

describe('runPlannerAgent', () => {
  const intent = { start_time: '08:00', max_stops: 4 }

  it('builds a hike → spring → site → sunset day with drive times', async () => {
    const places = [poi(1, { category: 'מצפה', durationMinutes: 30 }), poi(2, { category: 'מעיין' }), poi(3, { category: 'נחל', difficulty: 'מאתגר', durationMinutes: 120 }), poi(4)]
    const plan = await runPlannerAgent({ intent, places: places.map(ok), sunset: '16:40' }, deps())
    expect(plan.stops.map((s) => [s.place.id, s.slot, s.arrivalTime])).toEqual([
      [3, 'morning', '08:00'],
      [2, 'midday', '10:20'],
      [4, 'afternoon', '11:40'],
      [1, 'afternoon', '13:00'], // sunset is >90 min away: no pointless wait, it becomes a normal stop
    ])
    expect(plan.stops[3].waitMinutes).toBe(0)
    expect(plan.totalDriveMinutes).toBe(60)
    expect(plan.totalHikingMinutes).toBe(120)
  })

  it('drops a hike that would start too close to dark, but keeps a later short viewpoint', async () => {
    const places = [poi(1, { durationMinutes: 300 }), poi(2, { durationMinutes: 200 }), poi(3, { category: 'מסלול', durationMinutes: 60 }), poi(4, { category: 'מצפה', durationMinutes: 30 })]
    const plan = await runPlannerAgent({ intent: { start_time: '07:00', max_stops: 4 }, places: places.map(ok), sunset: '16:40' }, deps())
    expect(plan.stops.map((s) => s.place.id)).toEqual([3, 1, 4])
    expect(plan.dropped.map((d) => [d.place.id, d.reason])).toEqual([[2, 'day_full']])
  })

  it('waits for sunset when the gap is short', async () => {
    const places = [poi(1, { category: 'מצפה', durationMinutes: 30 }), poi(2, { durationMinutes: 300 })]
    const plan = await runPlannerAgent({ intent: { start_time: '09:00', max_stops: 4 }, places: places.map(ok), sunset: '16:40' }, deps())
    // site 09:00-14:00, drive 20 → 14:20, wait 80 → 15:40
    expect(plan.stops.map((s) => [s.place.id, s.slot, s.arrivalTime, s.waitMinutes])).toEqual([[2, 'afternoon', '09:00', 0], [1, 'sunset', '15:40', 80]])
  })

  it('stays at the sunset spot until sunset, not just the usual visit length', async () => {
    const places = [poi(1, { category: 'מצפה', durationMinutes: 20 }), poi(2, { durationMinutes: 300 })]
    const plan = await runPlannerAgent({ intent: { start_time: '09:00', max_stops: 4 }, places: places.map(ok), sunset: '16:40' }, deps())
    const sunsetStop = plan.stops.find((s) => s.slot === 'sunset')!
    expect([sunsetStop.arrivalTime, sunsetStop.departureTime, sunsetStop.visitMinutes]).toEqual(['15:40', '16:40', 60])
    expect(plan.endTime).toBe('16:40')
  })

  it('switches to the shortest order (sunset still last) when time-of-day order backtracks', async () => {
    // 0 = hard hike (morning), 1 and 2 = sites (afternoon), 3 = viewpoint (sunset).
    // time-of-day: hike → site2 → site1 → viewpoint = 10 + 10 + 45 = 65
    // shortest with the viewpoint last: site1 → site2 → hike → viewpoint = 10 + 10 + 10 = 30 (no leg over 30)
    const m = [
      [0, 30, 10, 10],
      [30, 0, 10, 45],
      [10, 10, 0, 20],
      [10, 45, 20, 0],
    ]
    const places = [
      poi(1, { category: 'נחל', difficulty: 'מאתגר', durationMinutes: 60 }),
      poi(2, { durationMinutes: 30 }), poi(3, { durationMinutes: 30 }),
      poi(4, { category: 'מצפה', durationMinutes: 30 }),
    ]
    const plan = await runPlannerAgent({ intent, places: places.map(ok), sunset: '18:00' }, deps(m))
    expect(plan.orderStrategy).toBe('shortest_drive')
    expect(plan.stops.map((s) => s.place.id)).toEqual([2, 3, 1, 4])
    expect(plan.totalDriveMinutes).toBe(30)

    const near = [[0, 10, 5, 5], [10, 0, 10, 10], [5, 10, 0, 5], [5, 10, 5, 0]]
    expect((await runPlannerAgent({ intent, places: places.map(ok), sunset: '18:00' }, deps(near))).orderStrategy).toBe('time_of_day')
  })

  it('keeps the day inside one area: a place over MAX_LEG_MINUTES from every chosen stop is dropped as too_far', async () => {
    // 0 and 1 are close (15 min); 2 is 68 min from both (the Banias → far-away-spring case).
    const m = [[0, 15, 68], [15, 0, 68], [68, 68, 0]]
    const places = [poi(1), poi(2), poi(3, { category: 'מעיין', durationMinutes: 45 })]
    const plan = await runPlannerAgent({ intent, places: places.map(ok), sunset: '16:40' }, deps(m))
    expect(plan.stops.map((s) => s.place.id).sort()).toEqual([1, 2])
    expect(plan.dropped).toEqual([{ place: expect.objectContaining({ id: 3 }), reason: 'too_far' }])
    expect(plan.stops.every((s) => s.driveMinutesFromPrev <= MAX_LEG_MINUTES)).toBe(true)
  })

  it('drops the lower-priority stop when the final order still has a leg over the limit', async () => {
    // 0–1 = 25 and 1–2 = 25 keep all three in one cluster, but 0–2 = 50.
    // Slots: 0 morning hike, 2 afternoon, 1 sunset viewpoint → order 0 → 2 → 1 has a 50-min leg.
    const m = [[0, 25, 50], [25, 0, 25], [50, 25, 0]]
    const places = [poi(1, { category: 'נחל', difficulty: 'מאתגר', durationMinutes: 60 }), poi(2, { category: 'מצפה', durationMinutes: 30 }), poi(3, { durationMinutes: 30 })]
    const plan = await runPlannerAgent({ intent: { start_time: '12:00', max_stops: 4 }, places: places.map(ok), sunset: '18:00' }, deps(m))
    expect(plan.stops.every((s) => s.driveMinutesFromPrev <= MAX_LEG_MINUTES)).toBe(true)
    expect(plan.dropped.map((d) => [d.place.id, d.reason])).toEqual([[3, 'too_far']])
  })

  it('never drops for distance in a user-picked list (Trip Bucket)', async () => {
    const m = [[0, 68], [68, 0]]
    const plan = await runPlannerAgent({ intent, places: [poi(1), poi(2)].map(ok), sunset: '16:40', respectSelection: true }, deps(m))
    expect(plan.stops).toHaveLength(2)
    expect(plan.stops[1].driveMinutesFromPrev).toBe(68)
  })

  it('does not use a far spare to fill the day', async () => {
    const m = [[0, 10, 80], [10, 0, 80], [80, 80, 0]]
    const plan = await runPlannerAgent({ intent, places: [poi(1), poi(2)].map(ok), spares: [poi(9)].map(ok), sunset: '16:40' }, deps(m))
    expect(plan.stops.map((s) => s.place.id).sort()).toEqual([1, 2])
    expect(plan.dropped).toEqual([]) // spares are skipped silently
  })

  it('fills free stops from spares under the same rules, after the shortlist', async () => {
    const hard = (id: number) => poi(id, { category: 'נחל', difficulty: 'מאתגר', durationMinutes: 120 })
    const plan = await runPlannerAgent({
      intent: { start_time: '07:00', max_stops: 3 },
      places: [hard(1), hard(2)].map(ok),
      spares: [hard(3), poi(4, { category: 'מצפה', durationMinutes: 30 }), poi(5), poi(6)].map(ok),
      sunset: '16:40',
    }, deps())
    expect(plan.stops.map((s) => s.place.id).sort()).toEqual([1, 4, 5])
    expect(plan.dropped.map((d) => d.place.id)).toEqual([2]) // spares that didn't fit aren't reported
  })

  it('keeps only one sunset slot', async () => {
    const places = [poi(1, { category: 'מצפה', durationMinutes: 30 }), poi(2, { category: 'נוף', durationMinutes: 30 })]
    const plan = await runPlannerAgent({ intent: { start_time: '14:00', max_stops: 4 }, places: places.map(ok), sunset: '16:40' }, deps())
    expect(plan.stops.map((s) => s.slot).sort()).toEqual(['afternoon', 'sunset'])
  })
})

describe('travelMatrix', () => {
  it('estimates drive minutes from distance when Mapbox is unavailable', async () => {
    const r = await travelMatrix([poi(1, { lat: 32.8, lng: 35.5 }), poi(2, { lat: 32.9, lng: 35.5 })])
    expect(r.source).toBe('estimate')
    expect(r.matrix[0][1]).toBeGreaterThan(10)
    expect(r.matrix[0][0]).toBe(0)
  })
})
