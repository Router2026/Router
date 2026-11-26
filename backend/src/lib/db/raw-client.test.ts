import { describe, it, expect, vi } from 'vitest'

// raw-client reads DATABASE_URL at import time, so set it before imports are evaluated.
vi.hoisted(() => { process.env.DATABASE_URL ??= 'postgresql://u:p@db.example.com:6543/postgres' })
vi.mock('pg', () => {
  class Pool { on = vi.fn(); query = vi.fn(); connect = vi.fn() }
  return { Pool }
})

import { sslFor } from './raw-client'

describe('sslFor', () => {
  it('uses TLS for remote databases (Supabase)', () => {
    expect(sslFor('postgresql://u:p@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres')).toEqual({ rejectUnauthorized: false })
  })
  it('skips TLS for a local database or an explicit sslmode=disable', () => {
    expect(sslFor('postgresql://u:p@127.0.0.1:54322/postgres')).toBe(false)
    expect(sslFor('postgresql://u:p@localhost:5432/postgres')).toBe(false)
    expect(sslFor('postgresql://u:p@db.example.com:5432/postgres?sslmode=disable')).toBe(false)
  })
})
