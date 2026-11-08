import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getUserFromRequest: vi.fn(),
  checkRateLimit: vi.fn(),
  generateTrip: vi.fn(),
  regenerateStop: vi.fn(),
}))

vi.mock('@/lib/auth/tokens', () => ({ getUserFromRequest: mocks.getUserFromRequest }))
vi.mock('@/lib/auth/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/lib/trips/trip-service', () => ({
  generateTrip: mocks.generateTrip,
  regenerateStop: mocks.regenerateStop,
  getTripByUuid: vi.fn(),
}))

import { POST } from './route'
import { PATCH } from './[id]/route'

const USER = { id: 7, email: 'u@example.com', is_admin: false }
const ADMIN = { id: 1, email: 'a@example.com', is_admin: true }
const params = { params: Promise.resolve({ id: 'trip-uuid' }) }

function req(method: string, body: unknown) {
  return new NextRequest('http://localhost/api/trips', { method, body: JSON.stringify(body) })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.checkRateLimit.mockResolvedValue(true)
})

describe('PATCH /api/trips/[id] (LLM regenerate)', () => {
  it('401s without a user and never reaches the LLM', async () => {
    mocks.getUserFromRequest.mockResolvedValue(null)
    const res = await PATCH(req('PATCH', { dayIndex: 0, stopIndex: 0 }), params)
    expect(res.status).toBe(401)
    expect(mocks.regenerateStop).not.toHaveBeenCalled()
  })

  it('403s for a non-admin user', async () => {
    mocks.getUserFromRequest.mockResolvedValue(USER)
    const res = await PATCH(req('PATCH', { dayIndex: 0, stopIndex: 0 }), params)
    expect(res.status).toBe(403)
    expect(mocks.regenerateStop).not.toHaveBeenCalled()
  })

  it('429s when the per-user limit is exhausted', async () => {
    mocks.getUserFromRequest.mockResolvedValue(ADMIN)
    mocks.checkRateLimit.mockResolvedValue(false)
    const res = await PATCH(req('PATCH', { dayIndex: 0, stopIndex: 0 }), params)
    expect(res.status).toBe(429)
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('trip-regenerate:1', expect.any(Number), expect.any(Number))
    expect(mocks.regenerateStop).not.toHaveBeenCalled()
  })

  it('allows an admin within the limit', async () => {
    mocks.getUserFromRequest.mockResolvedValue(ADMIN)
    mocks.regenerateStop.mockResolvedValue({ plan: { days: [] }, stop: {} })
    const res = await PATCH(req('PATCH', { dayIndex: 0, stopIndex: 0 }), params)
    expect(res.status).toBe(200)
    expect(mocks.regenerateStop).toHaveBeenCalledWith('trip-uuid', 0, 0)
  })
})

describe('POST /api/trips (LLM generate)', () => {
  it('401s without a user and never reaches the LLM', async () => {
    mocks.getUserFromRequest.mockResolvedValue(null)
    const res = await POST(req('POST', {}))
    expect(res.status).toBe(401)
    expect(mocks.generateTrip).not.toHaveBeenCalled()
  })

  it('rate-limits per user id, not per spoofable IP', async () => {
    mocks.getUserFromRequest.mockResolvedValue(USER)
    mocks.checkRateLimit.mockResolvedValue(false)
    const res = await POST(req('POST', {}))
    expect(res.status).toBe(429)
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('trip-generate:7', 5, 10 * 60 * 1000)
    expect(mocks.generateTrip).not.toHaveBeenCalled()
  })
})
