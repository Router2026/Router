import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/raw-client', () => ({
  rawDb: { query: vi.fn() },
}))

import { rawDb } from '@/lib/db/raw-client'
import { addFavorite, removeFavorite, getUserFavorites, isFavorite } from './favorites-service'

const mockDb = rawDb as { query: ReturnType<typeof vi.fn> }

const sampleFavorite = {
  id: 1, user_id: 5, location_id: 10, created_at: new Date(),
  name: 'Ein Gedi', category: 'nature', region_name: 'Dead Sea',
  latitude: 31.46, longitude: 35.39, main_image: null, difficulty: 'easy', average_rating: 4.5,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('addFavorite', () => {
  it('inserts and returns new favorite', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [sampleFavorite] })

    const result = await addFavorite(5, 10)
    expect(result).toEqual(sampleFavorite)
    const [sql, params] = mockDb.query.mock.calls[0]
    expect(sql).toContain('INSERT INTO favorites')
    expect(params).toContain(5)
    expect(params).toContain(10)
  })

  it('fetches existing when conflict (DO NOTHING returns empty)', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [sampleFavorite] })

    const result = await addFavorite(5, 10)
    expect(result).toEqual(sampleFavorite)
    expect(mockDb.query).toHaveBeenCalledTimes(2)
    const [fetchSql] = mockDb.query.mock.calls[1]
    expect(fetchSql).toContain('SELECT * FROM favorites')
  })
})

describe('removeFavorite', () => {
  it('calls DELETE with correct params', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] })

    await removeFavorite(5, 10)
    const [sql, params] = mockDb.query.mock.calls[0]
    expect(sql).toContain('DELETE FROM favorites')
    expect(params).toEqual([5, 10])
  })
})

describe('getUserFavorites', () => {
  it('returns array of favorites with joined location data', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [sampleFavorite] })

    const result = await getUserFavorites(5)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Ein Gedi')
    const [sql, params] = mockDb.query.mock.calls[0]
    expect(sql).toContain('JOIN locations')
    expect(params).toContain(5)
  })

  it('returns empty array when user has no favorites', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] })
    const result = await getUserFavorites(99)
    expect(result).toEqual([])
  })
})

describe('isFavorite', () => {
  it('returns true when row found', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ 1: 1 }] })
    const result = await isFavorite(5, 10)
    expect(result).toBe(true)
  })

  it('returns false when no row found', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] })
    const result = await isFavorite(5, 10)
    expect(result).toBe(false)
  })

  it('queries with correct userId and locationId', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] })
    await isFavorite(7, 42)
    const [, params] = mockDb.query.mock.calls[0]
    expect(params).toEqual([7, 42])
  })
})
