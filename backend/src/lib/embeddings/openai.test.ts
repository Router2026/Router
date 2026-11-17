import { describe, it, expect, vi } from 'vitest'
import { OpenAIEmbeddingProvider } from './openai'
import { EmbeddingError } from './types'

const DIMS = 4

function vec(seed: number): number[] {
  return Array.from({ length: DIMS }, (_, i) => seed + i / 10)
}

/** Fake client: echoes one vector per input, optionally shuffled / broken. */
function fakeClient(opts: { reverse?: boolean; dims?: number; drop?: boolean; fail?: Error } = {}) {
  const create = vi.fn(async (body: { input: string[] }) => {
    if (opts.fail) throw opts.fail
    let data = body.input.map((_, index) => ({
      index,
      embedding: Array.from({ length: opts.dims ?? DIMS }, (_, i) => index + i / 10),
      object: 'embedding' as const,
    }))
    if (opts.drop) data = data.slice(1)
    if (opts.reverse) data = [...data].reverse()
    return { data }
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: { embeddings: { create } } as any, create }
}

describe('OpenAIEmbeddingProvider', () => {
  it('returns [] for empty input without calling the API', async () => {
    const { client, create } = fakeClient()
    const p = new OpenAIEmbeddingProvider('m', DIMS, client)
    expect(await p.embed([])).toEqual([])
    expect(create).not.toHaveBeenCalled()
  })

  it('passes model, dimensions, float encoding and request options', async () => {
    const { client, create } = fakeClient()
    const p = new OpenAIEmbeddingProvider('text-embedding-3-small', DIMS, client)
    await p.embed(['a'], { timeoutMs: 1234, maxRetries: 0 })
    expect(create).toHaveBeenCalledWith(
      { model: 'text-embedding-3-small', input: ['a'], dimensions: DIMS, encoding_format: 'float' },
      { timeout: 1234, maxRetries: 0 },
    )
  })

  it('orders results by index, not response order', async () => {
    const { client } = fakeClient({ reverse: true })
    const p = new OpenAIEmbeddingProvider('m', DIMS, client)
    expect(await p.embed(['a', 'b', 'c'])).toEqual([vec(0), vec(1), vec(2)])
  })

  it('splits large inputs into batches of 100 and preserves overall order', async () => {
    const { client, create } = fakeClient()
    const p = new OpenAIEmbeddingProvider('m', DIMS, client)
    const texts = Array.from({ length: 250 }, (_, i) => `t${i}`)
    const out = await p.embed(texts)
    expect(create).toHaveBeenCalledTimes(3)
    expect(create.mock.calls.map((c) => c[0].input.length)).toEqual([100, 100, 50])
    expect(out).toHaveLength(250)
    expect(out[100]).toEqual(vec(0)) // first item of second batch
  })

  it('rejects empty strings', async () => {
    const { client } = fakeClient()
    const p = new OpenAIEmbeddingProvider('m', DIMS, client)
    await expect(p.embed(['ok', '  '])).rejects.toBeInstanceOf(EmbeddingError)
  })

  it('rejects wrong dimensions', async () => {
    const { client } = fakeClient({ dims: 3 })
    const p = new OpenAIEmbeddingProvider('m', DIMS, client)
    await expect(p.embed(['a'])).rejects.toThrow(/Expected 4 dimensions, got 3/)
  })

  it('rejects a short response', async () => {
    const { client } = fakeClient({ drop: true })
    const p = new OpenAIEmbeddingProvider('m', DIMS, client)
    await expect(p.embed(['a', 'b'])).rejects.toThrow(/Expected 2 embeddings, got 1/)
  })

  it('wraps API errors in EmbeddingError', async () => {
    const { client } = fakeClient({ fail: new Error('429 rate limited') })
    const p = new OpenAIEmbeddingProvider('m', DIMS, client)
    await expect(p.embed(['a'])).rejects.toThrow(/request failed: 429 rate limited/)
  })

  it('requires OPENAI_API_KEY when no client is injected', () => {
    const saved = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    try {
      expect(() => new OpenAIEmbeddingProvider('m', DIMS)).toThrow(/OPENAI_API_KEY/)
    } finally {
      if (saved !== undefined) process.env.OPENAI_API_KEY = saved
    }
  })
})
