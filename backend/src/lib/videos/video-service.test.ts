import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/raw-client', () => ({
  rawDb: { query: vi.fn() },
}))

import { rawDb } from '@/lib/db/raw-client'
import { getVideos, createVideo, likeVideo } from './video-service'

const mockDb = rawDb as unknown as { query: ReturnType<typeof vi.fn> }

const sampleVideo = {
  id: 1, title: 'Hiking Galilee', description: 'Great hike',
  region: 'north', uploader_name: 'Alice', video_url: 'https://v.example.com/1',
  thumbnail_url: null, likes_count: 5, views_count: 100, created_at: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getVideos', () => {
  it('returns all videos ordered by created_at DESC', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleVideo] })
    const result = await getVideos()
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Hiking Galilee')
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).toContain('ORDER BY created_at DESC')
  })

  it('returns empty array when no videos', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    const result = await getVideos()
    expect(result).toEqual([])
  })
})

describe('createVideo', () => {
  it('inserts video and returns it', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleVideo] })
    const result = await createVideo({ title: 'New Video', uploader_name: 'Bob' })
    expect(result.title).toBe('Hiking Galilee') // returns what DB returns
    const [sql] = mockDb.query.mock.calls[0]
    expect(sql).toContain('INSERT INTO video_posts')
  })

  it('uses default uploader name when not provided', async () => {
    mockDb.query.mockResolvedValue({ rows: [sampleVideo] })
    await createVideo({ title: 'Anon Video' })
    const [, params] = mockDb.query.mock.calls[0]
    expect(params).toContain('אנונימי')
  })
})

describe('likeVideo', () => {
  it('increments likes_count and returns updated video', async () => {
    const liked = { ...sampleVideo, likes_count: 6 }
    mockDb.query.mockResolvedValue({ rows: [liked] })
    const result = await likeVideo(1)
    expect(result!.likes_count).toBe(6)
    const [sql, params] = mockDb.query.mock.calls[0]
    expect(sql).toContain('likes_count = likes_count + 1')
    expect(params).toContain(1)
  })

  it('returns null when video not found', async () => {
    mockDb.query.mockResolvedValue({ rows: [] })
    const result = await likeVideo(999)
    expect(result).toBeNull()
  })
})
