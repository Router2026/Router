/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db/raw-client', () => ({ rawDb: { query: vi.fn() } }))

import { runSearchAgent, executeSearchTool, CandidatePool, buildSearchPrompt, shortlistSize, MAX_SEARCH_MODEL_CALLS } from './search-agent'
import type { TripIntent } from './intent-agent'
import type { PoiCandidate } from './types'
import { emptyUsage } from './llm'

function poi(id: number, over: Partial<PoiCandidate> = {}): PoiCandidate {
  return {
    id, name: `מקום ${id}`, category: 'מעיין', regionName: 'גליל עליון', lat: 33, lng: 35.5,
    durationMinutes: 60, difficulty: 'קל', hasWater: true, hasShade: false, accessible: false,
    rating: 4.5, description: '', mainImage: null, sources: ['postgis'], ...over,
  }
}

const INTENT: TripIntent = {
  regions: ['galil_u'], styles: ['water'], difficulty: 'any', needs_water: true, needs_shade: false,
  needs_accessible: false, date: '2026-11-25', start_time: '08:00', max_stops: 3, anchor: null,
  search_query_he: 'מסלול מים', language: 'he',
}

const toolUse = (id: string, name: string, input: unknown) => ({ type: 'tool_use', id, name, input })

function scriptedClient(turns: any[][]) {
  const create = vi.fn(async () => {
    const content = turns.shift() ?? [{ type: 'text', text: 'done' }]
    const hasTool = content.some((b: any) => b.type === 'tool_use')
    return { content, stop_reason: hasTool ? 'tool_use' : 'end_turn', usage: { input_tokens: 100, output_tokens: 10 } }
  })
  return { client: { messages: { create } } as never, create }
}

function searchDeps() {
  return {
    postgis: vi.fn(async () => [poi(1, { description: 'מעיין עם בריכה' }), poi(2), poi(3)]),
    semantic: vi.fn(async () => [poi(2, { sources: ['semantic'] }), poi(4, { sources: ['semantic'] })]),
  }
}

describe('CandidatePool', () => {
  it('merges sources by id and ranks places found by both tools first', () => {
    const pool = new CandidatePool()
    pool.add([poi(1), poi(2)])
    pool.add([poi(2, { sources: ['semantic'], description: 'x' }), poi(3, { sources: ['semantic'] })])
    expect(pool.ranked().map((c) => c.id)).toEqual([2, 1, 3])
    expect(pool.byId.get(2)!.sources).toEqual(['postgis', 'semantic'])
  })
})

describe('executeSearchTool', () => {
  it('postgis_search drops unknown regions/categories and needs at least one region', async () => {
    const d = searchDeps()
    const pool = new CandidatePool()
    const out: any = await executeSearchTool('postgis_search', { regions: ['nowhere'], categories: [], difficulty: 'any' }, pool, d)
    expect(out.error).toMatch(/region/)
    expect(d.postgis).not.toHaveBeenCalled()

    await executeSearchTool('postgis_search', { regions: ['galil_u', 'x'], categories: ['מעיין', 'DROP TABLE'], difficulty: 'weird' }, pool, d)
    expect(d.postgis).toHaveBeenCalledWith({ regions: ['galil_u'], categories: ['מעיין'], difficulty: 'any', anchor: null })
  })

  it('semantic_search sanitizes the query and whitelists attributes', async () => {
    const d = searchDeps()
    const out: any = await executeSearchTool('semantic_search', { query_he: '<b>מים</b>', regions: [], require: ['water', 'evil'] }, new CandidatePool(), d)
    expect(d.semantic).toHaveBeenCalledWith({ query_he: 'b מים /b', regions: [], require: ['water'], anchor: null })
    expect(out.places[0]).not.toHaveProperty('lat')
  })
})

describe('anchor', () => {
  const ANCHOR = { lat: 30.61, lng: 34.8 }

  it('lets postgis_search run without a region and passes the server-side anchor to both tools', async () => {
    const d = searchDeps()
    const pool = new CandidatePool()
    const out: any = await executeSearchTool('postgis_search', { regions: [], categories: [], difficulty: 'any' }, pool, d, ANCHOR)
    expect(out.error).toBeUndefined()
    expect(d.postgis).toHaveBeenCalledWith({ regions: [], categories: [], difficulty: 'any', anchor: ANCHOR })
    await executeSearchTool('semantic_search', { query_he: 'מסלול', regions: [], require: [] }, pool, d, ANCHOR)
    expect(d.semantic).toHaveBeenCalledWith({ query_he: 'מסלול', regions: [], require: [], anchor: ANCHOR })
  })

  it('shows distance_km to the model and names the anchor in the prompt', async () => {
    const d = { ...searchDeps(), postgis: vi.fn(async () => [poi(1, { distanceKm: 3.2 })]) }
    const out: any = await executeSearchTool('postgis_search', { regions: ['negev'], categories: [], difficulty: 'any' }, new CandidatePool(), d, ANCHOR)
    expect(out.places[0].distance_km).toBe(3.2)
    const p = buildSearchPrompt({ ...INTENT, anchor: { name: 'מצפה רמון', ...ANCHOR } })
    expect(p).toContain('sorted by distance from מצפה רמון')
    expect(p).toContain('prefer small distance_km')
  })
})

describe('buildSearchPrompt', () => {
  it('asks for parallel calls and a shortlist twice the stop count', () => {
    const p = buildSearchPrompt(INTENT)
    expect(p).toContain('in parallel')
    expect(p).toContain(`with the ${shortlistSize(INTENT)} best-matching ids`)
    expect(shortlistSize(INTENT)).toBe(6)
  })
})

describe('runSearchAgent', () => {
  it('runs both tools in one turn, returns all results in one message, and keeps only known ids', async () => {
    const { client, create } = scriptedClient([
      [toolUse('a', 'postgis_search', { regions: ['galil_u'], categories: ['מעיין'], difficulty: 'any' }),
       toolUse('b', 'semantic_search', { query_he: 'מסלול מים', regions: ['galil_u'], require: ['water'] })],
      [toolUse('c', 'submit_candidates', { picks: [{ id: 2, why: 'both' }, { id: 999, why: 'invented' }, { id: 2, why: 'dup' }, { id: 1, why: 'pool' }] })],
    ])
    const d = searchDeps()
    const usage = emptyUsage()
    const res = await runSearchAgent(INTENT, { client, model: 'm', usage, ...d })

    expect(res.usedFallback).toBe(false)
    expect(res.candidates.map((c) => c.id)).toEqual([2, 1])
    expect(res.candidates[0].matchReason).toBe('both')
    expect(res.pool.map((c) => c.id)).toEqual([2, 1, 3, 4])
    expect(usage.calls).toBe(2)

    const second = (create.mock.calls[1] as any[])[0]
    const toolResults = second.messages.at(-1).content
    expect(toolResults.map((r: any) => r.tool_use_id)).toEqual(['a', 'b'])
  })

  it('falls back to the ranked pool when the model never submits', async () => {
    const turns = Array.from({ length: MAX_SEARCH_MODEL_CALLS }, (_, i) => [
      toolUse(`s${i}`, 'semantic_search', { query_he: 'מים', regions: [], require: [] }),
    ])
    const d = searchDeps()
    const res = await runSearchAgent(INTENT, { ...scriptedClient(turns), model: 'm', ...d })
    expect(res.usedFallback).toBe(true)
    expect(res.candidates.map((c) => c.id)).toEqual([2, 4])
  })

  it('reports a failing tool as an error result instead of crashing', async () => {
    const { client, create } = scriptedClient([
      [toolUse('a', 'postgis_search', { regions: ['galil_u'], categories: [], difficulty: 'any' })],
      [toolUse('c', 'submit_candidates', { picks: [] })],
    ])
    const d = { postgis: vi.fn(async () => { throw new Error('db down') }), semantic: vi.fn(async () => []) }
    const res = await runSearchAgent(INTENT, { client, model: 'm', ...d })
    const r = ((create.mock.calls[1] as any[])[0]).messages.at(-1).content[0]
    expect(r.is_error).toBe(true)
    expect(res.candidates).toEqual([])
  })

  it('throws on refusal', async () => {
    const create = vi.fn(async () => ({ content: [], stop_reason: 'refusal', usage: { input_tokens: 1, output_tokens: 1 } }))
    await expect(runSearchAgent(INTENT, { client: { messages: { create } } as never, model: 'm', ...searchDeps() })).rejects.toThrow(/refused/)
  })
})
