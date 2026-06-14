import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/raw-client', () => ({
  rawDb: { query: vi.fn() },
}))

import { rawDb } from '@/lib/db/raw-client'
import { getRoutes, getRouteById, createRoute, deleteRoute } from './route-service'

const mockDb = rawDb as { query: ReturnType<typeof vi.fn> }

const sampleRoute = {
  id: 1, name: 'Galilee Loop', description: null, region_id: 1,
  region: 'צפון', user_id: 5, total_duration_hours: '6',
  difficulty: 'בינוני', group_type: 'משפחה', style: 'טבע',
  created_at: new Date(),
}

const sampleStop = {
  id: 10, route_id: 1, location_id: 100, poi_name: 'Ein Gedi',
  order_index: 0, arrival_time: '09:00', duration_minutes: 90,
  smart_insight: null, location_name: 'Ein Gedi',
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('getRoutes', () => {
  it('returns all routes without userId filter', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [sampleRoute] })
      .mockResolvedValueOnce({ rows: [sampleStop] })
    const result = await getRoutes()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Galilee Loop')
    expect(result[0].total_duration_hours).toBe(6)
    // First query should not have WHERE clause
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).not.toContain('WHERE r.user_id')
  })

  it('filters by userId when provided', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [sampleRoute] })
      .mockResolvedValueOnce({ rows: [] })
    await getRoutes(5)
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).toContain('WHERE r.user_id = $1')
  })

  it('attaches stops to their routes', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [sampleRoute] })
      .mockResolvedValueOnce({ rows: [sampleStop] })
    const result = await getRoutes()
    expect(result[0].stops).toHaveLength(1)
    expect(result[0].stops[0].poi_name).toBe('Ein Gedi')
  })

  it('returns empty array when no routes', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] })
    const result = await getRoutes()
    expect(result).toEqual([])
  })
})

describe('getRouteById', () => {
  it('returns route with stops', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [sampleRoute] })
      .mockResolvedValueOnce({ rows: [sampleStop] })
    const result = await getRouteById(1)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(1)
    expect(result!.stops).toHaveLength(1)
  })

  it('returns null when not found', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] })
    const result = await getRouteById(999)
    expect(result).toBeNull()
  })
})

describe('deleteRoute', () => {
  it('calls DELETE query with correct id', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    await deleteRoute(42)
    const [sql, params] = mockDb.query.mock.calls[0]
    expect(sql).toContain('DELETE FROM routes')
    expect(params).toContain(42)
  })
})

describe('createRoute', () => {
  it('inserts route and stops, returns created route', async () => {
    const newRoute = { ...sampleRoute, id: 2 }
    mockDb.query
      .mockResolvedValueOnce({ rows: [newRoute] })  // INSERT route
      .mockResolvedValueOnce({ rows: [] })           // INSERT stop
      .mockResolvedValueOnce({ rows: [newRoute] })   // getRouteById query 1
      .mockResolvedValueOnce({ rows: [] })           // getRouteById query 2 (stops)

    const result = await createRoute({
      name: 'Test Route',
      stops: [{ order_index: 0, arrival_time: '09:00', duration_minutes: 60, poi_name: 'Stop 1' }],
    })
    expect(result).not.toBeNull()
    const insertCall = mockDb.query.mock.calls[0]
    expect(insertCall[0]).toContain('INSERT INTO routes')
  })

  it('creates route with no stops', async () => {
    const newRoute = { ...sampleRoute, id: 3 }
    mockDb.query
      .mockResolvedValueOnce({ rows: [newRoute] })
      .mockResolvedValueOnce({ rows: [newRoute] })
      .mockResolvedValueOnce({ rows: [] })
    const result = await createRoute({ name: 'Empty Route' })
    expect(result).not.toBeNull()
    expect(mockDb.query).toHaveBeenCalledTimes(3) // INSERT + 2x getRouteById
  })

  it('uses defaults for optional fields', async () => {
    const newRoute = { ...sampleRoute, id: 4 }
    mockDb.query
      .mockResolvedValueOnce({ rows: [newRoute] })
      .mockResolvedValueOnce({ rows: [newRoute] })
      .mockResolvedValueOnce({ rows: [] })
    await createRoute({})
    const [, params] = mockDb.query.mock.calls[0]
    expect(params[0]).toBe('מסלול חדש')   // default name
    expect(params[4]).toBe('בינוני')       // default difficulty
  })

  it('throws when getRouteById returns null after insert', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ ...sampleRoute, id: 5 }] }) // INSERT
      .mockResolvedValueOnce({ rows: [] })                           // getRouteById → null
    await expect(createRoute({ name: 'Broken' })).rejects.toThrow('Failed to retrieve created route')
  })

  it('inserts multiple stops with correct order_index', async () => {
    const newRoute = { ...sampleRoute, id: 6 }
    const stops = [
      { order_index: 0, arrival_time: '09:00', duration_minutes: 60 },
      { order_index: 1, arrival_time: '11:00', duration_minutes: 90 },
    ]
    mockDb.query
      .mockResolvedValueOnce({ rows: [newRoute] })  // INSERT route
      .mockResolvedValueOnce({ rows: [] })           // Bulk INSERT both stops (single query)
      .mockResolvedValueOnce({ rows: [newRoute] })   // getRouteById routes
      .mockResolvedValueOnce({ rows: [] })           // getRouteById stops
    await createRoute({ name: 'Multi-stop', stops })
    // call 0 = INSERT route, call 1 = single bulk INSERT for all stops
    // params layout per stop (7 each): [routeId, loc_id, poi_name, order_index, arrival, duration, insight]
    const bulkParams = mockDb.query.mock.calls[1][1] as unknown[]
    expect(bulkParams[3]).toBe(0)   // first stop order_index (param index 3)
    expect(bulkParams[10]).toBe(1)  // second stop order_index (param index 10)
  })
})

describe('stop poi_name fallback branches', () => {
  it('getRoutes: uses location_name when poi_name is null', async () => {
    const stopWithNoPoiName = { ...sampleStop, poi_name: null, location_name: 'Fallback Name' }
    mockDb.query
      .mockResolvedValueOnce({ rows: [sampleRoute] })
      .mockResolvedValueOnce({ rows: [stopWithNoPoiName] })
    const result = await getRoutes()
    expect(result[0].stops[0].poi_name).toBe('Fallback Name')
  })

  it('getRoutes: uses empty string when both poi_name and location_name are null', async () => {
    const stopBothNull = { ...sampleStop, poi_name: null, location_name: null }
    mockDb.query
      .mockResolvedValueOnce({ rows: [sampleRoute] })
      .mockResolvedValueOnce({ rows: [stopBothNull] })
    const result = await getRoutes()
    expect(result[0].stops[0].poi_name).toBe('')
  })

  it('getRouteById: uses location_name when poi_name is null', async () => {
    const stopWithNoPoiName = { ...sampleStop, poi_name: null, location_name: 'Named via loc', latitude: null, longitude: null }
    mockDb.query
      .mockResolvedValueOnce({ rows: [sampleRoute] })
      .mockResolvedValueOnce({ rows: [stopWithNoPoiName] })
    const result = await getRouteById(1)
    expect(result!.stops[0].poi_name).toBe('Named via loc')
  })
})
