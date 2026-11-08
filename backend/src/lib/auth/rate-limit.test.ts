import { describe, it, expect, vi, beforeEach } from 'vitest'

const upstash = vi.hoisted(() => ({
  instances: [] as Array<{ config: { limiter: unknown; prefix: string }; limit: ReturnType<typeof vi.fn> }>,
  limitImpl: (() => Promise.resolve({ success: true })) as (id: string, opts?: unknown) => Promise<{ success: boolean }>,
}))

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow(tokens: number, window: string) { return { tokens, window } }
    config: { limiter: unknown; prefix: string }
    limit: ReturnType<typeof vi.fn>
    constructor(config: { limiter: unknown; prefix: string }) {
      this.config = config
      this.limit = vi.fn((id: string, opts?: unknown) => upstash.limitImpl(id, opts))
      upstash.instances.push(this)
    }
  },
}))
vi.mock('@upstash/redis', () => ({ Redis: vi.fn() }))

import { checkRateLimit, clientIp } from './rate-limit'

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  upstash.limitImpl = () => Promise.resolve({ success: true })
})

describe('checkRateLimit (Upstash path)', () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
  })

  it('builds the limiter with the caller-supplied max and window', async () => {
    await checkRateLimit('login:ip', 10, 15 * 60 * 1000)
    const inst = upstash.instances.find(i => i.config.prefix === `rl:10:${15 * 60 * 1000}`)
    expect(inst).toBeDefined()
    expect(inst!.config.limiter).toEqual({ tokens: 10, window: `${15 * 60 * 1000} ms` })
  })

  it('consumes exactly one token per call (no `rate` override)', async () => {
    await checkRateLimit('register:ip', 5, 3_600_000)
    const inst = upstash.instances.find(i => i.config.prefix === 'rl:5:3600000')!
    expect(inst.limit).toHaveBeenLastCalledWith('register:ip')
  })

  it('reuses one limiter per policy and separates different policies', async () => {
    const before = upstash.instances.length
    await checkRateLimit('a', 7, 7000)
    await checkRateLimit('b', 7, 7000)
    await checkRateLimit('c', 8, 7000)
    expect(upstash.instances.length - before).toBe(2)
  })

  it('returns the Upstash verdict', async () => {
    upstash.limitImpl = () => Promise.resolve({ success: false })
    expect(await checkRateLimit('blocked', 3, 3000)).toBe(false)
  })

  it('falls back to in-memory when Upstash throws', async () => {
    upstash.limitImpl = () => Promise.reject(new Error('down'))
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const key = `fallback:${Date.now()}`
    expect(await checkRateLimit(key, 1, 5000)).toBe(true)
    expect(await checkRateLimit(key, 1, 5000)).toBe(false)
    err.mockRestore()
  })
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
