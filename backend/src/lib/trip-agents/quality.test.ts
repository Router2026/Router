/* eslint-disable @typescript-eslint/no-explicit-any */
// Tests for the route-quality fixes: leg limit, seasonal water, tip wording.
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db/raw-client', () => ({ rawDb: { query: vi.fn() } }))
vi.mock('@/lib/trip-bucket/mapbox-matrix', () => ({ fetchMapboxMatrix: vi.fn(async () => null) }))

import { checkPlan } from './review-agent'
import { runPlannerAgent, MAX_LEG_MINUTES } from './planner-agent'
import { runBucketPipeline } from './bucket'
import { withoutClockTimes, withoutPlaceholderDots, buildSummaryPrompt, runSummaryAgent } from './summary-agent'
import { executeSearchTool, CandidatePool, wantsWater } from './search-agent'
import type { AssessedPlace } from './conditions-agent'
import type { TripIntent } from './intent-agent'
import type { PoiCandidate } from './types'
import type { BucketPoi } from '@/lib/trip-bucket/types'

function poi(id: number, over: Partial<PoiCandidate> = {}): PoiCandidate {
  return {
    id, name: `p${id}`, category: 'אתר היסטורי', regionName: 'גליל', lat: 32.8, lng: 35.5, durationMinutes: 60,
    difficulty: 'קל', hasWater: false, hasShade: false, accessible: false, rating: 4.5, description: '',
    mainImage: null, sources: ['postgis'], ...over,
  }
}
const ok = (p: PoiCandidate): AssessedPlace => ({ place: p, weather: null, notes: [], rejected: false })
const INTENT: TripIntent = {
  regions: ['galil_u'], styles: ['water'], difficulty: 'any', needs_water: true, needs_shade: false, needs_accessible: false,
  date: '2026-11-25', start_time: '08:00', max_stops: 3, anchor: null, search_query_he: 'מים', language: 'he',
}
const matrixDeps = (m: number[][]) => ({ matrix: vi.fn(async () => ({ matrix: m, source: 'estimate' as const })) })

describe('leg limit', () => {
  it('agent 6 flags a leg over MAX_LEG_MINUTES', async () => {
    const plan = await runPlannerAgent({ intent: INTENT, places: [poi(1, { hasWater: true }), poi(2)].map(ok), sunset: '16:40', respectSelection: true }, matrixDeps([[0, 68], [68, 0]]))
    expect(checkPlan(plan, INTENT).map((i) => i.code)).toContain('long_leg')
  })

  it('Trip Bucket keeps a far picked place but warns about the long drive', async () => {
    const bp = (id: number, lat: number): BucketPoi => ({ id: String(id), name: `מקום ${id}`, description: '', category: 'אתר היסטורי', region: '', latitude: lat, longitude: 35.5, duration_minutes: 45, difficulty: 'קל', has_water: false, has_shade: false, accessible: false, average_rating: 4 })
    const sunny = vi.fn(async (pts: unknown[]) => pts.map(() => ({ tempMaxC: 20, precipMm: 0, precipProb: 0, gustsKmh: 5, prevPrecipMm: 0, sunrise: '06:15', sunset: '16:40' })))
    const parse = vi.fn(async () => { throw new Error('skip model') })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await runBucketPipeline([bp(1, 33.25), bp(2, 32.7)], {
      now: new Date('2026-11-25T06:00:00Z'), fetchWeather: sunny, planner: matrixDeps([[0, 68], [68, 0]]),
      summary: { client: { messages: { parse } } as never, model: 'm' },
    })
    expect(r.plan.stops).toHaveLength(2)
    expect(r.warnings.some((w) => w.includes('הנסיעה אל') && w.includes('68'))).toBe(true)
    expect(MAX_LEG_MINUTES).toBe(30)
  })
})

describe('seasonal water', () => {
  it('water requests never let seasonal (dry most of the year) places into the pool', async () => {
    const deps = {
      postgis: vi.fn(async () => [poi(1, { category: 'מעיין', hasWater: true }), poi(2, { category: 'מעיין', hasWater: false, waterSeasonal: true, name: 'עינות אט' })]),
      semantic: vi.fn(async () => []),
    }
    const pool = new CandidatePool()
    const out: any = await executeSearchTool('postgis_search', { regions: ['galil_u'], categories: [], difficulty: 'any' }, pool, deps, null, { excludeSeasonalWater: true })
    expect(out.places.map((p: any) => p.id)).toEqual([1])
    expect(pool.byId.has(2)).toBe(false)

    const pool2 = new CandidatePool()
    await executeSearchTool('postgis_search', { regions: ['galil_u'], categories: [], difficulty: 'any' }, pool2, deps)
    expect(pool2.byId.has(2)).toBe(true) // other requests may still include it (without a water tag)
  })

  it('wantsWater covers needs_water and the water style', () => {
    expect(wantsWater({ needs_water: true, styles: [] })).toBe(true)
    expect(wantsWater({ needs_water: false, styles: ['water'] })).toBe(true)
    expect(wantsWater({ needs_water: false, styles: ['hiking'] })).toBe(false)
  })
})

describe('placeholder dots', () => {
  it('removes a copied template ellipsis between words only', () => {
    expect(withoutPlaceholderDots('כשנתחיל ב...עין מירב ונסיים ב…עין טמיר.')).toBe('כשנתחיל בעין מירב ונסיים בעין טמיר.')
    expect(withoutPlaceholderDots('ונמשיך... אחר כך')).toBe('ונמשיך... אחר כך')
  })
})

describe('tip wording', () => {
  it('removes sentences that repeat clock times', () => {
    expect(withoutClockTimes('השהייה במקום היא מ-08:00 עד 11:00. הביאו נעלי מים.')).toBe('הביאו נעלי מים.')
    expect(withoutClockTimes('הגיעו ב-9:30 לפני העומס')).toBe('')
    expect(withoutClockTimes('אין כאן צל, כדאי כובע.')).toBe('אין כאן צל, כדאי כובע.')
  })

  it('the prompt asks for first-person voice, practical tips and no invented parking/prices', async () => {
    const plan = await runPlannerAgent({ intent: INTENT, places: [poi(1), poi(2)].map(ok), sunset: '16:40' }, matrixDeps([[0, 10], [10, 0]]))
    const p = buildSummaryPrompt('מסלול מים', INTENT, plan)
    expect(p).toContain('תכננתי לך יום')
    expect(p).toContain('הוכנה תוכנית')
    expect(p).toContain('never use the word "ולכן"')
    expect(p).toContain('NEVER mention clock times')
    expect(p).toContain('Never state parking, prices, opening hours')
  })

  it('a tip that only repeated the times is dropped entirely', async () => {
    const plan = await runPlannerAgent({ intent: INTENT, places: [poi(1), poi(2)].map(ok), sunset: '16:40' }, matrixDeps([[0, 10], [10, 0]]))
    const parse = vi.fn(async () => ({
      parsed_output: { title: 't', overview: 'o', why_this_route: 'w', conditions_note: null,
        stop_tips: [{ id: 1, tip: 'השהייה במקום היא מ-08:00 עד 09:00.' }, { id: 2, tip: 'בשמורות רט״ג כדאי לבדוק מראש שעות ודמי כניסה.' }] },
      stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 },
    }))
    const s = await runSummaryAgent('q', INTENT, plan, { client: { messages: { parse } } as never, model: 'm' })
    expect(s.tips[1]).toBeUndefined()
    expect(s.tips[2]).toContain('לבדוק מראש')
  })
})
