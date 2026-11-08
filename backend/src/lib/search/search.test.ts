import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db/raw-client', () => ({ rawDb: { query: vi.fn() } }))

import { searchLocations, type SearchDeps } from './search'
import { buildHybridSql, REGION_BOOST } from './hybrid'
import type { EmbeddingProvider } from '@/lib/embeddings'

const DIMS = 768

function row(id: number, score: number, extra: Record<string, unknown> = {}) {
  return {
    id, name: `place ${id}`, category: 'מעיין', latitude: '32.1', longitude: '35.1',
    main_image: null, difficulty: 'קל', duration_minutes: 60, has_water: true, has_shade: false,
    accessible: false, is_featured: false, average_rating: '4.5', photo_credit: null,
    uploaded_by: null, region_id: 1, region_name: 'רמת הגולן', distance_meters: null,
    fts_rank: 1, vec_rank: 2, score, ...extra,
  }
}

function makeDeps(opts: { embedFails?: boolean; translation?: string | null } = {}) {
  const store = new Map<string, unknown>()
  const embedder: EmbeddingProvider = {
    model: 'm',
    dimensions: DIMS,
    embed: vi.fn(async (texts: string[]) => {
      if (opts.embedFails) throw new Error('timeout')
      return texts.map(() => Array(DIMS).fill(0.01))
    }),
  }
  const translator = {
    toHebrew: vi.fn(async () => (opts.translation === undefined ? 'מפל בגולן' : opts.translation)),
  }
  const db = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- typed params so mock.calls is indexable
    query: vi.fn(async (_sql: string, _params: unknown[]) => ({
      rows: [row(1, 0.05), row(2, 0.03, { distance_meters: '1234.5' })],
    })),
  }
  const deps: SearchDeps = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: db as any,
    embedder,
    translator,
    cache: {
      get: <T,>(k: string) => (store.has(k) ? (store.get(k) as T) : null),
      set: (k, v) => void store.set(k, v),
    },
  }
  return { deps, db, embedder, translator, store }
}

describe('searchLocations', () => {
  it('translates English, boosts detected region, embeds the Hebrew text', async () => {
    const { deps, db, embedder, translator } = makeDeps()
    const out = await searchLocations({ q: '  waterfall in the Golan ' }, deps)

    expect(translator.toHebrew).toHaveBeenCalledWith('waterfall in the Golan', expect.anything())
    expect(embedder.embed).toHaveBeenCalledWith(['מפל בגולן'], { timeoutMs: 1500, maxRetries: 0 })
    expect(out.meta).toEqual({
      query: 'waterfall in the Golan',
      searchedAs: 'מפל בגולן',
      translated: true,
      boostedRegions: ['golan_hermon'],
      attributes: [],
      mode: 'hybrid',
    })
    const params = db.query.mock.calls[0][1] as unknown[]
    expect(params).toContain('מפל בגולן')
    expect(params).toContainEqual(['golan_hermon'])
    expect(out.results.map((r) => r.id)).toEqual([1, 2])
    expect(out.results[0].score).toBe(0.05)
    expect(out.results[1].distance_meters).toBe(1234.5)
  })

  it('detects attributes in the original and translated query and passes them to SQL', async () => {
    const { deps, db } = makeDeps({ translation: 'שמורת טבע נגישה' })
    const out = await searchLocations({ q: 'shaded nature reserve' }, deps)
    expect(out.meta.attributes).toEqual(['accessible', 'shade'])
    expect(db.query.mock.calls[0][0]).toContain('l.accessible = TRUE AND l.has_shade = TRUE')
  })

  it('does not translate Hebrew queries', async () => {
    const { deps, translator, embedder } = makeDeps()
    const out = await searchLocations({ q: 'מעיין מוצל' }, deps)
    expect(translator.toHebrew).not.toHaveBeenCalled()
    expect(embedder.embed).toHaveBeenCalledWith(['מעיין מוצל'], expect.anything())
    expect(out.meta.translated).toBe(false)
  })

  it('falls back to the original query when translation fails', async () => {
    const { deps, embedder } = makeDeps({ translation: null })
    const out = await searchLocations({ q: 'quiet spring' }, deps)
    expect(embedder.embed).toHaveBeenCalledWith(['quiet spring'], expect.anything())
    expect(out.meta).toMatchObject({ searchedAs: 'quiet spring', translated: false, mode: 'hybrid' })
  })

  it('degrades to full-text when embedding fails, and does not cache that result', async () => {
    const { deps, db, store } = makeDeps({ embedFails: true })
    const out = await searchLocations({ q: 'מעיין' }, deps)
    expect(out.meta.mode).toBe('fts')
    const params = db.query.mock.calls[0][1] as unknown[]
    expect(params).toContain(null) // vector param
    expect([...store.keys()].some((k) => k.startsWith('search:v1:'))).toBe(false)
  })

  it('serves repeat queries from cache without calling external services again', async () => {
    const { deps, db, embedder, translator } = makeDeps()
    await searchLocations({ q: 'waterfall in the Golan' }, deps)
    await searchLocations({ q: 'waterfall in the Golan' }, deps)
    expect(db.query).toHaveBeenCalledTimes(1)
    expect(embedder.embed).toHaveBeenCalledTimes(1)
    expect(translator.toHebrew).toHaveBeenCalledTimes(1)
  })

  it('clamps limit and rejects empty queries', async () => {
    const { deps, db } = makeDeps()
    await searchLocations({ q: 'x', limit: 999 }, deps)
    // 50 max + 10 headroom for de-duplication
    expect((db.query.mock.calls[0][1] as unknown[]).at(-1)).toBe(60)
    await expect(searchLocations({ q: '   ' }, deps)).rejects.toThrow(/empty query/)
  })

  it('removes duplicate places by normalized name, keeping the higher-scored one', async () => {
    const { deps, db } = makeDeps()
    db.query.mockResolvedValueOnce({
      rows: [
        row(1, 0.05, { name: 'שמורת עין מבוע' }),
        row(2, 0.04, { name: 'שמורת  עין-מבוע' }),
        row(3, 0.03, { name: 'עין פרת' }),
      ],
    })
    const out = await searchLocations({ q: 'מעיין', limit: 2 }, deps)
    expect(out.results.map((r) => r.id)).toEqual([1, 3])
  })

  it('treats missing and null/empty optional filters as the same cache entry', async () => {
    const { deps, db } = makeDeps()
    await searchLocations({ q: 'מעיין', near: null, regions: [] }, deps)
    await searchLocations({ q: 'מעיין' }, deps)
    expect(db.query).toHaveBeenCalledTimes(1)
  })
})

describe('buildHybridSql', () => {
  it('adds hard filters and distance only when requested', () => {
    const plain = buildHybridSql({ ftsText: 'x', vector: null, boostRegionSlugs: [], limit: 10 })
    expect(plain.sql).not.toContain('ST_DWithin')
    expect(plain.sql).toContain('NULL::float8 AS distance_meters')
    expect(plain.sql).not.toContain('r.slug = ANY($1')

    const filtered = buildHybridSql({
      ftsText: 'x', vector: '[1]', boostRegionSlugs: ['negev'], limit: 10,
      regions: ['negev'], categories: ['מעיין'], near: { lat: 31, lng: 35, radiusM: 5000 },
    })
    expect(filtered.sql).toContain('ST_DWithin')
    expect(filtered.sql).toContain('ST_Distance')
    expect(filtered.params).toEqual(expect.arrayContaining([['negev'], ['מעיין'], 35, 31, 5000, REGION_BOOST]))
  })

  it('escapes LIKE wildcards in the query text', () => {
    const { params } = buildHybridSql({ ftsText: '100%_off\\', vector: null, boostRegionSlugs: [], limit: 5 })
    expect(params).toContain('%100\\%\\_off\\\\%')
  })

  it('never interpolates user text into SQL', () => {
    const evil = "'; DROP TABLE locations; --"
    const { sql } = buildHybridSql({ ftsText: evil, vector: null, boostRegionSlugs: [evil], limit: 5, regions: [evil], categories: [evil] })
    expect(sql).not.toContain('DROP TABLE')
  })
})
