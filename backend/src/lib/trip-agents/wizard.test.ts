/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/db/raw-client', () => ({ rawDb: { query: vi.fn() } }))
vi.mock('@/lib/trip-bucket/mapbox-matrix', () => ({ fetchMapboxMatrix: vi.fn(async () => null) }))
vi.mock('@/lib/trip-agents/pipeline', () => ({ runTripPipelineFromIntent: vi.fn() }))

import { wizardIntent, wizardRequestText, stopsForWindow, agentsToApiRoute } from './wizard'
import { planWithAgents, routePlanner, AgentsTimeoutError } from './wizard-planner'
import { runTripPipelineFromIntent } from './pipeline'
import { runPlannerAgent } from './planner-agent'
import type { ParsedRouteRequest } from '@/lib/ai-route/http'
import type { AssessedPlace } from './conditions-agent'
import type { PoiCandidate } from './types'

const REQ: ParsedRouteRequest = {
  region: 'גולן', groupType: 'family', styles: ['water', 'nature'], dayStart: '09:00', dayEnd: '15:00',
  start: { lat: 32.08, lng: 34.78 }, maxStops: null,
}
const NOW = new Date('2026-11-26T06:00:00Z')

function poi(id: number, over: Partial<PoiCandidate> = {}): PoiCandidate {
  return {
    id, name: `p${id}`, category: 'אתר היסטורי', regionName: 'גולן', lat: 32.9, lng: 35.7, durationMinutes: 60,
    difficulty: 'קל', hasWater: false, hasShade: false, accessible: false, rating: 4.5, description: '',
    mainImage: 'img.jpg', sources: ['postgis'], ...over,
  }
}
const ok = (p: PoiCandidate): AssessedPlace => ({ place: p, weather: null, notes: [], rejected: false })
const flat = (n = 20) => ({ matrix: vi.fn(async (ps: unknown[]) => ({ matrix: ps.map((_, i) => ps.map((__, j) => (i === j ? 0 : n))), source: 'estimate' as const })) })

afterEach(() => { delete process.env.ROUTE_PLANNER })

describe('wizardIntent', () => {
  it('maps the form to an intent: region, styles, family → easy, hours, start point', () => {
    const i = wizardIntent(REQ, 'golan_hermon', NOW)
    expect(i).toMatchObject({
      regions: ['golan_hermon'], styles: ['water', 'nature'], difficulty: 'easy', needs_water: true,
      date: '2026-11-26', start_time: '09:00', end_time: '15:00', origin: REQ.start, anchor: null, language: 'he',
    })
    expect(i.search_query_he).toContain('מעיינות')
    expect(i.search_query_he).toContain('משפחות')
    expect(wizardIntent({ ...REQ, groupType: 'friends', styles: [] }, 'golan_hermon', NOW)).toMatchObject({ difficulty: 'any', needs_water: false })
  })

  it('sizes the day by the time window, capped by the form', () => {
    expect(stopsForWindow('09:00', '15:00', null)).toBe(3)
    expect(stopsForWindow('08:00', '18:00', null)).toBe(6)
    expect(stopsForWindow('08:00', '18:00', 2)).toBe(2)
    expect(stopsForWindow('09:00', '10:00', null)).toBe(2)
  })

  it('describes the request in Hebrew for agents 5 and 6', () => {
    const t = wizardRequestText(REQ, 'רמת הגולן')
    expect(t).toContain('רמת הגולן')
    expect(t).toContain('משפחה')
    expect(t).toContain('בין 09:00 ל-15:00')
  })
})

describe('agentsToApiRoute', () => {
  it('keeps the route planner response shape, with agent-5 tips as smart_insight', async () => {
    const plan = await runPlannerAgent({ intent: { start_time: '09:00', max_stops: 3 }, places: [poi(1), poi(2)].map(ok), sunset: '16:40' }, flat())
    const r = agentsToApiRoute({ plan, summary: { title: 'יום', overview: 'תכננתי לך יום', whyThisRoute: '', tips: { 1: 'טיפ' }, conditionsNote: null, safetyFooter: 'f' } } as any, REQ, { id: 3, name: 'גולן' })
    expect(r).toMatchObject({ name: 'יום', description: 'תכננתי לך יום', region_id: 3, source: 'ai', start_time: '09:00', group_type: 'family' })
    expect(r.stops[0]).toMatchObject({ order_index: 0, main_image: 'img.jpg' })
    expect(r.stops.find((s) => s.location_id === 1)!.smart_insight).toBe('טיפ')
    expect(r.stops.find((s) => s.location_id === 2)!.smart_insight).toBe('')
  })
})

describe('planWithAgents / routePlanner', () => {
  it('defaults to the agents; ROUTE_PLANNER=groq switches back', () => {
    expect(routePlanner()).toBe('agents')
    process.env.ROUTE_PLANNER = 'Groq '
    expect(routePlanner()).toBe('groq')
  })

  it('returns null when the agents found fewer than 2 stops', async () => {
    (runTripPipelineFromIntent as any).mockResolvedValue({ plan: { stops: [{}] } })
    expect(await planWithAgents(REQ, { id: 3, name: 'גולן', slug: 'golan_hermon' })).toBeNull()
  })

  it('gives up after the time budget so the Groq backup still fits in the request', async () => {
    (runTripPipelineFromIntent as any).mockImplementation(() => new Promise(() => {}))
    await expect(planWithAgents(REQ, { id: 3, name: 'גולן', slug: 'golan_hermon' }, 20)).rejects.toBeInstanceOf(AgentsTimeoutError)
  })
})

describe('planner: end time and start point', () => {
  it('ends the day by the form end time (before dark) and reports past_end_time', async () => {
    const places = [poi(1, { durationMinutes: 120 }), poi(2, { durationMinutes: 120 }), poi(3, { durationMinutes: 120 })]
    const plan = await runPlannerAgent({ intent: { start_time: '09:00', end_time: '13:00', max_stops: 3 }, places: places.map(ok), sunset: '16:40' }, flat())
    expect(plan.stops).toHaveLength(1)
    expect(plan.dropped.map((d) => d.reason)).toEqual(['past_end_time', 'past_end_time'])
  })

  it('adds the drive from the start point and starts with the stop nearest to it', async () => {
    const near = poi(1, { lat: 32.1, lng: 34.8 })   // next to the start point
    const far = poi(2, { lat: 32.9, lng: 35.7 })    // ~2 h away
    const plan = await runPlannerAgent({
      intent: { start_time: '08:00', max_stops: 2, origin: { lat: 32.08, lng: 34.78 } },
      places: [far, near].map(ok), sunset: '16:40', respectSelection: true,
    }, flat())
    expect(plan.stops[0].place.id).toBe(1)
    expect(plan.stops[0].driveMinutesFromPrev).toBeGreaterThan(0)
    expect(plan.stops[0].arrivalTime).not.toBe('08:00')
    expect(plan.totalDriveMinutes).toBeGreaterThan(20)
  })
})

describe('planner: leg limit after a scheduling drop', () => {
  it('does not let a dropped middle stop leave two far-apart stops next to each other', async () => {
    // A–B 20, B–C 20, A–C 47. B is dropped by the end time, which would make A→C a 47-min leg.
    const m = [[0, 20, 47], [20, 0, 20], [47, 20, 0]]
    const places = [poi(1, { durationMinutes: 60 }), poi(2, { durationMinutes: 240 }), poi(3, { durationMinutes: 30 })]
    const plan = await runPlannerAgent({ intent: { start_time: '09:00', end_time: '13:00', max_stops: 3 }, places: places.map(ok), sunset: '16:40' },
      { matrix: vi.fn(async () => ({ matrix: m, source: 'estimate' as const })) })
    expect(plan.stops.every((s, i) => i === 0 || s.driveMinutesFromPrev <= 30)).toBe(true)
    expect(plan.dropped.map((d) => d.reason)).toContain('too_far')
  })
})
