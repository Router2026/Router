import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/raw-client', () => ({
  rawDb: { query: vi.fn() },
}))

import { rawDb } from '@/lib/db/raw-client'
import { getReviews, createReview } from './review-service'

const mockDb = rawDb as { query: ReturnType<typeof vi.fn> }

const sampleReview = {
  id: 1, user_id: 5, location_id: 10, poi_name: 'Ein Gedi',
  reviewer_name: 'Alice', rating: 5, content: 'Amazing!', created_at: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getReviews', () => {
  it('returns all reviews without filter', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleReview] })
    const result = await getReviews()
    expect(result).toHaveLength(1)
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).not.toContain('WHERE')
  })

  it('filters by locationId when provided', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleReview] })
    await getReviews(10)
    const [sql, params] = mockDb.query.mock.calls[0]
    expect(sql).toContain('WHERE location_id = $1')
    expect(params).toContain(10)
  })

  it('returns empty array when no reviews', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    const result = await getReviews()
    expect(result).toEqual([])
  })
})

describe('createReview', () => {
  it('inserts review and returns it', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleReview] })
    const result = await createReview({
      user_id: 5, location_id: 10, reviewer_name: 'Alice', rating: 5, content: 'Amazing!',
    })
    expect(result).toEqual(sampleReview)
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).toContain('INSERT INTO reviews')
  })

  it('awards 20 XP to user after creating review', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleReview] })
    await createReview({
      user_id: 5, location_id: 10, reviewer_name: 'Alice', rating: 4, content: 'Good',
    })
    expect(mockDb.query).toHaveBeenCalledTimes(2)
    const [xpSql, xpParams] = mockDb.query.mock.calls[1]
    expect(xpSql).toContain('xp_points')
    expect(xpSql).toContain('+ 20')
    expect(xpParams).toContain(5)
  })

  it('does not update XP when user_id is null', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleReview] })
    await createReview({
      location_id: 10, reviewer_name: 'Anonymous', rating: 3, content: 'OK',
    })
    expect(mockDb.query).toHaveBeenCalledTimes(1)
  })
})
