import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/raw-client', () => ({
  rawDb: { query: vi.fn() },
}))

import { rawDb } from '@/lib/db/raw-client'
import { computeLevel, levelLabel, awardXp, XP_REWARDS } from './xp-service'

const mockDb = rawDb as { query: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('computeLevel', () => {
  it('returns 0 for 0 xp', () => {
    expect(computeLevel(0)).toBe(0)
  })

  it('returns 0 for negative xp', () => {
    expect(computeLevel(-100)).toBe(0)
  })

  it('returns 1 at 50 xp', () => {
    expect(computeLevel(50)).toBe(1)
  })

  it('returns 2 at 200 xp', () => {
    expect(computeLevel(200)).toBe(2)
  })

  it('returns 3 at 450 xp', () => {
    expect(computeLevel(450)).toBe(3)
  })

  it('returns 10 at 5000 xp', () => {
    expect(computeLevel(5000)).toBe(10)
  })
})

describe('levelLabel', () => {
  it('returns beginner label at 0 xp', () => {
    expect(levelLabel(0)).toBe('מטייל מתחיל')
  })

  it('returns explorer label at level 1-2', () => {
    expect(levelLabel(50)).toBe('חוקר')
    expect(levelLabel(150)).toBe('חוקר')
  })

  it('returns field fox label at level 3-5', () => {
    expect(levelLabel(450)).toBe('שועל שטח')
  })

  it('returns discoverer label at level 6-9', () => {
    expect(levelLabel(1800)).toBe('מגלה')
  })

  it('returns navigator label at level 10-14', () => {
    expect(levelLabel(5000)).toBe('נווט')
  })

  it('returns champion label at level 15+', () => {
    expect(levelLabel(11250)).toBe('אלוף המסלולים')
  })
})

describe('XP_REWARDS', () => {
  it('has expected reward values', () => {
    expect(XP_REWARDS.REVIEW).toBe(20)
    expect(XP_REWARDS.REPORT).toBe(15)
    expect(XP_REWARDS.TRIP_CREATED).toBe(25)
    expect(XP_REWARDS.PHOTO_UPLOAD).toBe(10)
  })
})

describe('awardXp', () => {
  it('throws for non-positive amount', async () => {
    await expect(awardXp(1, 0)).rejects.toThrow('XP amount must be positive')
    await expect(awardXp(1, -5)).rejects.toThrow('XP amount must be positive')
  })

  it('updates xp_points and returns result', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ new_total: 70 }] })
      .mockResolvedValue({ rows: [] })

    const result = await awardXp(1, 20)
    expect(result.new_xp).toBe(70)
    expect(result.new_level).toBe(computeLevel(70))
    expect(result.level_label).toBe(levelLabel(70))
  })

  it('detects level up correctly', async () => {
    // Going from 40 xp (level 0) to 60 xp (level 1)
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ new_total: 60 }] })
      .mockResolvedValue({ rows: [] })

    const result = await awardXp(1, 20)
    expect(result.leveled_up).toBe(true)
  })

  it('reports no level up when staying at same level', async () => {
    // Going from 0 to 40 — still level 0
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ new_total: 40 }] })
      .mockResolvedValue({ rows: [] })

    const result = await awardXp(1, 40)
    expect(result.leveled_up).toBe(false)
  })

  it('throws when user not found', async () => {
    mockDb.query.mockResolvedValueOnce({ rows: [] })
    await expect(awardXp(999, 10)).rejects.toThrow('User not found')
  })

  it('swallows xp column sync error gracefully', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ new_total: 50 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('column xp does not exist'))

    await expect(awardXp(1, 10)).resolves.toBeDefined()
  })
})
