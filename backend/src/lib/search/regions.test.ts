import { describe, it, expect } from 'vitest'
import { detectRegions, containsHebrew } from './regions'

describe('detectRegions', () => {
  it.each([
    ['waterfall in the Golan', ['golan_hermon']],
    ['Golan Heights hikes', ['golan_hermon']],
    ['מפל בגולן', ['golan_hermon']],
    ['טיול ברמת הגולן', ['golan_hermon']],
    ['shaded spring near Jerusalem', ['jerusalem_gates']],
    ['מעיין ליד ירושלים', ['jerusalem_gates']],
    ['beach near the Dead Sea', ['judean_desert']],
    ['מכתש רמון בלילה', ['negev']],
    ['snorkeling in Eilat', ['paran_eilat']],
  ])('%s → %j', (q, slugs) => {
    expect(detectRegions(q).slugs).toEqual(slugs)
  })

  it('prefers the specific alias over its substring', () => {
    expect(detectRegions('טיול בגליל עליון').slugs).toEqual(['galil_u'])
  })

  it('maps ambiguous umbrella terms to several regions', () => {
    expect(detectRegions('hikes in the Galilee').slugs.sort()).toEqual(['galil_t', 'galil_u'])
  })

  it('detects multiple regions', () => {
    expect(detectRegions('Golan or Carmel').slugs.sort()).toEqual(['carmel_emek', 'golan_hermon'])
  })

  it('does not match inside other words', () => {
    expect(detectRegions('negevite').slugs).toEqual([])
    expect(detectRegions('aramaic').slugs).toEqual([]) // contains "arama" not "arava"
    expect(detectRegions('בריכה מוצלת').slugs).toEqual([])
  })

  it('returns nothing for region-free queries', () => {
    expect(detectRegions('quiet spring with shade')).toEqual({ slugs: [], matched: [] })
  })
})

describe('containsHebrew', () => {
  it('detects Hebrew characters', () => {
    expect(containsHebrew('ein gedi עין גדי')).toBe(true)
    expect(containsHebrew('ein gedi')).toBe(false)
  })
})
