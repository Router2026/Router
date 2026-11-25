/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db/raw-client', () => ({ rawDb: { query: vi.fn() } }))
vi.mock('@/lib/trip-bucket/mapbox-matrix', () => ({ fetchMapboxMatrix: vi.fn(async () => null) }))

import { checkPlan, runReviewAgent } from './review-agent'
import { runSummaryAgent, fallbackSummary, SAFETY_FOOTER } from './summary-agent'
import { runTripPipeline } from './pipeline'
import { runPlannerAgent } from './planner-agent'
import type { AssessedPlace, ConditionsReport } from './conditions-agent'
import type { TripIntent } from './intent-agent'
import type { PoiCandidate } from './types'

function poi(id: number, over: Partial<PoiCandidate> = {}): PoiCandidate {
  return {
    id, name: `p${id}`, category: 'אתר היסטורי', regionName: 'גליל', lat: 32.8 + id / 1000, lng: 35.5, durationMinutes: 60,
    difficulty: 'קל', hasWater: false, hasShade: false, accessible: false, rating: 4.5, description: '',
    mainImage: null, sources: ['postgis'], ...over,
  }
}
const ok = (p: PoiCandidate): AssessedPlace => ({ place: p, weather: null, notes: [], rejected: false })

const INTENT: TripIntent = {
  regions: ['galil_u'], styles: ['water'], difficulty: 'any', needs_water: true, needs_shade: false, needs_accessible: false,
  date: '2026-11-25', start_time: '08:00', max_stops: 3, anchor: null, search_query_he: 'מים', language: 'he',
}
const flat = { matrix: vi.fn(async (ps: PoiCandidate[]) => ({ matrix: ps.map((_, i) => ps.map((__, j) => (i === j ? 0 : 20))), source: 'estimate' as const })) }

function report(approved: PoiCandidate[], spares: PoiCandidate[] = []): ConditionsReport {
  return { date: INTENT.date, forecastAvailable: true, approved: approved.map(ok), approvedSpares: spares.map(ok), rejected: [], sunrise: '06:15', sunset: '16:40' }
}

const toolUse = (id: string, name: string, input: unknown) => ({ type: 'tool_use', id, name, input })
function scripted(turns: any[][]) {
  const create = vi.fn(async () => {
    const content = turns.shift() ?? [{ type: 'text', text: 'ok' }]
    return { content, stop_reason: content.some((b: any) => b.type === 'tool_use') ? 'tool_use' : 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } }
  })
  return { client: { messages: { create } } as never, create }
}

describe('checkPlan', () => {
  it('flags missing water, inaccessible / too-hard stops, far stops and too few stops', async () => {
    const plan = await runPlannerAgent({ intent: INTENT, places: [ok(poi(1, { difficulty: 'מאתגר', category: 'נחל', distanceKm: 80 }))], sunset: '16:40' }, flat)
    const codes = checkPlan(plan, { ...INTENT, difficulty: 'easy', needs_accessible: true, anchor: { name: 'x', lat: 1, lng: 1 } }).map((i) => i.code)
    expect(codes).toEqual(expect.arrayContaining(['too_few_stops', 'missing_water', 'not_accessible', 'too_hard', 'far_from_anchor']))
  })

  it('passes a plan that fits', async () => {
    const places = [poi(1, { hasWater: true }), poi(2), poi(3)].map(ok)
    const plan = await runPlannerAgent({ intent: INTENT, places, sunset: '16:40' }, flat)
    expect(checkPlan(plan, INTENT)).toEqual([])
  })
})

describe('runReviewAgent', () => {
  const base = async (approved: PoiCandidate[], spares: PoiCandidate[] = []) => {
    const conditions = report(approved, spares)
    const plan = await runPlannerAgent({ intent: INTENT, places: conditions.approved, sunset: '16:40' }, flat)
    return { query: 'בא לי מסלול מים בצפון', intent: INTENT, plan, conditions, pool: [...approved, ...spares], today: INTENT.date }
  }

  it('approve keeps the plan unchanged', async () => {
    const input = await base([poi(1, { hasWater: true }), poi(2), poi(3)])
    const { client } = scripted([[toolUse('r', 'submit_review', { verdict: 'approve', remove_ids: [], add_ids: [], notes: 'fits' })]])
    const r = await runReviewAgent(input, { client, model: 'm', planner: flat })
    expect(r.verdict).toBe('approve')
    expect(r.plan).toBe(input.plan)
  })

  it('applies a revision from spares and re-plans; ignores unknown ids', async () => {
    const input = await base([poi(1), poi(2), poi(3)], [poi(9, { hasWater: true, category: 'מעיין' })])
    expect(checkPlan(input.plan, INTENT).map((i) => i.code)).toContain('missing_water')
    const { client } = scripted([[toolUse('r', 'submit_review', { verdict: 'revise', remove_ids: [3, 777], add_ids: [9, 555], notes: 'swap for water' })]])
    const r = await runReviewAgent(input, { client, model: 'm', planner: flat })
    expect(r.verdict).toBe('revise')
    expect(r.plan.stops.map((s) => s.place.id).sort()).toEqual([1, 2, 9])
    expect(r.added).toEqual([9])
    expect(r.removed).toEqual([3])
    expect(r.issuesAfter).toEqual([])
  })

  it('runs new search results through the safety check before adding them', async () => {
    const input = await base([poi(1), poi(2), poi(3)])
    const desertStream = poi(50, { category: 'נחל', lat: 30.6, lng: 34.8, hasWater: true })
    const { client } = scripted([
      [toolUse('s', 'semantic_search', { query_he: 'מעיין', regions: [], require: ['water'] })],
      [toolUse('r', 'submit_review', { verdict: 'revise', remove_ids: [3], add_ids: [50], notes: 'add water' })],
    ])
    const fetchWeather = vi.fn(async (pts: unknown[]) => pts.map(() => ({ tempMaxC: 20, precipMm: 10, precipProb: 90, gustsKmh: 10, prevPrecipMm: 0, sunrise: '06:15', sunset: '16:40' })))
    const r = await runReviewAgent(input, { client, model: 'm', planner: flat, fetchWeather, semantic: vi.fn(async () => [desertStream]), postgis: vi.fn(async () => []) })
    expect(fetchWeather).toHaveBeenCalled()
    // the flood-risk stream was rejected; removing stop 3 alone is not better → original plan kept
    expect(r.plan.stops.map((s) => s.place.id)).not.toContain(50)
  })

  it('returns skipped when the model never submits', async () => {
    const input = await base([poi(1), poi(2)])
    const r = await runReviewAgent(input, { ...scripted([[{ type: 'text', text: 'hmm' }]]), model: 'm', planner: flat })
    expect(r.verdict).toBe('skipped')
    expect(r.plan).toBe(input.plan)
  })
})

describe('runSummaryAgent', () => {
  it('keeps tips only for plan ids and always adds the fixed safety footer', async () => {
    const plan = await runPlannerAgent({ intent: INTENT, places: [poi(1), poi(2)].map(ok), sunset: '16:40' }, flat)
    const parse = vi.fn(async () => ({
      parsed_output: { title: 'יום מים', overview: 'o', why_this_route: 'w', stop_tips: [{ id: 1, tip: 'בוקר' }, { id: 99, tip: 'x' }], conditions_note: null },
      stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 },
    }))
    const s = await runSummaryAgent('q', INTENT, plan, { client: { messages: { parse } } as never, model: 'm' })
    expect(s.tips).toEqual({ 1: 'בוקר' })
    expect(s.safetyFooter).toBe(SAFETY_FOOTER.he)
    const prompt = ((parse.mock.calls[0] as any[])[0]).messages[0].content as string
    expect(prompt).toContain('Use ONLY the facts below')
  })

  it('fallbackSummary uses plan facts only', async () => {
    const plan = await runPlannerAgent({ intent: INTENT, places: [poi(1), poi(2)].map(ok), sunset: '16:40' }, flat)
    expect(fallbackSummary({ ...INTENT, language: 'en' }, plan).overview).toContain('p1')
  })
})

describe('runTripPipeline', () => {
  it('runs all six steps in order and survives review + summary failures', async () => {
    const intentOut = { ...INTENT, date: null, start_time: null, max_stops: null }
    const parse = vi.fn()
      .mockResolvedValueOnce({ parsed_output: intentOut, stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } })
      .mockRejectedValueOnce(new Error('summary down'))
    const create = vi.fn()
      .mockResolvedValueOnce({ content: [toolUse('a', 'postgis_search', { regions: ['galil_u'], categories: [], difficulty: 'any' })], stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 } })
      .mockResolvedValueOnce({ content: [toolUse('b', 'submit_candidates', { picks: [{ id: 1, why: 'w' }, { id: 2, why: 'w' }] })], stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 } })
      .mockRejectedValueOnce(new Error('review down'))
    const steps: string[] = []
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await runTripPipeline('מסלול מים', {
      client: { messages: { parse, create } } as never, model: 'm', now: new Date('2026-11-25T08:00:00Z'),
      postgis: vi.fn(async () => [poi(1, { hasWater: true }), poi(2)]), semantic: vi.fn(async () => []),
      fetchWeather: vi.fn(async (pts: unknown[]) => pts.map(() => null)), planner: flat,
      onStep: (s, phase) => { if (phase === 'start') steps.push(s) },
    })
    expect(steps).toEqual(['intent', 'search', 'conditions', 'planner', 'review', 'summary'])
    expect(r.plan.stops.map((s) => s.place.id).sort()).toEqual([1, 2])
    expect(r.review.verdict).toBe('skipped')
    expect(r.summary.safetyFooter).toBe(SAFETY_FOOTER.he)
    expect(r.conditions.forecastAvailable).toBe(false)
    expect(r.meta.usage.calls).toBe(3)
  })
})
