import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../api', () => ({
  api: {
    users: {
      me: vi.fn(),
      updateMe: vi.fn(),
      leaderboard: vi.fn(),
      stats: vi.fn(),
    },
    userProfiles: {
      get: vi.fn(),
    },
    communityPois: {
      myPlaces: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { api } from '../api'
import {
  userKeys,
  useMe,
  useUpdateMe,
  usePublicUserProfile,
  useMyPlaces,
  useDeleteMyPlace,
  useUpdateMyPlace,
  useLeaderboard,
  useAppStats,
  useInvalidateMe,
} from './useUserProfile'

const mockApi = api as {
  users: {
    me: ReturnType<typeof vi.fn>
    updateMe: ReturnType<typeof vi.fn>
    leaderboard: ReturnType<typeof vi.fn>
    stats: ReturnType<typeof vi.fn>
  }
  userProfiles: { get: ReturnType<typeof vi.fn> }
  communityPois: {
    myPlaces: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

const mockProfile = { id: 1, username: 'user', email: 'u@u.com', xp_points: 100, level: 'explorer', avatar_url: null, full_name: 'User', created_at: '2024-01-01' }
const mockPlace = (id: number) => ({ id, name: `Place ${id}`, status: 'pending', created_at: '2024-01-01', user_id: 1, latitude: 31.5, longitude: 34.8, category: 'טבע', description: '', photos: [] })

beforeEach(() => {
  vi.clearAllMocks()
})

// ── userKeys ──────────────────────────────────────────────────────────────────

describe('userKeys', () => {
  it('all() is stable', () => { expect(userKeys.all()).toEqual(['users']) })
  it('me() is stable', () => { expect(userKeys.me()).toEqual(['users', 'me']) })
  it('public(id) includes id', () => { expect(userKeys.public(5)).toEqual(['users', 'public', 5]) })
  it('myPlaces() is stable', () => { expect(userKeys.myPlaces()).toEqual(['users', 'myPlaces']) })
  it('leaderboard() is stable', () => { expect(userKeys.leaderboard()).toEqual(['users', 'leaderboard']) })
  it('stats() is stable', () => { expect(userKeys.stats()).toEqual(['users', 'stats']) })
})

// ── useMe ─────────────────────────────────────────────────────────────────────

describe('useMe', () => {
  it('fetches own profile', async () => {
    mockApi.users.me.mockResolvedValue(mockProfile)
    const { result } = renderHook(() => useMe(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockProfile)
  })

  it('does not fetch when disabled', () => {
    mockApi.users.me.mockResolvedValue(mockProfile)
    renderHook(() => useMe(false), { wrapper: makeWrapper() })
    expect(mockApi.users.me).not.toHaveBeenCalled()
  })

  it('handles error', async () => {
    mockApi.users.me.mockRejectedValue(new Error('Unauthorized'))
    const { result } = renderHook(() => useMe(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ── useUpdateMe ───────────────────────────────────────────────────────────────

describe('useUpdateMe', () => {
  it('calls updateMe api', async () => {
    const updated = { ...mockProfile, username: 'newname' }
    mockApi.users.updateMe.mockResolvedValue(updated)

    const { result } = renderHook(() => useUpdateMe(), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync({ username: 'newname' } as Parameters<typeof api.users.updateMe>[0])
    })

    expect(mockApi.users.updateMe).toHaveBeenCalledWith({ username: 'newname' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(updated)
  })
})

// ── usePublicUserProfile ──────────────────────────────────────────────────────

describe('usePublicUserProfile', () => {
  it('fetches public profile by id', async () => {
    const profileData = { profile: mockProfile, trips: [], community_pois: [] }
    mockApi.userProfiles.get.mockResolvedValue(profileData)

    const { result } = renderHook(() => usePublicUserProfile(42), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.userProfiles.get).toHaveBeenCalledWith(42)
  })

  it('does not fetch when id is null', () => {
    renderHook(() => usePublicUserProfile(null), { wrapper: makeWrapper() })
    expect(mockApi.userProfiles.get).not.toHaveBeenCalled()
  })

  it('does not fetch when id is 0', () => {
    renderHook(() => usePublicUserProfile(0), { wrapper: makeWrapper() })
    expect(mockApi.userProfiles.get).not.toHaveBeenCalled()
  })
})

// ── useMyPlaces ───────────────────────────────────────────────────────────────

describe('useMyPlaces', () => {
  it('fetches my places', async () => {
    mockApi.communityPois.myPlaces.mockResolvedValue([mockPlace(1), mockPlace(2)])
    const { result } = renderHook(() => useMyPlaces(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
  })

  it('does not fetch when disabled', () => {
    renderHook(() => useMyPlaces(false), { wrapper: makeWrapper() })
    expect(mockApi.communityPois.myPlaces).not.toHaveBeenCalled()
  })
})

// ── useDeleteMyPlace ──────────────────────────────────────────────────────────

describe('useDeleteMyPlace', () => {
  it('removes place from cache on success', async () => {
    mockApi.communityPois.myPlaces.mockResolvedValue([mockPlace(1), mockPlace(2)])
    mockApi.communityPois.delete.mockResolvedValue(undefined)

    const wrapper = makeWrapper()
    const { result: placesResult } = renderHook(() => useMyPlaces(), { wrapper })
    await waitFor(() => expect(placesResult.current.data).toHaveLength(2))

    const { result } = renderHook(() => useDeleteMyPlace(), { wrapper })
    await act(async () => { await result.current.mutateAsync(1) })

    await waitFor(() => expect(placesResult.current.data).toHaveLength(1))
    expect(placesResult.current.data?.[0].id).toBe(2)
  })

  it('handles delete error', async () => {
    mockApi.communityPois.delete.mockRejectedValue(new Error('not found'))
    const { result } = renderHook(() => useDeleteMyPlace(), { wrapper: makeWrapper() })

    await act(async () => {
      try { await result.current.mutateAsync(99) } catch { /* expected */ }
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ── useUpdateMyPlace ──────────────────────────────────────────────────────────

describe('useUpdateMyPlace', () => {
  it('patches place in cache on success', async () => {
    const originalPlace = mockPlace(1)
    const updatedPlace = { ...originalPlace, name: 'Updated Name' }
    mockApi.communityPois.myPlaces.mockResolvedValue([originalPlace, mockPlace(2)])
    mockApi.communityPois.update.mockResolvedValue(updatedPlace)

    const wrapper = makeWrapper()
    const { result: placesResult } = renderHook(() => useMyPlaces(), { wrapper })
    await waitFor(() => expect(placesResult.current.data).toHaveLength(2))

    const { result } = renderHook(() => useUpdateMyPlace(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ id: 1, data: { name: 'Updated Name' } as Parameters<typeof api.communityPois.update>[1] })
    })

    await waitFor(() => expect(placesResult.current.data?.find(p => p.id === 1)?.name).toBe('Updated Name'))
  })
})

// ── useLeaderboard ────────────────────────────────────────────────────────────

describe('useLeaderboard', () => {
  it('fetches leaderboard', async () => {
    mockApi.users.leaderboard.mockResolvedValue([mockProfile])
    const { result } = renderHook(() => useLeaderboard(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })
})

// ── useAppStats ───────────────────────────────────────────────────────────────

describe('useAppStats', () => {
  it('fetches app stats', async () => {
    const stats = { total_locations: 5000, total_regions: 10, average_rating: 4.8 }
    mockApi.users.stats.mockResolvedValue(stats)
    const { result } = renderHook(() => useAppStats(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(stats)
  })
})

// ── useInvalidateMe ───────────────────────────────────────────────────────────

describe('useInvalidateMe', () => {
  it('returns a function that does not throw', () => {
    mockApi.users.me.mockResolvedValue(mockProfile)
    const { result } = renderHook(() => useInvalidateMe(), { wrapper: makeWrapper() })
    expect(() => result.current()).not.toThrow()
  })
})
