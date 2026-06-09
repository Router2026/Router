import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../api', () => ({
  api: {
    regions: { list: vi.fn() },
    locations: {
      list: vi.fn(),
      get: vi.fn(),
      getNearby: vi.fn(),
      getFeatured: vi.fn(),
      getNearbyUser: vi.fn(),
    },
  },
}))

// Mock geolocation
const mockGetCurrentPosition = vi.fn()
vi.stubGlobal('navigator', {
  geolocation: {
    getCurrentPosition: mockGetCurrentPosition,
  },
})

import { api } from '../api'
import {
  locationKeys,
  useRegions,
  useLocationsByRegion,
  useLocation,
  useNearbyLocations,
  useFeaturedLocations,
  useLocationMeta,
  useNearbyUserLocations,
} from './useLocations'

const mockApi = api as {
  regions: { list: ReturnType<typeof vi.fn> }
  locations: {
    list: ReturnType<typeof vi.fn>
    get: ReturnType<typeof vi.fn>
    getNearby: ReturnType<typeof vi.fn>
    getFeatured: ReturnType<typeof vi.fn>
    getNearbyUser: ReturnType<typeof vi.fn>
  }
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  return Wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── locationKeys ──────────────────────────────────────────────────────────────

describe('locationKeys', () => {
  it('all() returns stable key', () => {
    expect(locationKeys.all()).toEqual(['locations'])
  })

  it('lists() includes "list" segment', () => {
    expect(locationKeys.lists()).toEqual(['locations', 'list'])
  })

  it('list(params) appends params', () => {
    const key = locationKeys.list({ region: 'north' })
    expect(key).toEqual(['locations', 'list', { region: 'north' }])
  })

  it('detail(id) stringifies numeric id', () => {
    expect(locationKeys.detail(42)).toEqual(['locations', 'detail', '42'])
  })

  it('detail(id) accepts string id', () => {
    expect(locationKeys.detail('abc')).toEqual(['locations', 'detail', 'abc'])
  })

  it('nearby(id) stringifies id', () => {
    expect(locationKeys.nearby(7)).toEqual(['locations', 'nearby', '7'])
  })

  it('featured() returns stable key', () => {
    expect(locationKeys.featured()).toEqual(['locations', 'featured'])
  })

  it('meta() returns stable key', () => {
    expect(locationKeys.meta()).toEqual(['locations', 'meta'])
  })

  it('regions() returns regions key', () => {
    expect(locationKeys.regions()).toEqual(['regions'])
  })
})

// ── useRegions ────────────────────────────────────────────────────────────────

describe('useRegions', () => {
  it('fetches regions on mount', async () => {
    mockApi.regions.list.mockResolvedValue([{ id: 1, name: 'north' }])
    const { result } = renderHook(() => useRegions(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: 1, name: 'north' }])
  })
})

// ── useLocationsByRegion ──────────────────────────────────────────────────────

describe('useLocationsByRegion', () => {
  it('is disabled when regionName is null', () => {
    const { result } = renderHook(() => useLocationsByRegion(null), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches when regionName is provided', async () => {
    mockApi.locations.list.mockResolvedValue([{ id: '1', name: 'POI' }])
    const { result } = renderHook(() => useLocationsByRegion('north'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.locations.list).toHaveBeenCalledWith({ region: 'north', limit: 100 })
  })
})

// ── useLocation ───────────────────────────────────────────────────────────────

describe('useLocation', () => {
  it('is disabled when id is null', () => {
    const { result } = renderHook(() => useLocation(null), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches location when id is provided', async () => {
    mockApi.locations.get.mockResolvedValue({ id: '42', name: 'Test POI' })
    const { result } = renderHook(() => useLocation('42'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.locations.get).toHaveBeenCalledWith('42')
  })
})

// ── useNearbyLocations ────────────────────────────────────────────────────────

describe('useNearbyLocations', () => {
  it('is disabled when id is null', () => {
    const { result } = renderHook(() => useNearbyLocations(null), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches nearby with default limit', async () => {
    mockApi.locations.getNearby.mockResolvedValue([])
    const { result } = renderHook(() => useNearbyLocations(5), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.locations.getNearby).toHaveBeenCalledWith(5, 6)
  })

  it('fetches nearby with custom limit', async () => {
    mockApi.locations.getNearby.mockResolvedValue([])
    const { result } = renderHook(() => useNearbyLocations(5, 10), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.locations.getNearby).toHaveBeenCalledWith(5, 10)
  })
})

// ── useFeaturedLocations ──────────────────────────────────────────────────────

describe('useFeaturedLocations', () => {
  it('fetches featured locations with default limit', async () => {
    mockApi.locations.getFeatured.mockResolvedValue([])
    const { result } = renderHook(() => useFeaturedLocations(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.locations.getFeatured).toHaveBeenCalledWith(10)
  })

  it('fetches featured locations with custom limit', async () => {
    mockApi.locations.getFeatured.mockResolvedValue([])
    const { result } = renderHook(() => useFeaturedLocations(5), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.locations.getFeatured).toHaveBeenCalledWith(5)
  })
})

// ── useNearbyUserLocations ────────────────────────────────────────────────────

describe('useNearbyUserLocations', () => {
  it('fetches nearby user locations when geolocation succeeds', async () => {
    mockGetCurrentPosition.mockImplementation((success: (p: GeolocationPosition) => void) => {
      success({ coords: { latitude: 32.123, longitude: 34.567 } } as GeolocationPosition)
    })
    mockApi.locations.getNearbyUser.mockResolvedValue([])

    const { result } = renderHook(() => useNearbyUserLocations(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Coords are rounded to 2 decimal places
    expect(mockApi.locations.getNearbyUser).toHaveBeenCalledWith(32.12, 34.57, 10, 30000)
  })

  it('sets geoError when geolocation is denied', async () => {
    mockGetCurrentPosition.mockImplementation(
      (_success: unknown, error: () => void) => { error() }
    )

    const { result } = renderHook(() => useNearbyUserLocations(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.geoError).toBe('לא אושרה גישה למיקום'))
  })

  it('sets geoError when geolocation is unavailable', async () => {
    vi.stubGlobal('navigator', { geolocation: undefined })

    const { result } = renderHook(() => useNearbyUserLocations(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.geoError).toBe('מיקום אינו נתמך בדפדפן זה'))

    // Restore
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: mockGetCurrentPosition } })
  })

  it('is not fetching while coords are null', () => {
    mockGetCurrentPosition.mockImplementation(() => { /* never calls success */ })
    const { result } = renderHook(() => useNearbyUserLocations(), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('accepts custom limit and radius', async () => {
    mockGetCurrentPosition.mockImplementation((success: (p: GeolocationPosition) => void) => {
      success({ coords: { latitude: 31, longitude: 35 } } as GeolocationPosition)
    })
    mockApi.locations.getNearbyUser.mockResolvedValue([])

    const { result } = renderHook(() => useNearbyUserLocations(5, 10000), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.locations.getNearbyUser).toHaveBeenCalledWith(31, 35, 5, 10000)
  })
})

// ── useLocationMeta ───────────────────────────────────────────────────────────

describe('useLocationMeta', () => {
  it('fetches location meta', async () => {
    const meta = { categories: ['a'], difficulties: ['easy'], total_count: 10 }
    const mockFetchFn = vi.fn().mockResolvedValue({
      json: async () => ({ data: meta }),
    })
    vi.stubGlobal('fetch', mockFetchFn)

    const { result } = renderHook(() => useLocationMeta(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(meta)
  })
})
