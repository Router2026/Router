import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@upstash/ratelimit', () => ({ Ratelimit: class { static slidingWindow() {} limit = vi.fn() } }))
vi.mock('@upstash/redis', () => ({ Redis: class {} }))

import { checkRateLimit, clientIp } from './rate-limit'

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
})

describe('checkRateLimit (in-memory path)', () => {
  it('allows requests within the limit', async () => {
    const key = `test:allow:${Date.now()}`
    const result = await checkRateLimit(key, 3, 5000)
    expect(result).toBe(true)
  })

  it('blocks requests exceeding the limit', async () => {
    const key = `test:block:${Date.now()}`
    await checkRateLimit(key, 2, 5000)
    await checkRateLimit(key, 2, 5000)
    const result = await checkRateLimit(key, 2, 5000)
    expect(result).toBe(false)
  })

  it('resets after window expires', async () => {
    const key = `test:reset:${Date.now()}`
    await checkRateLimit(key, 1, 1)   // window = 1ms
    await new Promise(r => setTimeout(r, 10))
    const result = await checkRateLimit(key, 1, 1)
    expect(result).toBe(true)
  })

  it('different keys have independent counters', async () => {
    const base = Date.now()
    await checkRateLimit(`key-a:${base}`, 1, 5000)
    const b = await checkRateLimit(`key-b:${base}`, 1, 5000)
    expect(b).toBe(true)
  })
})

describe('clientIp', () => {
  it('extracts first IP from x-forwarded-for header', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(clientIp(req)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '9.9.9.9' },
    })
    expect(clientIp(req)).toBe('9.9.9.9')
  })

  it('returns unknown when no IP headers present', () => {
    const req = new Request('http://localhost')
    expect(clientIp(req)).toBe('unknown')
  })

  it('trims whitespace from x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '  10.0.0.1  , 10.0.0.2' },
    })
    expect(clientIp(req)).toBe('10.0.0.1')
  })
})
