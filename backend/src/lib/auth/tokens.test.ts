import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mocks intercept the dynamic `await import(...)` calls inside getUserFromRequest
vi.mock('@/lib/db/supabase', () => ({
  supabase: { auth: { getUser: vi.fn() } },
}))
vi.mock('@/lib/db/raw-client', () => ({
  rawDb: { query: vi.fn() },
}))

import { supabase } from '@/lib/db/supabase'
import { rawDb } from '@/lib/db/raw-client'
import { signJWT, verifyJWT, hashPassword, verifyPassword, getUserFromRequest } from './tokens'

const mockSb    = supabase as { auth: { getUser: ReturnType<typeof vi.fn> } }
const mockRawDb = rawDb   as { query: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('JWT', () => {
  it('signJWT + verifyJWT round-trip', async () => {
    const payload = { id: 1, email: 'test@test.com', is_admin: false }
    const token = await signJWT(payload)
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)

    const verified = await verifyJWT(token)
    expect(verified.id).toBe(1)
    expect(verified.email).toBe('test@test.com')
  })

  it('verifyJWT throws on tampered signature', async () => {
    const token = await signJWT({ id: 2 })
    const parts = token.split('.')
    parts[2] = 'invalidsignature'
    await expect(verifyJWT(parts.join('.'))).rejects.toThrow()
  })

  it('verifyJWT throws on invalid token format', async () => {
    await expect(verifyJWT('not.a.valid.jwt.token')).rejects.toThrow()
    await expect(verifyJWT('short')).rejects.toThrow()
  })

  it('verifyJWT throws on expired token', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const body   = Buffer.from(JSON.stringify({ id: 1, iat: 1000, exp: 1001 })).toString('base64url')
    await expect(verifyJWT(`${header}.${body}.fakesig`)).rejects.toThrow()
  })
})

describe('Password hashing', () => {
  it('hashPassword + verifyPassword round-trip', async () => {
    const hash = await hashPassword('mypassword123')
    expect(typeof hash).toBe('string')
    expect(hash).toContain(':')

    const valid = await verifyPassword('mypassword123', hash)
    expect(valid).toBe(true)
  })

  it('verifyPassword returns false for wrong password', async () => {
    const hash = await hashPassword('correctpassword')
    const valid = await verifyPassword('wrongpassword', hash)
    expect(valid).toBe(false)
  })

  it('verifyPassword returns false for malformed stored hash', async () => {
    const valid = await verifyPassword('pass', 'notahash')
    expect(valid).toBe(false)
  })

  it('two hashes of the same password are different (different salts)', async () => {
    const hash1 = await hashPassword('same')
    const hash2 = await hashPassword('same')
    expect(hash1).not.toBe(hash2)
  })
})

describe('getUserFromRequest', () => {
  it('returns null when no Authorization header', async () => {
    const result = await getUserFromRequest(new Request('http://localhost/test'))
    expect(result).toBeNull()
  })

  it('returns null for non-Bearer header', async () => {
    const req = new Request('http://localhost/test', {
      headers: { Authorization: 'Basic sometoken' },
    })
    expect(await getUserFromRequest(req)).toBeNull()
  })

  it('returns user when supabase resolves email and DB row exists', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: { email: 'user@test.com' } }, error: null })
    mockRawDb.query.mockResolvedValue({ rows: [{ id: 7, is_admin: false }] })

    const req = new Request('http://localhost/test', {
      headers: { Authorization: 'Bearer supabase-token' },
    })
    const result = await getUserFromRequest(req)

    expect(result).toEqual({ id: 7, email: 'user@test.com', is_admin: false })
  })

  it('falls through to JWT when supabase finds email but no DB row', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: { email: 'new@test.com' } }, error: null })
    mockRawDb.query.mockResolvedValue({ rows: [] }) // no matching user in DB

    const token = await signJWT({ id: 42, email: 'new@test.com', is_admin: true })
    const req = new Request('http://localhost/test', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await getUserFromRequest(req)

    // supabase path skipped (no rows[0]) → JWT fallback succeeds
    expect(result).toMatchObject({ id: 42, email: 'new@test.com', is_admin: true })
  })

  it('falls through to JWT when supabase returns no user', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    const token = await signJWT({ id: 99, email: 'jwt@test.com', is_admin: false })
    const req = new Request('http://localhost/test', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await getUserFromRequest(req)

    expect(result).toMatchObject({ id: 99, email: 'jwt@test.com' })
  })

  it('returns null when token is invalid and supabase returns no user', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    const req = new Request('http://localhost/test', {
      headers: { Authorization: 'Bearer bad-token' },
    })
    expect(await getUserFromRequest(req)).toBeNull()
  })
})
