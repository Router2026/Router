/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/trip-bucket/mapbox-matrix', () => ({ fetchMapboxMatrix: vi.fn(async () => null) }))

import { runBucketPipeline, toSmartPlan, bucketPoiToCandidate, SLOT_LABEL_HE } from './bucket'
import { toClientPlan } from './client'
import type { BucketPoi } from '@/lib/trip-bucket/types'
import { SAFETY_FOOTER } from './summary-agent'

function bp(id: number, over: Partial<BucketPoi> = {}): BucketPoi {
  return {
    id: String(id), name: `p${id}`, description: '', category: 'אתר היסטורי', region: 'גליל עליון',
    latitude: 33 + id / 1000, longitude: 35.5, duration_minutes: 60, difficulty: 'קל',
    has_water: false, has_shade: false, accessible: false, average_rating: 4.5, ...over,
  }
}

const NOW = new Date('2026-11-25T06:00:00Z')
const flat = { matrix: vi.fn(async (ps: unknown[]) => ({ matrix: ps.map((_, i) => ps.map((__, j) => (i === j ? 0 : 20))), source: 'estimate' as const })) }
const sunny = vi.fn(async (pts: unknown[]) => pts.map(() => ({ tempMaxC: 22, precipMm: 0, precipProb: 0, gustsKmh: 10, prevPrecipMm: 0, sunrise: '06:15', sunset: '16:40' })))

function summaryClient(tips: { id: number; tip: string }[] = []) {
  const parse = vi.fn(async () => ({ parsed_output: { title: 'יום בגליל', overview: 'סקירה', why_this_route: 'למה', stop_tips: tips, conditions_note: null }, stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }))
  return { client: { messages: { parse } } as never, model: 'm', parse }
}

describe('bucketPoiToCandidate', () => {
  it('converts ids and fields', () => {
    expect(bucketPoiToCandidate(bp(7, { has_water: true }))).toMatchObject({ id: 7, name: 'p7', hasWater: true, lat: 33.007 })
  })
})

describe('runBucketPipeline', () => {
  it('keeps every picked place, including two hard hikes (no auto-planning limits)', async () => {
    const hard = (id: number) => bp(id, { category: 'נחל', difficulty: 'מאתגר', duration_minutes: 120 })
    const s = summaryClient([{ id: 1, tip: 'צאו מוקדם' }])
    const r = await runBucketPipeline([hard(1), hard(2), bp(3)], { now: NOW, fetchWeather: sunny, planner: flat, summary: s })
    expect(r.plan.stops.map((x) => x.place.id).sort()).toEqual([1, 2, 3])
    expect(r.warnings).toEqual([])
    const prompt = ((s.parse.mock.calls[0] as any[])[0]).messages[0].content as string
    expect(prompt).toContain('picked these places themselves')
  })

  it('leaves out unsafe places and explains why, in Hebrew', async () => {
    const desert = bp(1, { category: 'נחל', latitude: 30.6, longitude: 34.8, name: 'נחל צין' })
    const rain = vi.fn(async (pts: { lat: number }[]) => pts.map((p) => ({ tempMaxC: 20, precipMm: p.lat < 31 ? 8 : 0, precipProb: 80, gustsKmh: 10, prevPrecipMm: 0, sunrise: '06:15', sunset: '16:40' })))
    const r = await runBucketPipeline([desert, bp(2), bp(3)], { now: NOW, fetchWeather: rain, planner: flat, summary: summaryClient() })
    expect(r.plan.stops.map((x) => x.place.id)).not.toContain(1)
    expect(r.warnings[0]).toContain('נחל צין')
    expect(r.warnings[0]).toContain('שיטפונות')
  })

  it('still returns a plan when the summary model fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const parse = vi.fn(async () => { throw new Error('down') })
    const r = await runBucketPipeline([bp(1), bp(2)], { now: NOW, fetchWeather: sunny, planner: flat, summary: { client: { messages: { parse } } as never, model: 'm' } })
    expect(r.plan.stops).toHaveLength(2)
    expect(r.summary.safetyFooter).toBe(SAFETY_FOOTER.he)
  })
})

describe('toSmartPlan / toClientPlan', () => {
  it('maps to the existing smart-build shape with Hebrew slot labels and tips', async () => {
    const r = await runBucketPipeline([bp(1, { category: 'מצפה', duration_minutes: 30 }), bp(2)], { now: new Date('2026-11-25T12:00:00Z'), fetchWeather: sunny, planner: flat, summary: summaryClient([{ id: 2, tip: 'טיפ' }]) })
    const sp = toSmartPlan(r)
    expect(sp.route_title).toBe('יום בגליל')
    expect(sp.stops.map((s) => s.location_id)).toEqual(r.plan.stops.map((s) => String(s.place.id)))
    expect(sp.stops.find((s) => s.location_id === '2')!.smart_insight).toBe('טיפ')
    expect(Object.values(SLOT_LABEL_HE)).toContain(sp.stops[0].visit_type)

    const cp = toClientPlan({ plan: r.plan, summary: r.summary, conditions: { ...r.conditions, rejected: [] }, intent: { date: '2026-11-25' } as any })
    expect(cp.stops[0]).toHaveProperty('arrival')
    expect(cp.stops[0]).not.toHaveProperty('matchReason')
    expect(cp.safetyFooter).toBe(SAFETY_FOOTER.he)
  })
})
