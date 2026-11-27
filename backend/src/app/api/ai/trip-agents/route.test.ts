/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth/tokens', () => ({ getUserFromRequest: vi.fn() }))
vi.mock('@/lib/auth/rate-limit', () => ({ checkRateLimit: vi.fn(async () => true) }))
vi.mock('@/lib/db/raw-client', () => ({ rawDb: { query: vi.fn() } }))
vi.mock('@/lib/trip-agents/pipeline', () => ({ runTripPipeline: vi.fn() }))
vi.mock('@/lib/ai-route/rate-limit', () => ({ consumeRouteQuota: vi.fn() }))
vi.mock('@/lib/ai-route/daily-budget', () => ({ consumeDailyAiBudget: vi.fn() }))

import { POST } from './route'
import { getUserFromRequest } from '@/lib/auth/tokens'
import { checkRateLimit } from '@/lib/auth/rate-limit'
import { runTripPipeline } from '@/lib/trip-agents/pipeline'
import { consumeRouteQuota } from '@/lib/ai-route/rate-limit'
import { consumeDailyAiBudget } from '@/lib/ai-route/daily-budget'

const mockUser = getUserFromRequest as ReturnType<typeof vi.fn>
const mockRun = runTripPipeline as ReturnType<typeof vi.fn>

const request = (body: unknown) => new NextRequest('http://localhost/api/ai/trip-agents', {
  method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
})

async function lines(res: Response) {
  return (await res.text()).trim().split('\n').map((l) => JSON.parse(l))
}

const place = { id: 1, name: 'עין גדי', category: 'מעיין', regionName: 'מדבר יהודה', lat: 31.46, lng: 35.39, durationMinutes: 60, difficulty: 'קל', hasWater: true, hasShade: true, accessible: false, rating: 4.5, description: '', mainImage: null, sources: ['postgis'], matchReason: 'internal' }
const result = {
  intent: { date: '2026-11-26' },
  plan: { stops: [{ place, slot: 'midday', visitMinutes: 60, arrivalTime: '08:00', departureTime: '09:00', driveMinutesFromPrev: 0, distanceFromPrevKm: 0, waitMinutes: 0, conditions: [] }], dropped: [], startTime: '08:00', endTime: '09:00', sunset: '16:40', totalDriveMinutes: 0, totalDistanceKm: 0, totalHikingMinutes: 0, travelSource: 'estimate', orderStrategy: 'time_of_day' },
  summary: { title: 'ת', overview: 'o', whyThisRoute: 'w', tips: { 1: 'טיפ' }, conditionsNote: null, safetyFooter: 'f' },
  review: { verdict: 'approve', notes: 'n', issuesBefore: [], issuesAfter: [], added: [], removed: [] },
  conditions: { date: '2026-11-26', forecastAvailable: true, sunrise: '06:15', sunset: '16:40', rejected: [] },
  meta: { model: 'm', usage: { calls: 5, inputTokens: 1, outputTokens: 1 }, timingsMs: {}, searchUsedFallback: false },
}

const quota = (allowed: boolean) => ({ allowed, limit: 10, remaining: allowed ? 9 : 0, resetAt: new Date(Date.now() + 600_000) })

beforeEach(() => { vi.clearAllMocks(); (checkRateLimit as any).mockResolvedValue(true); (consumeRouteQuota as any).mockResolvedValue(quota(true)); (consumeDailyAiBudget as any).mockResolvedValue(true) })

describe('POST /api/ai/trip-agents', () => {
  it('rejects anonymous users', async () => {
    mockUser.mockResolvedValue(null)
    expect((await POST(request({ query: 'מסלול מים' }))).status).toBe(401)
    expect(mockRun).not.toHaveBeenCalled()
  })

  it('lets any signed-in user plan, charges the hourly quota, and hides debug data from non-admins', async () => {
    mockUser.mockResolvedValue({ id: 7, is_admin: false })
    mockRun.mockResolvedValue(result)
    const ev = await lines(await POST(request({ query: 'מסלול מים בצפון' })))
    expect(consumeRouteQuota).toHaveBeenCalledWith(7)
    expect(ev.at(-1).type).toBe('result')
    expect(ev.at(-1).data.debug).toBeUndefined()
  })

  it('returns 429 when a non-admin is over the hourly quota', async () => {
    mockUser.mockResolvedValue({ id: 7, is_admin: false });
    (consumeRouteQuota as any).mockResolvedValue(quota(false))
    const res = await POST(request({ query: 'מסלול מים' }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expect(mockRun).not.toHaveBeenCalled()
  })

  it('validates the query', async () => {
    mockUser.mockResolvedValue({ id: 1, is_admin: true })
    expect((await POST(request({ query: 'x' }))).status).toBe(400)
    expect((await POST(request({ query: 'א'.repeat(600) }))).status).toBe(400)
  })

  it('rate limits', async () => {
    mockUser.mockResolvedValue({ id: 1, is_admin: true });
    (checkRateLimit as any).mockResolvedValue(false)
    const res = await POST(request({ query: 'מסלול מים' }))
    expect(res.status).toBe(429)
  })

  it('streams step events then the client plan, without internal match reasons', async () => {
    mockUser.mockResolvedValue({ id: 1, is_admin: true })
    mockRun.mockImplementation(async (_q: string, deps: any) => {
      deps.onStep('intent', 'start'); deps.onStep('intent', 'done', 'הבנתי')
      return result
    })
    const res = await POST(request({ query: 'מסלול מים בצפון' }))
    expect(res.headers.get('content-type')).toContain('application/x-ndjson')
    const ev = await lines(res)
    expect(ev.slice(0, 2)).toEqual([{ type: 'step', step: 'intent', phase: 'start' }, { type: 'step', step: 'intent', phase: 'done', detail: 'הבנתי' }])
    const last = ev.at(-1)
    expect(last.type).toBe('result')
    expect(last.data.plan.stops[0]).toMatchObject({ id: 1, name: 'עין גדי', tip: 'טיפ', arrival: '08:00' })
    expect(JSON.stringify(last.data.plan)).not.toContain('internal')
    expect(last.data.debug).toBeDefined() // admin
    expect(consumeRouteQuota).not.toHaveBeenCalled()
  })

  it('streams a Hebrew error when the pipeline fails or finds nothing', async () => {
    mockUser.mockResolvedValue({ id: 1, is_admin: true })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockRun.mockRejectedValue(new Error('secret internal detail'))
    let ev = await lines(await POST(request({ query: 'מסלול מים' })))
    expect(ev.at(-1)).toMatchObject({ type: 'error', code: 'GENERATION_ERROR' })
    expect(JSON.stringify(ev)).not.toContain('secret')

    mockRun.mockResolvedValue({ ...result, plan: { ...result.plan, stops: [] } })
    ev = await lines(await POST(request({ query: 'מסלול מים' })))
    expect(ev.at(-1)).toMatchObject({ type: 'error', code: 'NO_PLACES' })
  })
  it('returns 503 for non-admins once the daily AI budget is spent; admins still run', async () => {
    (consumeDailyAiBudget as any).mockResolvedValue(false)
    mockUser.mockResolvedValue({ id: 7, is_admin: false })
    const res = await POST(request({ query: 'מסלול מים' }))
    expect(res.status).toBe(503)
    expect(mockRun).not.toHaveBeenCalled()

    mockUser.mockResolvedValue({ id: 1, is_admin: true })
    mockRun.mockResolvedValue(result)
    await lines(await POST(request({ query: 'מסלול מים' })))
    expect(mockRun).toHaveBeenCalled()
  })
})
