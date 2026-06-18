import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/raw-client', () => ({
  rawDb: { query: vi.fn() },
}))

import { rawDb } from '@/lib/db/raw-client'
import { rateLocation, getRatingSummary } from './rating-service'

const mockDb = rawDb as unknown as { query: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('rateLocation', () => {
  it('throws VALIDATION_ERROR for rating below 1', async () => {
    await expect(rateLocation(1, 1, 0)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('throws VALIDATION_ERROR for rating above 5', async () => {
    await expect(rateLocation(1, 1, 6)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('inserts rating and returns summary', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [] }) // upsert
      .mockResolvedValueOnce({ rows: [{ average: '4.50', count: '10' }] }) // avg
      .mockResolvedValueOnce({ rows: [{ rating: 4 }] }) // user rating

    const result = await rateLocation(10, 5, 4)
    expect(result.average).toBe(4.5)
    expect(result.count).toBe(10)
    expect(result.userRating).toBe(4)

    const [upsertSql] = mockDb.query.mock.calls[0]
    expect(upsertSql).toContain('INSERT INTO location_ratings')
    expect(upsertSql).toContain('ON CONFLICT')
  })

  it('accepts boundary values 1 and 5', async () => {
    mockDb.query
      .mockResolvedValue({ rows: [{ average: '1.00', count: '1' }] })

    await expect(rateLocation(1, 1, 1)).resolves.toBeDefined()
    vi.clearAllMocks()
    mockDb.query.mockResolvedValue({ rows: [{ average: '5.00', count: '1' }] })
    await expect(rateLocation(1, 1, 5)).resolves.toBeDefined()
  })
})

describe('getRatingSummary', () => {
  it('returns average and count with null userRating when no userId', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ average: '3.75', count: '8' }] })

    const result = await getRatingSummary(10)
    expect(result.average).toBe(3.75)
    expect(result.count).toBe(8)
    expect(result.userRating).toBeNull()
    expect(mockDb.query).toHaveBeenCalledTimes(1)
  })

  it('returns userRating when userId provided and row found', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ average: '4.00', count: '5' }] })
      .mockResolvedValueOnce({ rows: [{ rating: 3 }] })

    const result = await getRatingSummary(10, 7)
    expect(result.userRating).toBe(3)
  })

  it('returns null userRating when user has not rated', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ average: '4.00', count: '5' }] })
      .mockResolvedValueOnce({ rows: [] })

    const result = await getRatingSummary(10, 7)
    expect(result.userRating).toBeNull()
  })

  it('returns 0 average when no ratings exist', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ average: '0', count: '0' }] })

    const result = await getRatingSummary(99)
    expect(result.average).toBe(0)
    expect(result.count).toBe(0)
  })
})
