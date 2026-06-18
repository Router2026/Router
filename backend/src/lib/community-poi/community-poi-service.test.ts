import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted runs before vi.mock — the only safe way to share state with the factory
const { mockTxQuery, mockTxRelease } = vi.hoisted(() => ({
  mockTxQuery:   vi.fn(),
  mockTxRelease: vi.fn(),
}))

vi.mock('@/lib/db/raw-client', () => ({
  rawDb: {
    query:     vi.fn(),
    getClient: vi.fn().mockResolvedValue({
      query:   mockTxQuery,
      release: mockTxRelease,
    }),
  },
}))
vi.mock('@/lib/notifications/push-service', () => ({
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
}))

import { rawDb } from '@/lib/db/raw-client'
import { sendPushToUser } from '@/lib/notifications/push-service'
import {
  listAllCommunityPois,
  createCommunityPoi,
  approveCommunityPoi,
  rejectCommunityPoi,
  editCommunityPoi,
} from './community-poi-service'

const mockDb = rawDb as unknown as { query: ReturnType<typeof vi.fn>; getClient: ReturnType<typeof vi.fn> }
const mockPush = sendPushToUser as ReturnType<typeof vi.fn>

const samplePoi = {
  id: 1, user_id: 5, name: 'Hidden Spring', category: 'מים',
  description: 'A lovely spring', latitude: 32.5, longitude: 35.1,
  photos: ['img1.jpg'], status: 'pending', admin_note: null,
  reviewed_by: null, reviewed_at: null, created_at: new Date(), updated_at: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mockTxQuery.mockReset()
  mockTxRelease.mockReset()
})

describe('listAllCommunityPois', () => {
  it('returns all POIs without status filter', async () => {
    mockDb.query.mockResolvedValue({ rows: [samplePoi] })
    const result = await listAllCommunityPois()
    expect(result).toHaveLength(1)
    const [sql, params] = mockDb.query.mock.calls[0]
    expect(params).toHaveLength(0)
    expect(sql).not.toContain('WHERE')
  })

  it('filters by status=pending when provided', async () => {
    mockDb.query.mockResolvedValue({ rows: [samplePoi] })
    await listAllCommunityPois('pending')
    const [sql, params] = mockDb.query.mock.calls[0]
    expect(params).toContain('pending')
    expect(sql).toContain('WHERE')
  })
})

describe('createCommunityPoi', () => {
  it('inserts with status=pending', async () => {
    mockDb.query.mockResolvedValue({ rows: [samplePoi] })
    const result = await createCommunityPoi({
      userId: 5, name: 'Hidden Spring', category: 'מים',
      latitude: 32.5, longitude: 35.1,
    })
    expect(result.status).toBe('pending')
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).toContain("'pending'")
    expect(sql).toContain('INSERT INTO community_pois')
  })
})

describe('approveCommunityPoi', () => {
  it('updates status to approved, copies to locations, awards XP, sends push', async () => {
    const approvedPoi = { ...samplePoi, status: 'approved' }
    // Transaction client calls: BEGIN, UPDATE community_pois, SELECT username,
    // INSERT locations, UPDATE users XP, COMMIT
    mockTxQuery
      .mockResolvedValueOnce({ rows: [] })              // BEGIN
      .mockResolvedValueOnce({ rows: [approvedPoi] })   // UPDATE community_pois
      .mockResolvedValueOnce({ rows: [{ username: 'ori' }] }) // SELECT username
      .mockResolvedValueOnce({ rows: [{ id: 100 }] })   // INSERT INTO locations
      .mockResolvedValueOnce({ rows: [] })               // UPDATE users XP
      .mockResolvedValueOnce({ rows: [] })               // COMMIT

    const result = await approveCommunityPoi(1, 99)
    expect(result.status).toBe('approved')

    // BEGIN and COMMIT should have been called
    const txSqls = mockTxQuery.mock.calls.map((args: unknown[]) => (args[0] as string).trim())
    expect(txSqls).toContain('BEGIN')
    expect(txSqls).toContain('COMMIT')

    // One of the calls should insert into locations
    expect(txSqls.some((s: string) => s.includes('INSERT INTO'))).toBe(true)

    // Push notification sent
    expect(mockPush).toHaveBeenCalledWith(
      approvedPoi.user_id,
      expect.objectContaining({ title: expect.stringContaining('אושר') })
    )
  })
})

describe('rejectCommunityPoi', () => {
  it('updates status to rejected and sends push', async () => {
    const rejectedPoi = { ...samplePoi, status: 'rejected', admin_note: 'Duplicate' }
    mockDb.query.mockResolvedValue({ rows: [rejectedPoi] })

    const result = await rejectCommunityPoi(1, 99, 'Duplicate')
    expect(result.status).toBe('rejected')

    const [sql, params] = mockDb.query.mock.calls[0]
    expect(sql).toContain("'rejected'")
    expect(params).toContain('Duplicate')

    expect(mockPush).toHaveBeenCalledWith(
      rejectedPoi.user_id,
      expect.objectContaining({ data: expect.objectContaining({ type: 'community_poi_rejected' }) })
    )
  })
})

describe('editCommunityPoi', () => {
  it('updates specified fields', async () => {
    const updated = { ...samplePoi, name: 'Updated Spring' }
    mockDb.query.mockResolvedValue({ rows: [updated] })

    const result = await editCommunityPoi(1, { name: 'Updated Spring' })
    expect(result.name).toBe('Updated Spring')

    const [sql, params] = mockDb.query.mock.calls[0]
    expect(sql).toContain('COALESCE')
    expect(params).toContain('Updated Spring')
  })
})
