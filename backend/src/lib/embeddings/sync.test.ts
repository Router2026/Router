import { describe, it, expect, vi } from 'vitest'
import { syncLocationEmbeddings, type SyncDb } from './sync'
import { buildEmbeddingText, hashEmbeddingInput } from './text'
import type { EmbeddingProvider } from './types'

const MODEL = 'test-model'
const DIMS = 3

function provider(fail?: (call: number) => boolean): EmbeddingProvider & { embed: ReturnType<typeof vi.fn> } {
  let call = 0
  return {
    model: MODEL,
    dimensions: DIMS,
    embed: vi.fn(async (texts: string[]) => {
      call++
      if (fail?.(call)) throw new Error('boom')
      return texts.map((_, i) => [i, 0.5, -1])
    }),
  }
}

function row(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id, name: `place ${id}`, description: 'desc', category: 'טבע', region_name: 'גליל',
    difficulty: null, duration_minutes: null, has_water: false, has_shade: false, accessible: false,
    content_hash: null, model: null, ...overrides,
  }
}

function hashFor(r: ReturnType<typeof row>) {
  const text = buildEmbeddingText({
    name: r.name, description: r.description, category: r.category, regionName: r.region_name,
  })
  return hashEmbeddingInput(text, MODEL, DIMS)
}

function fakeDb(rows: ReturnType<typeof row>[]) {
  const writes: { sql: string; params: unknown[] }[] = []
  const db: SyncDb = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('INSERT')) writes.push({ sql, params })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { rows: sql.includes('SELECT') ? (rows as any) : [] }
    }),
  }
  return { db, writes }
}

describe('syncLocationEmbeddings', () => {
  it('embeds only rows that are missing or whose hash/model changed', async () => {
    const fresh = row(1)
    fresh.content_hash = hashFor(fresh) as never
    fresh.model = MODEL as never
    const changed = row(2, { content_hash: 'x'.repeat(64), model: MODEL })
    const otherModel = row(3)
    otherModel.content_hash = hashFor(otherModel) as never
    otherModel.model = 'old-model' as never
    const missing = row(4)

    const { db, writes } = fakeDb([fresh, changed, otherModel, missing])
    const p = provider()
    const result = await syncLocationEmbeddings(db, p)

    expect(result).toMatchObject({ total: 4, upToDate: 1, stale: 3, embedded: 3, failed: 0 })
    expect(p.embed).toHaveBeenCalledTimes(1)
    expect(writes).toHaveLength(1)
    // params: [model, id, vector, hash, id, vector, hash, ...]
    expect(writes[0].params[0]).toBe(MODEL)
    expect([writes[0].params[1], writes[0].params[4], writes[0].params[7]]).toEqual([2, 3, 4])
    expect(writes[0].params[2]).toBe('[0,0.5,-1]')
    expect(writes[0].sql).toContain('ON CONFLICT (location_id) DO UPDATE')
  })

  it('dry run counts but never calls the API or writes', async () => {
    const { db, writes } = fakeDb([row(1), row(2)])
    const p = provider()
    const result = await syncLocationEmbeddings(db, p, { dryRun: true })
    expect(result).toMatchObject({ stale: 2, embedded: 0, dryRun: true })
    expect(p.embed).not.toHaveBeenCalled()
    expect(writes).toHaveLength(0)
  })

  it('respects limit and batch size', async () => {
    const { db, writes } = fakeDb(Array.from({ length: 10 }, (_, i) => row(i + 1)))
    const p = provider()
    const result = await syncLocationEmbeddings(db, p, { limit: 5, batchSize: 2 })
    expect(result).toMatchObject({ stale: 10, embedded: 5 })
    expect(p.embed.mock.calls.map((c) => c[0].length)).toEqual([2, 2, 1])
    expect(writes).toHaveLength(3)
  })

  it('continues after a failed batch and reports it', async () => {
    const { db, writes } = fakeDb(Array.from({ length: 6 }, (_, i) => row(i + 1)))
    const p = provider((call) => call === 2)
    const log = vi.fn()
    const result = await syncLocationEmbeddings(db, p, { batchSize: 2, log })
    expect(result).toMatchObject({ embedded: 4, failed: 2 })
    expect(writes).toHaveLength(2)
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/batch 2 failed .*boom/))
  })

  it('skips rows without a usable name', async () => {
    const { db } = fakeDb([row(1, { name: '  ' }), row(2)])
    const result = await syncLocationEmbeddings(db, provider())
    expect(result).toMatchObject({ total: 2, stale: 1, embedded: 1 })
  })
})
