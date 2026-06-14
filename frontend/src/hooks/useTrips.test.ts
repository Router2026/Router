import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../api', () => ({
  api: {
    trips: {
      list: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
    },
    publicTrips: {
      list: vi.fn(),
      get: vi.fn(),
      getLikes: vi.fn(),
      toggleLike: vi.fn(),
      getRating: vi.fn(),
      setRating: vi.fn(),
      getComments: vi.fn(),
      addComment: vi.fn(),
      deleteComment: vi.fn(),
      getImages: vi.fn(),
      getCommunityMedia: vi.fn(),
      addCommunityMedia: vi.fn(),
      deleteCommunityMedia: vi.fn(),
    },
  },
}))

import { api } from '../api'
import {
  tripKeys,
  useMyRoutes,
  useRoute,
  useDeleteRoute,
  usePublicTrips,
  usePublicTrip,
  useTripLikes,
  useToggleTripLike,
  useTripRating,
  useSetTripRating,
  useTripComments,
  useAddTripComment,
  useDeleteTripComment,
  useTripImages,
  useTripCommunityMedia,
  useAddTripCommunityMedia,
  useDeleteTripCommunityMedia,
  useInvalidateTrip,
} from './useTrips'

const mockApi = api as {
  trips: {
    list: ReturnType<typeof vi.fn>
    get: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
  publicTrips: {
    list: ReturnType<typeof vi.fn>
    get: ReturnType<typeof vi.fn>
    getLikes: ReturnType<typeof vi.fn>
    toggleLike: ReturnType<typeof vi.fn>
    getRating: ReturnType<typeof vi.fn>
    setRating: ReturnType<typeof vi.fn>
    getComments: ReturnType<typeof vi.fn>
    addComment: ReturnType<typeof vi.fn>
    deleteComment: ReturnType<typeof vi.fn>
    getImages: ReturnType<typeof vi.fn>
    getCommunityMedia: ReturnType<typeof vi.fn>
    addCommunityMedia: ReturnType<typeof vi.fn>
    deleteCommunityMedia: ReturnType<typeof vi.fn>
  }
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

const mockTrip = (id: string) => ({
  id,
  name: `Trip ${id}`,
  stops: [],
  created_at: '2024-01-01',
  user_id: 1,
  description: '',
})

const mockPublicTrip = (id: number) => ({
  id,
  title: `Public Trip ${id}`,
  stops: [],
  created_at: '2024-01-01',
  user_id: 1,
  username: 'user',
  difficulty: 'easy',
  style: 'hiking',
  region: 'north',
  is_published: true,
})

const mockComment = (id: number) => ({ id, trip_id: 1, user_id: 1, username: 'user', content: `Comment ${id}`, created_at: '2024-01-01' })
const mockImage = (id: number) => ({ id, trip_id: 1, url: `https://img/${id}`, uploaded_by: 1, created_at: '2024-01-01' })
const mockMedia = (id: number) => ({ id, trip_id: 1, url: `https://media/${id}`, media_type: 'image' as const, caption: '', user_id: 1, created_at: '2024-01-01' })

beforeEach(() => { vi.clearAllMocks() })

// ── tripKeys ──────────────────────────────────────────────────────────────────

describe('tripKeys', () => {
  it('routes()', () => { expect(tripKeys.routes()).toEqual(['routes']) })
  it('route(id)', () => { expect(tripKeys.route('abc')).toEqual(['routes', 'abc']) })
  it('publicList({})', () => { expect(tripKeys.publicList({})).toEqual(['publicTrips', 'list', {}]) })
  it('publicDetail(1)', () => { expect(tripKeys.publicDetail(1)).toEqual(['publicTrips', 1]) })
  it('publicLikes(1)', () => { expect(tripKeys.publicLikes(1)).toEqual(['publicTrips', 1, 'likes']) })
  it('publicRating(1)', () => { expect(tripKeys.publicRating(1)).toEqual(['publicTrips', 1, 'rating']) })
  it('publicComments(1)', () => { expect(tripKeys.publicComments(1)).toEqual(['publicTrips', 1, 'comments']) })
  it('publicImages(1)', () => { expect(tripKeys.publicImages(1)).toEqual(['publicTrips', 1, 'images']) })
  it('publicCommunityMedia(1)', () => { expect(tripKeys.publicCommunityMedia(1)).toEqual(['publicTrips', 1, 'communityMedia']) })
  it('myTrips()', () => { expect(tripKeys.myTrips()).toEqual(['users', 'me', 'trips']) })
})

// ── useMyRoutes ───────────────────────────────────────────────────────────────

describe('useMyRoutes', () => {
  it('fetches private routes list', async () => {
    mockApi.trips.list.mockResolvedValue([mockTrip('t1'), mockTrip('t2')])
    const { result } = renderHook(() => useMyRoutes(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
  })

  it('handles error', async () => {
    mockApi.trips.list.mockRejectedValue(new Error('Unauthorized'))
    const { result } = renderHook(() => useMyRoutes(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ── useRoute ──────────────────────────────────────────────────────────────────

describe('useRoute', () => {
  it('fetches route by id', async () => {
    mockApi.trips.get.mockResolvedValue(mockTrip('t1'))
    const { result } = renderHook(() => useRoute('t1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.trips.get).toHaveBeenCalledWith('t1')
  })

  it('does not fetch when id is null', () => {
    renderHook(() => useRoute(null), { wrapper: makeWrapper() })
    expect(mockApi.trips.get).not.toHaveBeenCalled()
  })
})

// ── useDeleteRoute ────────────────────────────────────────────────────────────

describe('useDeleteRoute', () => {
  it('removes route from cache', async () => {
    mockApi.trips.list.mockResolvedValue([mockTrip('t1'), mockTrip('t2')])
    mockApi.trips.delete.mockResolvedValue(undefined)

    const wrapper = makeWrapper()
    const { result: listResult } = renderHook(() => useMyRoutes(), { wrapper })
    await waitFor(() => expect(listResult.current.data).toHaveLength(2))

    const { result } = renderHook(() => useDeleteRoute(), { wrapper })
    await act(async () => { await result.current.mutateAsync('t1') })

    await waitFor(() => expect(listResult.current.data).toHaveLength(1))
    expect(listResult.current.data?.[0].id).toBe('t2')
  })
})

// ── usePublicTrips ────────────────────────────────────────────────────────────

describe('usePublicTrips', () => {
  it('fetches public trips without filters', async () => {
    mockApi.publicTrips.list.mockResolvedValue([mockPublicTrip(1), mockPublicTrip(2)])
    const { result } = renderHook(() => usePublicTrips(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(mockApi.publicTrips.list).toHaveBeenCalledWith({})
  })

  it('passes filters to api', async () => {
    mockApi.publicTrips.list.mockResolvedValue([mockPublicTrip(1)])
    const { result } = renderHook(() => usePublicTrips({ region: 'north', difficulty: 'easy' }), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.publicTrips.list).toHaveBeenCalledWith({ region: 'north', difficulty: 'easy' })
  })
})

// ── usePublicTrip ─────────────────────────────────────────────────────────────

describe('usePublicTrip', () => {
  it('fetches public trip by id', async () => {
    mockApi.publicTrips.get.mockResolvedValue(mockPublicTrip(5))
    const { result } = renderHook(() => usePublicTrip(5), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.publicTrips.get).toHaveBeenCalledWith(5)
  })

  it('does not fetch when id is null', () => {
    renderHook(() => usePublicTrip(null), { wrapper: makeWrapper() })
    expect(mockApi.publicTrips.get).not.toHaveBeenCalled()
  })

  it('does not fetch when id is 0', () => {
    renderHook(() => usePublicTrip(0), { wrapper: makeWrapper() })
    expect(mockApi.publicTrips.get).not.toHaveBeenCalled()
  })
})

// ── useTripLikes ──────────────────────────────────────────────────────────────

describe('useTripLikes', () => {
  it('fetches likes', async () => {
    mockApi.publicTrips.getLikes.mockResolvedValue({ liked: false, likes_count: 3 })
    const { result } = renderHook(() => useTripLikes(1), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ liked: false, likes_count: 3 })
  })

  it('does not fetch when disabled', () => {
    renderHook(() => useTripLikes(1, false), { wrapper: makeWrapper() })
    expect(mockApi.publicTrips.getLikes).not.toHaveBeenCalled()
  })

  it('does not fetch when tripId is 0', () => {
    renderHook(() => useTripLikes(0), { wrapper: makeWrapper() })
    expect(mockApi.publicTrips.getLikes).not.toHaveBeenCalled()
  })
})

// ── useToggleTripLike ─────────────────────────────────────────────────────────

describe('useToggleTripLike', () => {
  it('calls toggleLike api', async () => {
    mockApi.publicTrips.getLikes.mockResolvedValue({ liked: false, likes_count: 5 })
    mockApi.publicTrips.toggleLike.mockResolvedValue({ liked: true, likes_count: 6 })

    const wrapper = makeWrapper()
    const { result: likesResult } = renderHook(() => useTripLikes(3), { wrapper })
    await waitFor(() => expect(likesResult.current.isSuccess).toBe(true))

    const { result } = renderHook(() => useToggleTripLike(3), { wrapper })
    await act(async () => { await result.current.mutateAsync() })

    expect(mockApi.publicTrips.toggleLike).toHaveBeenCalledWith(3)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('rolls back on error', async () => {
    mockApi.publicTrips.getLikes.mockResolvedValue({ liked: true, likes_count: 6 })
    mockApi.publicTrips.toggleLike.mockRejectedValue(new Error('fail'))

    const wrapper = makeWrapper()
    const { result: likesResult } = renderHook(() => useTripLikes(2), { wrapper })
    await waitFor(() => expect(likesResult.current.isSuccess).toBe(true))

    const { result } = renderHook(() => useToggleTripLike(2), { wrapper })
    await act(async () => {
      try { await result.current.mutateAsync() } catch { /* expected */ }
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    // Cache should be restored to original value after rollback
    expect(likesResult.current.data?.liked).toBe(true)
    expect(likesResult.current.data?.likes_count).toBe(6)
  })
})

// ── useTripRating ─────────────────────────────────────────────────────────────

describe('useTripRating', () => {
  it('fetches rating', async () => {
    const rating = { average_rating: 4.5, ratings_count: 10, user_rating: 5 }
    mockApi.publicTrips.getRating.mockResolvedValue(rating)
    const { result } = renderHook(() => useTripRating(1), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(rating)
  })

  it('does not fetch when disabled', () => {
    renderHook(() => useTripRating(1, false), { wrapper: makeWrapper() })
    expect(mockApi.publicTrips.getRating).not.toHaveBeenCalled()
  })
})

// ── useSetTripRating ──────────────────────────────────────────────────────────

describe('useSetTripRating', () => {
  it('calls setRating api with correct args', async () => {
    const updated = { average_rating: 4.2, ratings_count: 6, user_rating: 5 }
    mockApi.publicTrips.setRating.mockResolvedValue(updated)

    const { result } = renderHook(() => useSetTripRating(4), { wrapper: makeWrapper() })
    await act(async () => { await result.current.mutateAsync(5) })

    expect(mockApi.publicTrips.setRating).toHaveBeenCalledWith(4, 5)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

// ── useTripComments ───────────────────────────────────────────────────────────

describe('useTripComments', () => {
  it('fetches comments', async () => {
    mockApi.publicTrips.getComments.mockResolvedValue([mockComment(1), mockComment(2)])
    const { result } = renderHook(() => useTripComments(1), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
  })

  it('does not fetch when disabled', () => {
    renderHook(() => useTripComments(1, false), { wrapper: makeWrapper() })
    expect(mockApi.publicTrips.getComments).not.toHaveBeenCalled()
  })
})

// ── useAddTripComment ─────────────────────────────────────────────────────────

describe('useAddTripComment', () => {
  it('appends new comment to cache', async () => {
    const existing = mockComment(1)
    const newComment = mockComment(2)
    mockApi.publicTrips.getComments.mockResolvedValue([existing])
    mockApi.publicTrips.addComment.mockResolvedValue(newComment)

    const wrapper = makeWrapper()
    const { result: commentsResult } = renderHook(() => useTripComments(1), { wrapper })
    await waitFor(() => expect(commentsResult.current.data).toHaveLength(1))

    const { result } = renderHook(() => useAddTripComment(1), { wrapper })
    await act(async () => { await result.current.mutateAsync('New comment') })

    await waitFor(() => expect(commentsResult.current.data).toHaveLength(2))
    expect(commentsResult.current.data?.[1].id).toBe(2)
  })
})

// ── useDeleteTripComment ──────────────────────────────────────────────────────

describe('useDeleteTripComment', () => {
  it('removes comment from cache', async () => {
    mockApi.publicTrips.getComments.mockResolvedValue([mockComment(1), mockComment(2)])
    mockApi.publicTrips.deleteComment.mockResolvedValue(undefined)

    const wrapper = makeWrapper()
    const { result: commentsResult } = renderHook(() => useTripComments(1), { wrapper })
    await waitFor(() => expect(commentsResult.current.data).toHaveLength(2))

    const { result } = renderHook(() => useDeleteTripComment(1), { wrapper })
    await act(async () => { await result.current.mutateAsync(1) })

    await waitFor(() => expect(commentsResult.current.data).toHaveLength(1))
    expect(commentsResult.current.data?.[0].id).toBe(2)
  })
})

// ── useTripImages ─────────────────────────────────────────────────────────────

describe('useTripImages', () => {
  it('fetches trip images', async () => {
    mockApi.publicTrips.getImages.mockResolvedValue([mockImage(1), mockImage(2)])
    const { result } = renderHook(() => useTripImages(1), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
  })

  it('does not fetch when disabled', () => {
    renderHook(() => useTripImages(1, false), { wrapper: makeWrapper() })
    expect(mockApi.publicTrips.getImages).not.toHaveBeenCalled()
  })
})

// ── useTripCommunityMedia ─────────────────────────────────────────────────────

describe('useTripCommunityMedia', () => {
  it('fetches community media', async () => {
    mockApi.publicTrips.getCommunityMedia.mockResolvedValue([mockMedia(1)])
    const { result } = renderHook(() => useTripCommunityMedia(1), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })

  it('does not fetch when disabled', () => {
    renderHook(() => useTripCommunityMedia(1, false), { wrapper: makeWrapper() })
    expect(mockApi.publicTrips.getCommunityMedia).not.toHaveBeenCalled()
  })
})

// ── useAddTripCommunityMedia ──────────────────────────────────────────────────

describe('useAddTripCommunityMedia', () => {
  it('appends new media to cache', async () => {
    const existing = mockMedia(1)
    const newMedia = mockMedia(2)
    mockApi.publicTrips.getCommunityMedia.mockResolvedValue([existing])
    mockApi.publicTrips.addCommunityMedia.mockResolvedValue(newMedia)

    const wrapper = makeWrapper()
    const { result: mediaResult } = renderHook(() => useTripCommunityMedia(1), { wrapper })
    await waitFor(() => expect(mediaResult.current.data).toHaveLength(1))

    const { result } = renderHook(() => useAddTripCommunityMedia(1), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ url: 'https://img/2', media_type: 'image' })
    })

    await waitFor(() => expect(mediaResult.current.data).toHaveLength(2))
  })
})

// ── useDeleteTripCommunityMedia ───────────────────────────────────────────────

describe('useDeleteTripCommunityMedia', () => {
  it('removes media item from cache', async () => {
    mockApi.publicTrips.getCommunityMedia.mockResolvedValue([mockMedia(1), mockMedia(2)])
    mockApi.publicTrips.deleteCommunityMedia.mockResolvedValue(undefined)

    const wrapper = makeWrapper()
    const { result: mediaResult } = renderHook(() => useTripCommunityMedia(1), { wrapper })
    await waitFor(() => expect(mediaResult.current.data).toHaveLength(2))

    const { result } = renderHook(() => useDeleteTripCommunityMedia(1), { wrapper })
    await act(async () => { await result.current.mutateAsync(1) })

    await waitFor(() => expect(mediaResult.current.data).toHaveLength(1))
    expect(mediaResult.current.data?.[0].id).toBe(2)
  })
})

// ── useInvalidateTrip ─────────────────────────────────────────────────────────

describe('useInvalidateTrip', () => {
  it('returns a function that does not throw without tripId', () => {
    const { result } = renderHook(() => useInvalidateTrip(), { wrapper: makeWrapper() })
    expect(() => result.current()).not.toThrow()
  })

  it('returns a function that does not throw with tripId', () => {
    const { result } = renderHook(() => useInvalidateTrip(), { wrapper: makeWrapper() })
    expect(() => result.current(1)).not.toThrow()
  })
})
