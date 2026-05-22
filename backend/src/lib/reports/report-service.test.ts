import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/raw-client', () => ({
  rawDb: { query: vi.fn() },
}))

import { rawDb } from '@/lib/db/raw-client'
import { getReports, createReport, upvoteReport } from './report-service'

const mockDb = rawDb as { query: ReturnType<typeof vi.fn> }

const sampleReport = {
  id: 1, user_id: 3, location_id: 7, poi_name: 'Banias',
  report_type: 'trail', severity: 'בינונית', content: 'Path is muddy',
  reporter_name: 'Bob', upvotes: 2, created_at: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getReports', () => {
  it('returns all reports without filter', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleReport] })
    const result = await getReports()
    expect(result).toHaveLength(1)
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).not.toContain('WHERE')
  })

  it('filters by locationId when provided', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleReport] })
    await getReports({ locationId: 7 })
    const [sql, params] = mockDb.query.mock.calls[0]
    expect(sql).toContain('location_id = $1')
    expect(params).toContain(7)
  })
})

describe('createReport', () => {
  it('inserts report and returns it', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleReport] })
    const result = await createReport({
      user_id: 3, location_id: 7, report_type: 'trail',
      content: 'Path is muddy', reporter_name: 'Bob',
    })
    expect(result).toEqual(sampleReport)
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).toContain('INSERT INTO community_reports')
  })

  it('awards 10 XP when user_id is provided', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleReport] })
    await createReport({
      user_id: 3, report_type: 'danger', content: 'Hazard ahead',
    })
    expect(mockDb.query).toHaveBeenCalledTimes(2)
    const [xpSql, xpParams] = mockDb.query.mock.calls[1]
    expect(xpSql).toContain('xp_points')
    expect(xpSql).toContain('+ 10')
    expect(xpParams).toContain(3)
  })

  it('does not update XP when user_id is null', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleReport] })
    await createReport({ report_type: 'crowd', content: 'Very busy' })
    expect(mockDb.query).toHaveBeenCalledTimes(1)
  })
})

describe('upvoteReport', () => {
  it('increments upvotes and returns updated report', async () => {
    const upvoted = { ...sampleReport, upvotes: 3 }
    mockDb.query.mockResolvedValue({ rows: [upvoted] })
    const result = await upvoteReport(1)
    expect(result!.upvotes).toBe(3)
    const [sql, params] = mockDb.query.mock.calls[0]
    expect(sql).toContain('upvotes = upvotes + 1')
    expect(params).toContain(1)
  })

  it('returns null when report not found', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    const result = await upvoteReport(999)
    expect(result).toBeNull()
  })
})