import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Tests without SUPABASE_URL ────────────────────────────────────────────────

describe('getImageUrl — no SUPABASE_URL', () => {
  // Import fresh module with empty SUPABASE_URL (default in test env)
  let getImageUrl: (src: string | null | undefined, size: import('./imageUtils').ImageSize) => string

  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('VITE_SUPABASE_URL', '')
    const mod = await import('./imageUtils')
    getImageUrl = mod.getImageUrl
  })

  it('returns empty string for null', () => {
    expect(getImageUrl(null, 'card')).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(getImageUrl(undefined, 'card')).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(getImageUrl('', 'card')).toBe('')
  })

  it('returns src unchanged when SUPABASE_URL is not set', () => {
    const url = 'https://cdn.example.com/image.png'
    expect(getImageUrl(url, 'card')).toBe(url)
  })

  it('returns blob URL unchanged', () => {
    const url = 'blob:http://localhost/abc123'
    expect(getImageUrl(url, 'marker')).toBe(url)
  })

  it('returns data URI unchanged', () => {
    const url = 'data:image/png;base64,abc'
    expect(getImageUrl(url, 'thumb')).toBe(url)
  })
})

// ── Tests with SUPABASE_URL set ───────────────────────────────────────────────

const FAKE_URL = 'https://abc123.supabase.co'

describe('getImageUrl — with SUPABASE_URL', () => {
  let getImageUrl: (src: string | null | undefined, size: import('./imageUtils').ImageSize) => string

  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('VITE_SUPABASE_URL', FAKE_URL)
    const mod = await import('./imageUtils')
    getImageUrl = mod.getImageUrl
  })

  const storageUrl = (path: string) =>
    `${FAKE_URL}/storage/v1/object/public/${path}`

  it('transforms a supabase storage URL for card size', () => {
    const src = storageUrl('images/photo.jpg')
    const result = getImageUrl(src, 'card')
    expect(result).toBe(
      `${FAKE_URL}/storage/v1/render/image/public/images/photo.jpg?width=420&quality=75&format=webp`
    )
  })

  it('transforms a supabase storage URL for marker size', () => {
    const src = storageUrl('avatars/user.png')
    const result = getImageUrl(src, 'marker')
    expect(result).toBe(
      `${FAKE_URL}/storage/v1/render/image/public/avatars/user.png?width=80&quality=60&format=webp`
    )
  })

  it('transforms a supabase storage URL for hero size', () => {
    const src = storageUrl('bucket/dir/image.jpg')
    const result = getImageUrl(src, 'hero')
    expect(result).toBe(
      `${FAKE_URL}/storage/v1/render/image/public/bucket/dir/image.jpg?width=820&quality=82&format=webp`
    )
  })

  it('transforms a supabase storage URL for lightbox size', () => {
    const src = storageUrl('media/full.jpg')
    const result = getImageUrl(src, 'lightbox')
    expect(result).toBe(
      `${FAKE_URL}/storage/v1/render/image/public/media/full.jpg?width=1400&quality=88&format=webp`
    )
  })

  it('transforms a supabase storage URL for thumb size', () => {
    const src = storageUrl('thumbs/small.jpg')
    const result = getImageUrl(src, 'thumb')
    expect(result).toBe(
      `${FAKE_URL}/storage/v1/render/image/public/thumbs/small.jpg?width=120&quality=65&format=webp`
    )
  })

  it('returns src unchanged for a URL not from this supabase project', () => {
    const externalUrl = 'https://other.supabase.co/storage/v1/object/public/bucket/img.jpg'
    expect(getImageUrl(externalUrl, 'card')).toBe(externalUrl)
  })

  it('returns src unchanged for a CDN URL', () => {
    const cdnUrl = 'https://cdn.example.com/image.jpg'
    expect(getImageUrl(cdnUrl, 'card')).toBe(cdnUrl)
  })

  it('returns src unchanged for malformed supabase URL with no slash after bucket', () => {
    // storagePrefix match but no slash in path → malformed
    const malformed = `${FAKE_URL}/storage/v1/object/public/bucketonly`
    expect(getImageUrl(malformed, 'card')).toBe(malformed)
  })

  it('returns empty string for null even with SUPABASE_URL set', () => {
    expect(getImageUrl(null, 'card')).toBe('')
  })
})

// ── getSrcSet tests ───────────────────────────────────────────────────────────

describe('getSrcSet — no SUPABASE_URL', () => {
  let getSrcSet: (src: string | null | undefined, size: import('./imageUtils').ImageSize) => string

  beforeEach(async () => {
    vi.resetModules()
    vi.stubEnv('VITE_SUPABASE_URL', '')
    const mod = await import('./imageUtils')
    getSrcSet = mod.getSrcSet
  })

  it('returns empty string for null', () => {
    expect(getSrcSet(null, 'card')).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(getSrcSet(undefined, 'card')).toBe('')
  })

  it('returns srcset with correct widths for card', () => {
    const url = 'https://example.com/img.jpg'
    const result = getSrcSet(url, 'card')
    expect(result).toContain('420w')
    expect(result).toContain('840w')
    expect(result).toContain(url)
  })

  it('returns srcset for lightbox size', () => {
    const url = 'https://example.com/img.jpg'
    const result = getSrcSet(url, 'lightbox')
    expect(result).toContain('1400w')
    expect(result).toContain('1600w') // capped at 1600
  })

  it('returns srcset for marker size', () => {
    const url = 'https://example.com/img.jpg'
    const result = getSrcSet(url, 'marker')
    expect(result).toContain('80w')
    expect(result).toContain('160w')
  })

  it('caps retina width at 1600 for large sizes', () => {
    const url = 'https://example.com/img.jpg'
    const result = getSrcSet(url, 'lightbox')
    // 1400 * 2 = 2800, but capped at 1600
    expect(result).toContain('1600w')
    expect(result).not.toContain('2800w')
  })

  it('uses hero for card retina variant', () => {
    // card retina uses 'hero' size, not 'lightbox'
    const url = 'https://example.com/img.jpg'
    const result = getSrcSet(url, 'card')
    // Both URLs are the same (no supabase transform), but widths differ
    expect(result.split(',').length).toBe(2)
  })
})
