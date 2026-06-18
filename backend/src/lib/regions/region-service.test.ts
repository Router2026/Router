import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/raw-client', () => ({
  rawDb: { query: vi.fn() },
}))
vi.mock('@/lib/cache/mem-cache', () => ({
  cacheGet: vi.fn().mockReturnValue(null),
  cacheSet: vi.fn(),
}))

import { rawDb } from '@/lib/db/raw-client'
import { cacheGet, cacheSet } from '@/lib/cache/mem-cache'
import { getAllRegions, getRegionBySlug, getRegionIdByName } from './region-service'

const mockDb = rawDb as unknown as { query: ReturnType<typeof vi.fn> }
const mockCacheGet = cacheGet as ReturnType<typeof vi.fn>
const mockCacheSet = cacheSet as ReturnType<typeof vi.fn>

const sampleRegion = {
  id: 1, name: 'צפון', name_en: 'North', slug: 'north',
  center_lat: '32.9', center_lng: '35.3', zoom: 10, radius_meters: '50000',
  color: '#4CAF50', polygon_coords: null, created_at: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCacheGet.mockReturnValue(null)
})

describe('getAllRegions', () => {
  it('returns mapped regions from DB', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleRegion] })
    const result = await getAllRegions()
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('north')
    expect(result[0].center_lat).toBe(32.9)
  })

  it('caches result after first DB call', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleRegion] })
    await getAllRegions()
    expect(mockCacheSet).toHaveBeenCalledWith('regions:all', expect.any(Array), 3600)
  })

  it('returns from cache on second call without hitting DB', async () => {
    mockCacheGet.mockReturnValue([sampleRegion])
    await getAllRegions()
    expect(mockDb.query).not.toHaveBeenCalled()
  })
})

describe('getRegionBySlug', () => {
  it('returns region when found', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleRegion] })
    const result = await getRegionBySlug('north')
    expect(result).not.toBeNull()
    expect(result!.name_en).toBe('North')
  })

  it('returns null when not found', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    const result = await getRegionBySlug('unknown-slug')
    expect(result).toBeNull()
  })
})

describe('getRegionIdByName', () => {
  it('returns id when region found', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: 1 }] })
    const result = await getRegionIdByName('צפון')
    expect(result).toBe(1)
  })

  it('returns null when not found', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    const result = await getRegionIdByName('nonexistent')
    expect(result).toBeNull()
  })
})
