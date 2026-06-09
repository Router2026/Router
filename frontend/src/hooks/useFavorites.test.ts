import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../api', () => ({
  api: {
    favorites: {
      list: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
    },
  },
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from './useFavorites'

const mockApi = api as {
  favorites: {
    list: ReturnType<typeof vi.fn>
    add: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
  }
}
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>

const mockUser = { id: '1', username: 'testuser', email: 'test@test.com', xp_points: 0, level: 'beginner' }
const fav = (locationId: number) => ({ id: locationId, user_id: 1, location_id: locationId, created_at: '2024-01-01' })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useFavorites — no user', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null })
  })

  it('starts with empty favorites', () => {
    const { result } = renderHook(() => useFavorites())
    expect(result.current.favorites).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('isFavorite always returns false', () => {
    const { result } = renderHook(() => useFavorites())
    expect(result.current.isFavorite(42)).toBe(false)
  })

  it('toggleFavorite is a no-op when no user', async () => {
    const { result } = renderHook(() => useFavorites())
    await act(async () => { await result.current.toggleFavorite(42) })
    expect(mockApi.favorites.add).not.toHaveBeenCalled()
    expect(mockApi.favorites.remove).not.toHaveBeenCalled()
  })
})

describe('useFavorites — with user', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: mockUser })
    mockApi.favorites.list.mockResolvedValue([fav(10), fav(20)])
  })

  it('fetches favorites on mount', async () => {
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.favorites).toHaveLength(2))
    expect(mockApi.favorites.list).toHaveBeenCalledTimes(1)
  })

  it('isFavorite returns true for loaded id', async () => {
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.favorites).toHaveLength(2))
    expect(result.current.isFavorite(10)).toBe(true)
  })

  it('isFavorite works with string ids', async () => {
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.favorites).toHaveLength(2))
    expect(result.current.isFavorite('10')).toBe(true)
  })

  it('isFavorite returns false for unknown id', async () => {
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.favorites).toHaveLength(2))
    expect(result.current.isFavorite(99)).toBe(false)
  })
})

describe('useFavorites — toggleFavorite remove', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: mockUser })
    mockApi.favorites.list.mockResolvedValue([fav(42)])
  })

  it('removes favorite optimistically on success', async () => {
    mockApi.favorites.remove.mockResolvedValue(undefined)
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.isFavorite(42)).toBe(true))

    await act(async () => { await result.current.toggleFavorite(42) })
    expect(result.current.isFavorite(42)).toBe(false)
    expect(mockApi.favorites.remove).toHaveBeenCalledWith(42)
  })

  it('refetches on remove failure', async () => {
    mockApi.favorites.remove.mockRejectedValue(new Error('fail'))
    mockApi.favorites.list.mockResolvedValue([fav(42)])
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.isFavorite(42)).toBe(true))

    await act(async () => { await result.current.toggleFavorite(42) })
    await waitFor(() => expect(mockApi.favorites.list).toHaveBeenCalledTimes(2))
  })
})

describe('useFavorites — toggleFavorite add', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: mockUser })
    mockApi.favorites.list.mockResolvedValue([])
  })

  it('adds favorite on success', async () => {
    mockApi.favorites.add.mockResolvedValue({ favorite: fav(7) })
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.favorites).toHaveLength(0))

    await act(async () => { await result.current.toggleFavorite(7) })
    await waitFor(() => expect(result.current.isFavorite(7)).toBe(true))
    expect(mockApi.favorites.add).toHaveBeenCalledWith(7)
  })

  it('ignores error silently on add failure', async () => {
    mockApi.favorites.add.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useFavorites())
    await waitFor(() => expect(result.current.favorites).toHaveLength(0))

    await act(async () => { await result.current.toggleFavorite(7) })
    await waitFor(() => expect(result.current.favorites).toHaveLength(0))
  })
})
