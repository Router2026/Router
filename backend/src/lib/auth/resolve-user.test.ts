/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/raw-client', () => ({
  rawDb: { query: vi.fn() },
}))
vi.mock('@/lib/db/supabase', () => ({
  supabase: { auth: { getUser: vi.fn() } },
}))
vi.mock('@/lib/auth/tokens', () => ({
  getUserFromRequest: vi.fn(),
}))

import { rawDb } from '@/lib/db/raw-client'
import { supabase } from '@/lib/db/supabase'
import { getUserFromRequest } from '@/lib/auth/tokens'
import { resolvePoiAuthUser, resolveContributorUser } from './resolve-user'

const mockDb       = rawDb     as unknown as { query: ReturnType<typeof vi.fn> }
const mockSb       = supabase  as unknown as { auth: { getUser: ReturnType<typeof vi.fn> } }
const mockGetUser  = getUserFromRequest as ReturnType<typeof vi.fn>

function makeReq(token?: string): any {
  return {
    headers: {
      get: (name: string) =>
        name === 'Authorization' && token ? `Bearer ${token}` : null,
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── resolvePoiAuthUser ────────────────────────────────────────────────────────

describe('resolvePoiAuthUser', () => {
  it('returns null when no Authorization header', async () => {
    expect(await resolvePoiAuthUser(makeReq())).toBeNull()
  })

  it('returns null for non-Bearer authorization', async () => {
    const req: any = { headers: { get: () => 'Basic abc' } }
    expect(await resolvePoiAuthUser(req)).toBeNull()
  })

  it('resolves user via supabase email → DB row', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: { email: 'user@test.com' } } })
    mockDb.query.mockResolvedValue({ rows: [{ id: 42, username: 'alice' }] })

    const result = await resolvePoiAuthUser(makeReq('sb-token'))

    expect(result).toEqual({ id: 42, username: 'alice' })
    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE email'),
      ['user@test.com'],
    )
  })

  it('returns null when supabase email matches but no DB row', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: { email: 'new@test.com' } } })
    mockDb.query.mockResolvedValue({ rows: [] })

    expect(await resolvePoiAuthUser(makeReq('sb-token'))).toBeNull()
  })

  it('falls back to JWT when supabase returns no user', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: null } })
    mockGetUser.mockResolvedValue({ id: 7, username: 'bob', email: 'bob@test.com', is_admin: false })

    const result = await resolvePoiAuthUser(makeReq('jwt-token'))

    expect(result).toEqual({ id: 7, username: 'bob' })
  })

  it('returns null when JWT auth has no id', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: null } })
    mockGetUser.mockResolvedValue({ email: 'x@test.com', is_admin: false })

    expect(await resolvePoiAuthUser(makeReq('jwt-token'))).toBeNull()
  })

  it('returns null when both supabase and JWT return nothing', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: null } })
    mockGetUser.mockResolvedValue(null)

    expect(await resolvePoiAuthUser(makeReq('bad-token'))).toBeNull()
  })
})

// ── resolveContributorUser ────────────────────────────────────────────────────

describe('resolveContributorUser', () => {
  it('returns fallback when no Authorization header', async () => {
    const result = await resolveContributorUser(makeReq(), 'אנונימי')
    expect(result).toEqual({ userId: null, name: 'אנונימי' })
  })

  it('resolves name from supabase full_name', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: { email: 'u@test.com' } } })
    mockDb.query.mockResolvedValue({ rows: [{ id: 10, username: 'carol', full_name: 'Carol Smith' }] })

    const result = await resolveContributorUser(makeReq('token'), 'fallback')

    expect(result).toEqual({ userId: 10, name: 'Carol Smith' })
  })

  it('falls back to username when full_name is empty', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: { email: 'u@test.com' } } })
    mockDb.query.mockResolvedValue({ rows: [{ id: 10, username: 'carol', full_name: '' }] })

    const result = await resolveContributorUser(makeReq('token'), 'fallback')

    expect(result).toEqual({ userId: 10, name: 'carol' })
  })

  it('returns null userId when supabase email found but no DB row', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: { email: 'new@test.com' } } })
    mockDb.query.mockResolvedValue({ rows: [] })

    const result = await resolveContributorUser(makeReq('token'), 'אנונימי')

    expect(result).toEqual({ userId: null, name: 'אנונימי' })
  })

  it('resolves via JWT fallback when supabase returns no user', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: null } })
    mockGetUser.mockResolvedValue({ id: 99, email: 'jwt@test.com', is_admin: false })
    mockDb.query.mockResolvedValue({ rows: [{ id: 99, username: 'david', full_name: 'David Levi' }] })

    const result = await resolveContributorUser(makeReq('jwt-token'), 'fallback')

    expect(result).toEqual({ userId: 99, name: 'David Levi' })
  })

  it('returns fallback when JWT user has no DB row', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: null } })
    mockGetUser.mockResolvedValue({ id: 55, email: 'x@test.com', is_admin: false })
    mockDb.query.mockResolvedValue({ rows: [] })

    const result = await resolveContributorUser(makeReq('jwt-token'), 'fallback')

    expect(result).toEqual({ userId: null, name: 'fallback' })
  })

  it('returns fallback when both supabase and JWT return nothing', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: null } })
    mockGetUser.mockResolvedValue(null)

    const result = await resolveContributorUser(makeReq('bad-token'), 'fallback')

    expect(result).toEqual({ userId: null, name: 'fallback' })
  })
})
