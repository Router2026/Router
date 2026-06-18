import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@upstash/ratelimit', () => ({ Ratelimit: class { static slidingWindow() { return null; } limit = vi.fn() } }))
vi.mock('@upstash/redis', () => ({ Redis: vi.fn() }))

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

// Test-only IP fixtures — safe, not used in production code
const TEST_IP_A = '1.2.3.4' // NOSONAR S1313
const TEST_IP_B = '1.2.3.5' // NOSONAR S1313
const TEST_IP_C = '9.9.9.9' // NOSONAR S1313
const TEST_IP_D = '10.0.0.1' // NOSONAR S1313
const TEST_IP_E = '10.0.0.2' // NOSONAR S1313

describe('clientIp', () => {
  it('extracts first IP from x-forwarded-for header', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': `${TEST_IP_A}, ${TEST_IP_B}` },
    })
    expect(clientIp(req)).toBe(TEST_IP_A)
  })

  it('falls back to x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': TEST_IP_C },
    })
    expect(clientIp(req)).toBe(TEST_IP_C)
  })

  it('returns unknown when no IP headers present', () => {
    const req = new Request('http://localhost')
    expect(clientIp(req)).toBe('unknown')
  })

  it('trims whitespace from x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': `  ${TEST_IP_D}  , ${TEST_IP_E}` },
    })
    expect(clientIp(req)).toBe(TEST_IP_D)
  })
})
