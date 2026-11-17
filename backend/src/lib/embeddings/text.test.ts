import { describe, it, expect } from 'vitest'
import {
  buildEmbeddingText,
  hashEmbeddingInput,
  normalizeQuery,
  toPgVector,
  MAX_QUERY_CHARS,
} from './text'

describe('buildEmbeddingText', () => {
  const full = {
    name: '  עין  חמד ',
    description: 'מעיין\nמוצל   עם בריכה',
    category: 'מעיינות',
    regionName: 'ירושלים',
    difficulty: 'קל',
    durationMinutes: 90,
    hasWater: true,
    hasShade: true,
    accessible: false,
  }

  it('builds name / meta / features / description lines with collapsed whitespace', () => {
    expect(buildEmbeddingText(full)).toBe(
      [
        'עין חמד',
        'מעיינות · ירושלים',
        'יש מים (water), מוצל (shaded), רמת קושי: קל, משך: 1.5 שעות',
        'מעיין מוצל עם בריכה',
      ].join('\n'),
    )
  })

  it('omits empty sections', () => {
    expect(buildEmbeddingText({ name: 'הר מירון' })).toBe('הר מירון')
  })

  it('includes accessibility in both languages', () => {
    expect(buildEmbeddingText({ name: 'x', accessible: true })).toContain('נגיש (wheelchair accessible)')
  })

  it('formats short durations in minutes and ignores non-positive ones', () => {
    expect(buildEmbeddingText({ name: 'x', durationMinutes: 45 })).toContain('משך: 45 דקות')
    expect(buildEmbeddingText({ name: 'x', durationMinutes: 0 })).toBe('x')
  })

  it('truncates very long descriptions', () => {
    const text = buildEmbeddingText({ name: 'x', description: 'א'.repeat(5000) })
    expect(text.length).toBeLessThan(2100)
  })

  it('throws without a name', () => {
    expect(() => buildEmbeddingText({ name: '   ' })).toThrow(/name is required/)
  })
})

describe('hashEmbeddingInput', () => {
  it('is a stable 64-char hex sha256', () => {
    const h = hashEmbeddingInput('abc', 'm', 768)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(hashEmbeddingInput('abc', 'm', 768)).toBe(h)
  })

  it('changes when text, model, or dimensions change', () => {
    const base = hashEmbeddingInput('abc', 'm', 768)
    expect(hashEmbeddingInput('abd', 'm', 768)).not.toBe(base)
    expect(hashEmbeddingInput('abc', 'm2', 768)).not.toBe(base)
    expect(hashEmbeddingInput('abc', 'm', 1536)).not.toBe(base)
  })
})

describe('normalizeQuery', () => {
  it('trims, collapses whitespace and caps length', () => {
    expect(normalizeQuery('  מעיין   מוצל \n')).toBe('מעיין מוצל')
    expect(normalizeQuery('a'.repeat(1000))).toHaveLength(MAX_QUERY_CHARS)
  })
})

describe('toPgVector', () => {
  it('serializes to pgvector literal', () => {
    expect(toPgVector([0.1, -2, 3], 3)).toBe('[0.1,-2,3]')
  })

  it('rejects wrong dimensions and non-finite values', () => {
    expect(() => toPgVector([1, 2], 3)).toThrow(/expected 3/)
    expect(() => toPgVector([1, NaN, 3], 3)).toThrow(/non-finite/)
  })
})
