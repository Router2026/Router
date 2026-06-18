/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

import { cookies } from 'next/headers'
import {
  makeAdminCookieHeader,
  clearAdminCookieHeader,
  verifyAdminCookie,
  verifyAdminRequest,
  requireAdmin,
} from './auth'

const mockCookies = vi.mocked(cookies)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('clearAdminCookieHeader', () => {
  it('returns a cookie header that clears the admin token', () => {
    const header = clearAdminCookieHeader()
    expect(header).toContain('admin_token=')
    expect(header).toContain('Max-Age=0')
    expect(header).toContain('HttpOnly')
  })
})

describe('makeAdminCookieHeader', () => {
  it('returns a cookie header containing the hashed token', async () => {
    const header = await makeAdminCookieHeader('my-secret')
    expect(header).toContain('admin_token=')
    expect(header).toContain('HttpOnly')
    expect(header).toContain('SameSite=Strict')
    expect(header).toContain('Max-Age=')
  })

  it('produces a 64-char hex token (SHA-256)', async () => {
    const header = await makeAdminCookieHeader('test-secret')
    const tokenMatch = /admin_token=([0-9a-f]+)/.exec(header)
    expect(tokenMatch).not.toBeNull()
    expect(tokenMatch![1]).toHaveLength(64)
  })

  it('different secrets produce different tokens', async () => {
    const h1 = await makeAdminCookieHeader('secret-a')
    const h2 = await makeAdminCookieHeader('secret-b')
    expect(h1).not.toBe(h2)
  })

  it('same secret always produces same token (deterministic)', async () => {
    const h1 = await makeAdminCookieHeader('same-secret')
    const h2 = await makeAdminCookieHeader('same-secret')
    expect(h1).toBe(h2)
  })
})

describe('verifyAdminCookie', () => {
  it('returns false when ADMIN_SECRET is not set', async () => {
    delete process.env.ADMIN_SECRET
    const result = await verifyAdminCookie()
    expect(result).toBe(false)
  })

  it('returns false when cookie is absent', async () => {
    process.env.ADMIN_SECRET = 'test-secret'
    mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) } as any)
    const result = await verifyAdminCookie()
    expect(result).toBe(false)
    delete process.env.ADMIN_SECRET
  })

  it('returns true when cookie matches expected token', async () => {
    process.env.ADMIN_SECRET = 'my-secret'
    const header = await makeAdminCookieHeader('my-secret')
    const token = /admin_token=([0-9a-f]+)/.exec(header)![1]
    mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: token }) } as any)
    const result = await verifyAdminCookie()
    expect(result).toBe(true)
    delete process.env.ADMIN_SECRET
  })

  it('returns false when cookie token is wrong', async () => {
    process.env.ADMIN_SECRET = 'my-secret'
    mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue({ value: 'wrongtoken' }) } as any)
    const result = await verifyAdminCookie()
    expect(result).toBe(false)
    delete process.env.ADMIN_SECRET
  })
})

describe('verifyAdminRequest', () => {
  it('returns false when ADMIN_SECRET is not set', async () => {
    delete process.env.ADMIN_SECRET
    const req = { cookies: { get: vi.fn().mockReturnValue(undefined) } } as any
    expect(await verifyAdminRequest(req)).toBe(false)
  })

  it('returns true with matching token in cookie', async () => {
    process.env.ADMIN_SECRET = 'req-secret'
    const header = await makeAdminCookieHeader('req-secret')
    const token = /admin_token=([0-9a-f]+)/.exec(header)![1]
    const req = { cookies: { get: vi.fn().mockReturnValue({ value: token }) } } as any
    expect(await verifyAdminRequest(req)).toBe(true)
    delete process.env.ADMIN_SECRET
  })
})

describe('requireAdmin', () => {
  it('returns { ok: false } when not authorized', async () => {
    delete process.env.ADMIN_SECRET
    const req = { cookies: { get: vi.fn().mockReturnValue(undefined) } } as any
    const result = await requireAdmin(req)
    expect(result).toEqual({ ok: false })
  })

  it('returns { ok: true } when authorized', async () => {
    process.env.ADMIN_SECRET = 'admin-secret'
    const header = await makeAdminCookieHeader('admin-secret')
    const token = /admin_token=([0-9a-f]+)/.exec(header)![1]
    const req = { cookies: { get: vi.fn().mockReturnValue({ value: token }) } } as any
    const result = await requireAdmin(req)
    expect(result).toEqual({ ok: true })
    delete process.env.ADMIN_SECRET
  })
})
