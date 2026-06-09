import { describe, it, expect, vi } from 'vitest'

vi.mock('next/server', () => {
  class FakeNextResponse {
    status: number
    headers = new Map<string, string>()
    constructor(_body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.status = init?.status ?? 200
      for (const [k, v] of Object.entries(init?.headers ?? {})) {
        this.headers.set(k, v)
      }
    }
  }
  return { NextResponse: FakeNextResponse }
})

import { CORS_HEADERS, optionsResponse, withCors, OPTIONS } from './cors'
import { NextResponse } from 'next/server'

describe('CORS_HEADERS', () => {
  it('allows all origins', () => {
    expect(CORS_HEADERS['Access-Control-Allow-Origin']).toBe('*')
  })

  it('includes common HTTP methods', () => {
    const methods = CORS_HEADERS['Access-Control-Allow-Methods']
    expect(methods).toContain('GET')
    expect(methods).toContain('POST')
    expect(methods).toContain('DELETE')
  })

  it('allows Authorization header', () => {
    expect(CORS_HEADERS['Access-Control-Allow-Headers']).toContain('Authorization')
  })
})

describe('optionsResponse', () => {
  it('returns 204 status', () => {
    const res = optionsResponse() as unknown as InstanceType<typeof NextResponse>
    expect((res as { status: number }).status).toBe(204)
  })

  it('sets all CORS headers', () => {
    const res = optionsResponse() as unknown as { headers: Map<string, string> }
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      expect(res.headers.get(key)).toBe(value)
    }
  })
})

describe('withCors', () => {
  it('sets CORS headers on a response', () => {
    const res = new NextResponse(null, { status: 200 })
    withCors(res as never)
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      expect(res.headers.get(key)).toBe(value)
    }
  })

  it('returns the same response object', () => {
    const res = new NextResponse(null, { status: 200 })
    const returned = withCors(res as never)
    expect(returned).toBe(res)
  })
})

describe('OPTIONS', () => {
  it('delegates to optionsResponse', () => {
    const res = OPTIONS() as unknown as { status: number }
    expect(res.status).toBe(204)
  })
})
