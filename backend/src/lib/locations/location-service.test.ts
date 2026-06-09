import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock rawDb and cache
vi.mock('@/lib/db/raw-client', () => ({
  rawDb: { query: vi.fn() },
}))
vi.mock('@/lib/cache/mem-cache', () => ({
  cacheGet: vi.fn().mockReturnValue(null),
  cacheSet: vi.fn(),
}))

import { rawDb } from '@/lib/db/raw-client'
import { cacheGet, cacheSet } from '@/lib/cache/mem-cache'
import {
  getLocations, getLocationById, getLocationsInBounds, upsertLocation,
  getFilteredCount, getLocationMeta, getNearbyLocations, getFeaturedLocations,
  getNearbyUserLocations, getLocationClusters, getTotalCount,
  updateLocation, deleteLocation,
} from './location-service'

const mockDb = rawDb as { query: ReturnType<typeof vi.fn> }
const mockCacheGet = cacheGet as ReturnType<typeof vi.fn>
const mockCacheSet = cacheSet as ReturnType<typeof vi.fn>

const sampleRow = {
  id: 1, name: 'Ein Gedi', description: 'Nature reserve', category: 'טבע',
  region_id: 2, region_name: 'Dead Sea', latitude: '31.46', longitude: '35.39',
  images: '[]', main_image: null, source: 'manual', source_id: null,
  difficulty: 'בינוני', duration_minutes: 120, has_water: true, has_shade: true,
  accessible: false, average_rating: '4.8', created_at: new Date(), updated_at: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCacheGet.mockReturnValue(null)
})

describe('getLocations', () => {
  it('returns locations from DB and caches result', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleRow] })
    const result = await getLocations({})
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Ein Gedi')
    expect(result[0].latitude).toBe(31.46)
    expect(mockCacheSet).toHaveBeenCalled()
  })

  it('returns cached result without hitting DB', async () => {
    const cached = [{ ...sampleRow, id: 99 }]
    mockCacheGet.mockReturnValue(cached)
    const result = await getLocations({})
    expect(result).toBe(cached)
    expect(mockDb.query).not.toHaveBeenCalled()
  })

  it('passes region filter to query', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    await getLocations({ region: 'north' })
    const [sql, params] = mockDb.query.mock.calls[0]
    expect(params).toContainEqual(['north'])  // region is passed as an array
    expect(sql).toContain('slug')
  })

  it('passes search filter to query', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    await getLocations({ search: 'waterfall' })
    const [sql, params] = mockDb.query.mock.calls[0]
    expect(params).toContain('%waterfall%')
    expect(sql).toContain('ILIKE')
  })
})

describe('getLocationById', () => {
  it('returns location when found', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleRow] })
    const result = await getLocationById(1)
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Ein Gedi')
  })

  it('returns null when not found', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    const result = await getLocationById(999)
    expect(result).toBeNull()
  })

  it('returns cached result without hitting DB', async () => {
    mockCacheGet.mockReturnValue(sampleRow)
    await getLocationById(1)
    expect(mockDb.query).not.toHaveBeenCalled()
  })
})

describe('getLocationsInBounds', () => {
  it('queries with bounds params', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    await getLocationsInBounds({ north: 33, south: 31, east: 36, west: 34 })
    const [sql, params] = mockDb.query.mock.calls[0]
    expect(params).toContain(34) // west
    expect(params).toContain(31) // south
    expect(sql).toContain('ST_Within')
  })
})

describe('upsertLocation', () => {
  it('calls insert with ON CONFLICT', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: 10 }] })
    const id = await upsertLocation({
      name: 'New Place', latitude: 32, longitude: 35, source: 'manual',
    })
    expect(id).toBe(10)
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).toContain('ON CONFLICT')
  })
})

describe('getLocations (filters)', () => {
  it('applies category filter', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    await getLocations({ category: 'hiking_trail,attraction' })
    const [sql, params] = mockDb.query.mock.calls[0]
    expect(sql).toContain('ANY(')
    expect(params).toContainEqual(['hiking_trail', 'attraction'])
  })

  it('applies difficulty filter', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    await getLocations({ difficulty: 'easy' })
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).toContain('difficulty')
  })

  it('applies boolean feature flags', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    await getLocations({ has_water: true, has_shade: true, accessible: true })
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).toContain('has_water = TRUE')
    expect(sql).toContain('has_shade = TRUE')
    expect(sql).toContain('accessible = TRUE')
  })

  it('adds distance column and proximity sort when coords provided', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ ...sampleRow, distance_meters: '1500.5' }] })
    const result = await getLocations({ user_lat: 31.5, user_lng: 35 })
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).toContain('ST_Distance')
    expect(sql).toContain('distance_meters ASC')
    expect(result[0].distance_meters).toBe(1500.5)
  })

  it('adds radius filter when coords and radius provided', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    await getLocations({ user_lat: 31.5, user_lng: 35, radius: 5000 })
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).toContain('ST_DWithin')
  })

  it('applies multi-word search split condition', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    await getLocations({ search: 'מעיין ירושלים' })
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).toContain('AND')
  })
})

describe('getFilteredCount', () => {
  it('returns count from DB', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ n: '42' }] })
    const result = await getFilteredCount({})
    expect(result).toBe(42)
  })

  it('returns cached count without hitting DB', async () => {
    mockCacheGet.mockReturnValue(10)
    const result = await getFilteredCount({})
    expect(result).toBe(10)
    expect(mockDb.query).not.toHaveBeenCalled()
  })

  it('applies radius filter to count query', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ n: '5' }] })
    await getFilteredCount({ user_lat: 31.5, user_lng: 35, radius: 3000 })
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).toContain('ST_DWithin')
  })
})

describe('getLocationMeta', () => {
  it('returns categories, difficulties, and total count', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ categories: ['טבע', 'מורשת'], difficulties: ['easy', 'moderate'], total_count: 150 }],
    })
    const result = await getLocationMeta()
    expect(result.categories).toContain('טבע')
    expect(result.total_count).toBe(150)
    expect(mockCacheSet).toHaveBeenCalled()
  })

  it('returns cached result', async () => {
    const cached = { categories: [], difficulties: [], total_count: 0 }
    mockCacheGet.mockReturnValue(cached)
    const result = await getLocationMeta()
    expect(result).toBe(cached)
    expect(mockDb.query).not.toHaveBeenCalled()
  })
})

describe('getNearbyLocations', () => {
  it('throws NOT_FOUND when location does not exist', async () => {
    mockDb.query.mockResolvedValue({ rows: [] }) // getLocationById returns null
    await expect(getNearbyLocations(999)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('returns nearby locations with distance', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [sampleRow] }) // getLocationById
      .mockResolvedValueOnce({ rows: [{ ...sampleRow, id: 2, distance_meters: '800' }] })
    mockCacheGet.mockReturnValueOnce(null).mockReturnValueOnce(null)
    const result = await getNearbyLocations(1)
    expect(result).toHaveLength(1)
    expect(result[0].distance_meters).toBe(800)
  })

  it('returns cached nearby result', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [sampleRow] }) // getLocationById
    const cached = [{ ...sampleRow, distance_meters: 500 }]
    mockCacheGet.mockReturnValueOnce(null).mockReturnValueOnce(cached)
    const result = await getNearbyLocations(1)
    expect(result).toBe(cached)
  })
})

describe('getFeaturedLocations', () => {
  it('returns featured locations', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleRow] })
    const result = await getFeaturedLocations()
    expect(result).toHaveLength(1)
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).toContain('is_featured = TRUE')
  })

  it('falls back to top-rated when is_featured column missing', async () => {
    const colError = Object.assign(new Error('column missing'), { code: '42703' })
    mockDb.query
      .mockRejectedValueOnce(colError)
      .mockResolvedValueOnce({ rows: [sampleRow] })
    const result = await getFeaturedLocations()
    expect(result).toHaveLength(1)
    expect(mockDb.query).toHaveBeenCalledTimes(2)
  })

  it('rethrows non-column errors', async () => {
    mockDb.query.mockRejectedValue(new Error('connection error'))
    await expect(getFeaturedLocations()).rejects.toThrow('connection error')
  })

  it('returns cached result', async () => {
    mockCacheGet.mockReturnValue([sampleRow])
    await getFeaturedLocations()
    expect(mockDb.query).not.toHaveBeenCalled()
  })
})

describe('getNearbyUserLocations', () => {
  it('returns locations near user coordinates', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ ...sampleRow, distance_meters: '2000' }] })
    const result = await getNearbyUserLocations(31.5, 35)
    expect(result).toHaveLength(1)
    expect(result[0].distance_meters).toBe(2000)
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).toContain('ST_DWithin')
  })

  it('returns cached result', async () => {
    const cached = [{ ...sampleRow, distance_meters: 100 }]
    mockCacheGet.mockReturnValue(cached)
    const result = await getNearbyUserLocations(31.5, 35)
    expect(result).toBe(cached)
    expect(mockDb.query).not.toHaveBeenCalled()
  })
})

describe('getLocationClusters', () => {
  it('returns clusters without bounds', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ lat: '31.5', lng: '35.0', count: '5', ids: [1, 2, 3, 4, 5], category: 'טבע' }],
    })
    const result = await getLocationClusters()
    expect(result).toHaveLength(1)
    expect(result[0].count).toBe(5)
    expect(result[0].lat).toBe(31.5)
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).not.toContain('WHERE')
  })

  it('adds WHERE clause when bounds provided', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    await getLocationClusters({ north: 33, south: 31, east: 36, west: 34 })
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).toContain('WHERE ST_Within')
  })
})

describe('getTotalCount', () => {
  it('returns total count of locations', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ count: '350' }] })
    const result = await getTotalCount()
    expect(result).toBe(350)
  })
})

describe('updateLocation', () => {
  it('updates allowed fields and returns location', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleRow] })
    const result = await updateLocation(1, { name: 'Updated Name', difficulty: 'easy' })
    expect(result.name).toBe('Ein Gedi')
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).toContain('UPDATE locations')
    expect(sql).toContain('name = $')
  })

  it('throws VALIDATION_ERROR when no fields provided', async () => {
    await expect(updateLocation(1, {})).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('throws NOT_FOUND when location does not exist', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    await expect(updateLocation(999, { name: 'X' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('serializes images array to JSON', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleRow] })
    await updateLocation(1, { images: ['img1.jpg', 'img2.jpg'] })
    const [, params] = mockDb.query.mock.calls[0]
    expect(params).toContain(JSON.stringify(['img1.jpg', 'img2.jpg']))
  })
})

describe('deleteLocation', () => {
  it('returns true when location was deleted', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: 1 }] })
    const result = await deleteLocation(1)
    expect(result).toBe(true)
  })

  it('returns false when location not found', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    const result = await deleteLocation(999)
    expect(result).toBe(false)
  })
})

describe('rowToLocation image/main_image branches', () => {
  it('uses images array directly when already an array', async () => {
    const rowWithArrayImages = {
      ...sampleRow,
      images: ['img1.jpg', 'img2.jpg'],  // already an array — covers Array.isArray branch
      main_image: null,
    }
    mockDb.query.mockResolvedValue({ rows: [rowWithArrayImages] })
    const result = await getLocationById(1)
    expect(result!.main_image).toBe('img1.jpg')   // covers images[0] fallback
    expect(result!.images).toEqual(['img1.jpg', 'img2.jpg'])
  })

  it('falls back to empty string when images is empty and main_image is null', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ ...sampleRow, images: '[]', main_image: null }] })
    const result = await getLocationById(1)
    expect(result!.main_image).toBe('')
  })
})
