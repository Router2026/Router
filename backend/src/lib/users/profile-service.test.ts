import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/raw-client', () => ({
  rawDb: { query: vi.fn() },
}))

import { rawDb } from '@/lib/db/raw-client'
import { getProfile, updateProfile } from './profile-service'

const mockDb = rawDb as { query: ReturnType<typeof vi.fn> }

const sampleRow = {
  id: 1, username: 'alice', full_name: 'Alice Smith', bio: 'Hiker',
  avatar_url: null, cover_image: null, favorite_regions: ['north'],
  instagram: null, website: null,
  xp: '150', xp_points: 150, level: 'חוקר', is_admin: false,
  reports_count: 2, reviews_count: 5, trips_count: 3, created_at: new Date('2024-01-01'),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getProfile', () => {
  it('returns null when user not found', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] })
    const result = await getProfile(999)
    expect(result).toBeNull()
  })

  it('maps row fields to PublicProfile', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [sampleRow] })
    const profile = await getProfile(1)
    expect(profile).not.toBeNull()
    expect(profile!.id).toBe(1)
    expect(profile!.username).toBe('alice')
    expect(profile!.xp).toBe(150)
    expect(profile!.is_admin).toBe(false)
    expect(profile!.reports_count).toBe(2)
  })

  it('falls back to xp_points when xp column is not parseable', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ ...sampleRow, xp: null, xp_points: 200 }] })
    const profile = await getProfile(1)
    expect(profile!.xp).toBe(200)
  })

  it('computes level_number from xp', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ ...sampleRow, xp: '50', xp_points: 50 }] })
    const profile = await getProfile(1)
    expect(profile!.level_number).toBe(1) // floor(sqrt(50/50)) = 1
  })

  it('uses row level when present, falls back to computed level label', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ ...sampleRow, level: 'custom-level' }] })
    const profile = await getProfile(1)
    expect(profile!.level).toBe('custom-level')
  })

  it('computes level label when row level is empty', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ ...sampleRow, level: null, xp: '0', xp_points: 0 }] })
    const profile = await getProfile(1)
    expect(profile!.level).toBe('מטייל מתחיל')
  })
})

describe('updateProfile', () => {
  it('throws when no fields provided', async () => {
    await expect(updateProfile(1, {})).rejects.toThrow('No fields to update')
    expect(mockDb.query).not.toHaveBeenCalled()
  })

  it('throws USERNAME_TAKEN when username already exists for another user', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [{ id: 2 }] }) // clash check
    await expect(updateProfile(1, { username: 'taken' })).rejects.toMatchObject({ code: 'USERNAME_TAKEN' })
  })

  it('updates profile and returns mapped result', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [] }) // no username clash
      .mockResolvedValueOnce({ rows: [sampleRow] }) // UPDATE RETURNING

    const profile = await updateProfile(1, { username: 'alice', bio: 'Explorer' })
    expect(profile.username).toBe('alice')
    const [sql] = mockDb.query.mock.calls[1]
    expect(sql).toContain('UPDATE users')
    expect(sql).toContain('RETURNING')
  })

  it('does not check username clash when username not being updated', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [sampleRow] })

    await updateProfile(1, { bio: 'New bio' })
    expect(mockDb.query).toHaveBeenCalledTimes(1)
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).toContain('bio = $')
  })

  it('throws when user not found after update', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] })
    await expect(updateProfile(1, { bio: 'test' })).rejects.toThrow('User not found')
  })
})
