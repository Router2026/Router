import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/raw-client', () => ({
  rawDb: { query: vi.fn() },
}))

import { rawDb } from '@/lib/db/raw-client'
import { getCurrentUser, getLeaderboard, getStats } from './user-service'

const mockDb = rawDb as unknown as { query: ReturnType<typeof vi.fn> }

const sampleUser = {
  id: 1, email: 'alice@test.com', full_name: 'Alice', display_name: 'Alice',
  xp_points: 500, level: 'חוקר', reports_count: 3, reviews_count: 5, trips_count: 2,
  created_at: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getCurrentUser', () => {
  it('returns user when found', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleUser] })
    const result = await getCurrentUser()
    expect(result).not.toBeNull()
    expect(result!.email).toBe('alice@test.com')
  })

  it('returns null when no user found', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    const result = await getCurrentUser()
    expect(result).toBeNull()
  })
})

describe('getLeaderboard', () => {
  it('returns users sorted by XP from DB', async () => {
    const users = [
      { ...sampleUser, id: 1, xp_points: 1000 },
      { ...sampleUser, id: 2, xp_points: 500 },
    ]
    mockDb.query.mockResolvedValue({ rows: users })
    const result = await getLeaderboard()
    expect(result).toHaveLength(2)
    expect(result[0].xp_points).toBe(1000)
    const [sql] = mockDb.query.mock.calls[0]
    const normalSql = sql.replace(/\s+/g, ' ')
    expect(normalSql).toContain('ORDER BY xp_points DESC')
    expect(normalSql).toContain('LIMIT 50')
  })

  it('returns mock fallback data when DB is empty', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    const result = await getLeaderboard()
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].xp_points).toBeGreaterThan(result[1].xp_points)
  })
})

describe('getStats', () => {
  it('returns aggregate stats', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ total_locations: 200, total_regions: 8, average_rating: '4.7' }],
    })
    const result = await getStats()
    expect(result.total_locations).toBe(200)
    expect(result.total_regions).toBe(8)
    expect(result.average_rating).toBe(4.7)
  })

  it('returns defaults when DB returns null values', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ total_locations: 0, total_regions: 0, average_rating: null }],
    })
    const result = await getStats()
    expect(result.average_rating).toBe(4.8) // default fallback
  })
})

describe('rowToUser edge cases', () => {
  it('falls back to username as display_name when full_name is absent', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ ...sampleUser, full_name: null, username: 'alice123', xp_points: 0 }],
    })
    const result = await getCurrentUser()
    expect(result!.display_name).toBe('alice123')
  })

  it('falls back to levelLabel when level column is empty', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ ...sampleUser, level: null, xp_points: 0 }],
    })
    const result = await getCurrentUser()
    expect(result!.level).toBe('מטייל מתחיל')
  })

  it('computes level_number from xp', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ ...sampleUser, xp_points: 50 }],
    })
    const result = await getCurrentUser()
    expect(result!.level_number).toBe(1) // floor(sqrt(50/50)) = 1
  })

  it('uses xp_points when xp field is not a parseable number', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ ...sampleUser, xp: null, xp_points: 200 }],
    })
    const result = await getCurrentUser()
    expect(result!.xp).toBe(200)
  })
})
