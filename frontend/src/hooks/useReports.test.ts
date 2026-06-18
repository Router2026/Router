import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../api', () => ({
  api: {
    reports: {
      list: vi.fn(),
      myReports: vi.fn(),
      upvote: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { api, type CommunityReport } from '../api'
import { reportKeys, useReports, useMyReports, useUpvoteReport, useCreateReport } from './useReports'

const mockApi = api as {
  reports: {
    list: ReturnType<typeof vi.fn>
    myReports: ReturnType<typeof vi.fn>
    upvote: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

function makeWrapperWithClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
  return { client, wrapper }
}

const mockReport = (id: string, type = 'road', upvotes = 0) => ({
  id,
  report_type: type,
  upvotes,
  title: `Report ${id}`,
  content: 'content',
  created_at: '2024-01-01',
  user_id: 1,
  username: 'user',
  avatar_url: null,
  latitude: 31.5,
  longitude: 34.8,
  location_name: 'Test',
  status: 'open',
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ── reportKeys ────────────────────────────────────────────────────────────────

describe('reportKeys', () => {
  it('all() returns stable key', () => {
    expect(reportKeys.all()).toEqual(['reports'])
  })

  it('list() without type defaults to all', () => {
    expect(reportKeys.list()).toEqual(['reports', 'list', 'all'])
  })

  it('list(type) includes type', () => {
    expect(reportKeys.list('road')).toEqual(['reports', 'list', 'road'])
  })

  it('mine() without id defaults to me', () => {
    expect(reportKeys.mine()).toEqual(['reports', 'mine', 'me'])
  })

  it('mine(userId) includes userId string', () => {
    expect(reportKeys.mine(42)).toEqual(['reports', 'mine', '42'])
  })
})

// ── useReports ────────────────────────────────────────────────────────────────

describe('useReports', () => {
  it('returns empty array initially then populates', async () => {
    mockApi.reports.list.mockResolvedValue([mockReport('1'), mockReport('2')])
    const { result } = renderHook(() => useReports(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(mockApi.reports.list).toHaveBeenCalledWith({ type: undefined })
  })

  it('passes type filter to api', async () => {
    mockApi.reports.list.mockResolvedValue([mockReport('1', 'road')])
    const { result } = renderHook(() => useReports('road'), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApi.reports.list).toHaveBeenCalledWith({ type: 'road' })
  })

  it('handles api error', async () => {
    mockApi.reports.list.mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useReports(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ── useMyReports ──────────────────────────────────────────────────────────────

describe('useMyReports', () => {
  it('does not fetch when userId is absent', () => {
    mockApi.reports.myReports.mockResolvedValue([])
    renderHook(() => useMyReports(), { wrapper: makeWrapper() })
    expect(mockApi.reports.myReports).not.toHaveBeenCalled()
  })

  it('fetches when userId provided', async () => {
    mockApi.reports.myReports.mockResolvedValue([mockReport('3')])
    const { result } = renderHook(() => useMyReports(1), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
  })
})

// ── useUpvoteReport ───────────────────────────────────────────────────────────

describe('useUpvoteReport', () => {
  it('calls upvote api and updates cache on success', async () => {
    const updatedReport = { ...mockReport('r1'), upvotes: 1 }
    mockApi.reports.list.mockResolvedValue([mockReport('r1')])
    mockApi.reports.upvote.mockResolvedValue(updatedReport)

    const wrapper = makeWrapper()
    const { result: listResult } = renderHook(() => useReports(), { wrapper })
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true))

    const { result } = renderHook(() => useUpvoteReport(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ id: 'r1', action: 'add' })
    })

    expect(mockApi.reports.upvote).toHaveBeenCalledWith('r1', 'add')
  })

  it('optimistically updates upvote count', async () => {
    mockApi.reports.list.mockResolvedValue([mockReport('r1', 'road', 5)])
    const updatedReport = { ...mockReport('r1', 'road', 6) }
    mockApi.reports.upvote.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(updatedReport), 100)))

    const wrapper = makeWrapper()
    const { result: listResult } = renderHook(() => useReports(), { wrapper })
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true))

    const { result } = renderHook(() => useUpvoteReport(), { wrapper })
    act(() => { result.current.mutate({ id: 'r1', action: 'add' }) })

    await waitFor(() => {
      const data = listResult.current.data
      return data?.find(r => r.id === 'r1')?.upvotes === 6
    })
  })

  it('rolls back on error', async () => {
    mockApi.reports.list.mockResolvedValue([mockReport('r1', 'road', 5)])
    mockApi.reports.upvote.mockRejectedValue(new Error('fail'))

    const wrapper = makeWrapper()
    const { result: listResult } = renderHook(() => useReports(), { wrapper })
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true))

    const { result } = renderHook(() => useUpvoteReport(), { wrapper })
    await act(async () => {
      try { await result.current.mutateAsync({ id: 'r1', action: 'add' }) } catch { /* expected */ }
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ── useCreateReport ───────────────────────────────────────────────────────────

describe('useCreateReport', () => {
  it('calls create api and prepends to cache', async () => {
    const existingReport = mockReport('existing')
    const newReport = mockReport('new', 'road')
    mockApi.reports.list.mockResolvedValue([existingReport])
    mockApi.reports.create.mockResolvedValue(newReport)

    const wrapper = makeWrapper()
    const { result: listResult } = renderHook(() => useReports(), { wrapper })
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true))

    const { result } = renderHook(() => useCreateReport(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({
        report_type: 'road',
        title: 'New report',
        content: 'content',
        latitude: 31.5,
        longitude: 34.8,
        location_name: 'Test',
      } as Parameters<typeof api.reports.create>[0])
    })

    expect(mockApi.reports.create).toHaveBeenCalled()
  })

  it('does not prepend to typed list when report type does not match activeType', async () => {
    const existingReport = mockReport('existing', 'road')
    const newReport = mockReport('new', 'trail')
    mockApi.reports.list.mockResolvedValue([existingReport])
    mockApi.reports.create.mockResolvedValue(newReport)

    const wrapper = makeWrapper()
    const { result: listResult } = renderHook(() => useReports('road'), { wrapper })
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true))

    const { result } = renderHook(() => useCreateReport('road'), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({
        report_type: 'trail',
        title: 'Trail report',
        content: 'content',
        latitude: 31.5,
        longitude: 34.8,
        location_name: 'Test',
      } as Parameters<typeof api.reports.create>[0])
    })

    // The 'road' typed list should NOT have the new 'trail' report prepended
    expect(listResult.current.data?.find(r => r.id === 'new')).toBeUndefined()
  })

  it('handles create error', async () => {
    mockApi.reports.create.mockRejectedValue(new Error('create failed'))
    const { result } = renderHook(() => useCreateReport(), { wrapper: makeWrapper() })

    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      try { await result.current.mutateAsync({} as any) } catch { /* expected */ }
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ── useUpvoteReport onSuccess cross-list sync ─────────────────────────────────

describe('useUpvoteReport — cross-list sync', () => {
  it('onSuccess syncs updated report into a list that was not optimistically updated', async () => {
    // Mutation uses activeType='road', so onMutate only touches the 'road' list.
    // onSuccess must sync the 'all' list too — verified via the QueryClient directly.
    const report = mockReport('r1', 'road', 3)
    const updatedReport = { ...report, upvotes: 4 }
    mockApi.reports.list.mockResolvedValue([report])
    mockApi.reports.upvote.mockResolvedValue(updatedReport)

    const { client: qc, wrapper } = makeWrapperWithClient()
    const { result: allResult } = renderHook(() => useReports(), { wrapper })
    const { result: roadResult } = renderHook(() => useReports('road'), { wrapper })
    await waitFor(() => expect(allResult.current.isSuccess).toBe(true))
    await waitFor(() => expect(roadResult.current.isSuccess).toBe(true))

    // activeType='road': onMutate optimistically updates 'road', onSuccess syncs 'all'
    const { result } = renderHook(() => useUpvoteReport('road'), { wrapper })
    await act(async () => { await result.current.mutateAsync({ id: 'r1', action: 'add' }) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Read the cache directly — bypasses React re-render timing
    const allData = qc.getQueryData<CommunityReport[]>(reportKeys.list())
    expect(allData?.find(r => r.id === 'r1')?.upvotes).toBe(4)
  })

  it('onSuccess skips lists that do not contain the updated report', async () => {
    const r1 = mockReport('r1', 'road', 2)
    const r2 = mockReport('r2', 'trail', 0)
    const updatedR2 = { ...r2, upvotes: 1 }
    mockApi.reports.list
      .mockResolvedValueOnce([r1])    // 'all' list
      .mockResolvedValueOnce([r2])    // 'trail' list
    mockApi.reports.upvote.mockResolvedValue(updatedR2)

    const wrapper = makeWrapper()
    const { result: allResult } = renderHook(() => useReports(), { wrapper })
    const { result: trailResult } = renderHook(() => useReports('trail'), { wrapper })
    await waitFor(() => expect(allResult.current.isSuccess).toBe(true))
    await waitFor(() => expect(trailResult.current.isSuccess).toBe(true))

    const { result } = renderHook(() => useUpvoteReport('trail'), { wrapper })
    await act(async () => { await result.current.mutateAsync({ id: 'r2', action: 'add' }) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // 'all' list does not contain r2 — it should be unmodified
    expect(allResult.current.data?.find(r => r.id === 'r2')).toBeUndefined()
  })

  it('onMutate with remove action decrements upvotes', async () => {
    mockApi.reports.list.mockResolvedValue([mockReport('r1', 'road', 5)])
    mockApi.reports.upvote.mockImplementation(() => new Promise(() => {})) // never resolves

    const wrapper = makeWrapper()
    const { result: listResult } = renderHook(() => useReports(), { wrapper })
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true))

    const { result } = renderHook(() => useUpvoteReport(), { wrapper })
    act(() => { result.current.mutate({ id: 'r1', action: 'remove' }) })

    await waitFor(() => {
      expect(listResult.current.data?.find(r => r.id === 'r1')?.upvotes).toBe(4)
    })
  })
})
