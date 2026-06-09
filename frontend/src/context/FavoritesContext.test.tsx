import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import React from 'react'

vi.mock('../api', () => ({
  api: {
    favorites: {
      list: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
    },
  },
}))

vi.mock('./AuthContext', () => ({
  useAuth: vi.fn(),
}))

import { api } from '../api'
import { useAuth } from './AuthContext'
import { FavoritesProvider, useFavorites } from './FavoritesContext'

const mockApi = api as {
  favorites: {
    list: ReturnType<typeof vi.fn>
    add: ReturnType<typeof vi.fn>
    remove: ReturnType<typeof vi.fn>
  }
}
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>

const mockUser = { id: '1', username: 'testuser', email: 'test@test.com', xp_points: 0, level: 'beginner' }
const mockFavorite = { id: 1, user_id: 1, location_id: 42, created_at: '2024-01-01' }

function TestConsumer({ id }: { id?: number }) {
  const ctx = useFavorites()
  return (
    <div>
      <div data-testid="loading">{String(ctx.loading)}</div>
      <div data-testid="count">{ctx.favorites.length}</div>
      <div data-testid="isFav">{String(ctx.isFavorite(id ?? 42))}</div>
      <button onClick={() => id != null && ctx.toggleFavorite(id)}>toggle</button>
      <button onClick={() => ctx.refresh()}>refresh</button>
    </div>
  )
}

function wrap(id?: number) {
  return render(
    <FavoritesProvider>
      <TestConsumer id={id} />
    </FavoritesProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FavoritesContext — no user', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null })
  })

  it('starts with empty favorites and loading=false', async () => {
    const { getByTestId } = wrap()
    await waitFor(() => expect(getByTestId('loading').textContent).toBe('false'))
    expect(getByTestId('count').textContent).toBe('0')
  })

  it('isFavorite returns false when no favorites', async () => {
    const { getByTestId } = wrap(42)
    await waitFor(() => expect(getByTestId('loading').textContent).toBe('false'))
    expect(getByTestId('isFav').textContent).toBe('false')
  })

  it('toggleFavorite does nothing when no user', async () => {
    const { getByTestId, getByText } = wrap(42)
    await waitFor(() => expect(getByTestId('loading').textContent).toBe('false'))
    await act(async () => { getByText('toggle').click() })
    expect(mockApi.favorites.add).not.toHaveBeenCalled()
    expect(mockApi.favorites.remove).not.toHaveBeenCalled()
  })
})

describe('FavoritesContext — with user', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: mockUser })
    mockApi.favorites.list.mockResolvedValue([mockFavorite])
  })

  it('fetches favorites on mount', async () => {
    const { getByTestId } = wrap()
    await waitFor(() => expect(getByTestId('count').textContent).toBe('1'))
    expect(mockApi.favorites.list).toHaveBeenCalledTimes(1)
  })

  it('isFavorite returns true for loaded favorite', async () => {
    const { getByTestId } = wrap(42)
    await waitFor(() => expect(getByTestId('isFav').textContent).toBe('true'))
  })

  it('isFavorite works with string id', async () => {
    const Comp = () => {
      const ctx = useFavorites()
      return <div data-testid="r">{String(ctx.isFavorite('42'))}</div>
    }
    const { getByTestId } = render(<FavoritesProvider><Comp /></FavoritesProvider>)
    await waitFor(() => expect(getByTestId('r').textContent).toBe('true'))
  })

  it('refresh re-fetches favorites', async () => {
    const { getByTestId, getByText } = wrap()
    await waitFor(() => expect(getByTestId('count').textContent).toBe('1'))
    mockApi.favorites.list.mockResolvedValue([mockFavorite, { ...mockFavorite, id: 2, location_id: 99 }])
    await act(async () => { getByText('refresh').click() })
    await waitFor(() => expect(getByTestId('count').textContent).toBe('2'))
  })
})

describe('FavoritesContext — toggleFavorite', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: mockUser })
    mockApi.favorites.list.mockResolvedValue([mockFavorite])
  })

  it('optimistically removes a favorite and confirms with API', async () => {
    mockApi.favorites.remove.mockResolvedValue(undefined)
    const { getByTestId, getByText } = wrap(42)
    await waitFor(() => expect(getByTestId('isFav').textContent).toBe('true'))

    await act(async () => { getByText('toggle').click() })
    await waitFor(() => expect(getByTestId('isFav').textContent).toBe('false'))
    expect(mockApi.favorites.remove).toHaveBeenCalledWith(42)
  })

  it('reverts optimistic remove on API failure', async () => {
    mockApi.favorites.remove.mockRejectedValue(new Error('fail'))
    mockApi.favorites.list.mockResolvedValue([mockFavorite])
    const { getByTestId, getByText } = wrap(42)
    await waitFor(() => expect(getByTestId('isFav').textContent).toBe('true'))

    await act(async () => { getByText('toggle').click() })
    // Optimistically removed, then refreshed
    await waitFor(() => expect(mockApi.favorites.list).toHaveBeenCalledTimes(2))
  })

  it('optimistically adds a favorite and replaces placeholder', async () => {
    mockApi.favorites.list.mockResolvedValue([])
    mockApi.favorites.add.mockResolvedValue({ favorite: { ...mockFavorite, location_id: 5 } })
    const { getByTestId, getByText } = wrap(5)
    await waitFor(() => expect(getByTestId('count').textContent).toBe('0'))

    await act(async () => { getByText('toggle').click() })
    await waitFor(() => expect(getByTestId('count').textContent).toBe('1'))
    expect(mockApi.favorites.add).toHaveBeenCalledWith(5)
  })

  it('removes placeholder on add failure', async () => {
    mockApi.favorites.list.mockResolvedValue([])
    mockApi.favorites.add.mockRejectedValue(new Error('fail'))
    const { getByTestId, getByText } = wrap(5)
    await waitFor(() => expect(getByTestId('count').textContent).toBe('0'))

    await act(async () => { getByText('toggle').click() })
    await waitFor(() => expect(getByTestId('count').textContent).toBe('0'))
  })

  it('deduplicates concurrent toggleFavorite calls', async () => {
    mockApi.favorites.remove.mockResolvedValue(undefined)
    const { getByTestId, getByText } = wrap(42)
    await waitFor(() => expect(getByTestId('isFav').textContent).toBe('true'))

    // Click twice quickly — second call should be ignored while first is pending
    await act(async () => {
      getByText('toggle').click()
      getByText('toggle').click()
    })
    await waitFor(() => expect(getByTestId('isFav').textContent).toBe('false'))
    expect(mockApi.favorites.remove).toHaveBeenCalledTimes(1)
  })
})

describe('useFavorites throws outside provider', () => {
  it('throws when used outside FavoritesProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow('useFavorites must be used within FavoritesProvider')
    spy.mockRestore()
  })
})
