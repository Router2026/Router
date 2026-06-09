import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/raw-client', () => ({
  rawDb: { query: vi.fn() },
}))

import { rawDb } from '@/lib/db/raw-client'
import { fetchBucketPois, toTspNodes } from './bucket-db'
import type { BucketPoi } from './types'

const mockDb = rawDb as { query: ReturnType<typeof vi.fn> }

const sampleRow = {
  id: '1',
  name: 'Ein Gedi',
  description: 'Desert oasis',
  category: 'hiking_trail',
  region: 'Dead Sea',
  latitude: '31.46',
  longitude: '35.39',
  duration_minutes: 120,
  difficulty: 'moderate',
  has_water: true,
  has_shade: true,
  accessible: false,
  average_rating: '4.5',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchBucketPois', () => {
  it('returns empty array for empty ids', async () => {
    const result = await fetchBucketPois([])
    expect(result).toEqual([])
    expect(mockDb.query).not.toHaveBeenCalled()
  })

  it('queries with provided ids and maps rows', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [sampleRow] })
    const result = await fetchBucketPois(['1'])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
    expect(result[0].name).toBe('Ein Gedi')
    expect(result[0].latitude).toBe(31.46)
    expect(result[0].longitude).toBe(35.39)
    expect(result[0].has_water).toBe(true)
    expect(result[0].accessible).toBe(false)
    const [, params] = mockDb.query.mock.calls[0]
    expect(params).toEqual([['1']])
  })

  it('parses numeric strings to numbers', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [sampleRow] })
    const [poi] = await fetchBucketPois(['1'])
    expect(typeof poi.latitude).toBe('number')
    expect(typeof poi.longitude).toBe('number')
    expect(typeof poi.average_rating).toBe('number')
  })

  it('returns multiple pois', async () => {
    const row2 = { ...sampleRow, id: '2', name: 'Masada' }
    mockDb.query.mockResolvedValueOnce({ rows: [sampleRow, row2] })
    const result = await fetchBucketPois(['1', '2'])
    expect(result).toHaveLength(2)
    expect(result[1].name).toBe('Masada')
  })
})

describe('toTspNodes', () => {
  const poi: BucketPoi = {
    id: '1',
    name: 'Ein Gedi',
    description: 'Desert oasis',
    category: 'hiking_trail',
    region: 'Dead Sea',
    latitude: 31.46,
    longitude: 35.39,
    duration_minutes: 120,
    difficulty: 'moderate',
    has_water: true,
    has_shade: true,
    accessible: false,
    average_rating: 4.5,
  }

  it('maps BucketPoi to TspNode shape', () => {
    const nodes = toTspNodes([poi])
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toEqual({
      id: '1',
      name: 'Ein Gedi',
      latitude: 31.46,
      longitude: 35.39,
      duration_minutes: 120,
    })
  })

  it('returns empty array for empty input', () => {
    expect(toTspNodes([])).toEqual([])
  })

  it('preserves order', () => {
    const poi2 = { ...poi, id: '2', name: 'Masada' }
    const nodes = toTspNodes([poi, poi2])
    expect(nodes[0].id).toBe('1')
    expect(nodes[1].id).toBe('2')
  })
})
