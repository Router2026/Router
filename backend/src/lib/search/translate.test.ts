import { describe, it, expect } from 'vitest'
import { needsTranslation, sanitizeTranslation, GroqQueryTranslator } from './translate'

describe('needsTranslation', () => {
  it('translates Latin-only queries', () => {
    expect(needsTranslation('waterfall in the Golan')).toBe(true)
  })
  it('skips Hebrew and mixed queries', () => {
    expect(needsTranslation('מפל בגולן')).toBe(false)
    expect(needsTranslation('ein gedi עין גדי')).toBe(false)
  })
  it('skips queries without letters', () => {
    expect(needsTranslation('123')).toBe(false)
  })
})

describe('sanitizeTranslation', () => {
  it('keeps a clean Hebrew query', () => {
    expect(sanitizeTranslation('מפל בגולן')).toBe('מפל בגולן')
  })
  it('strips quotes, extra lines and whitespace', () => {
    expect(sanitizeTranslation('  "מפל   בגולן"\nTranslation note: ...')).toBe('מפל בגולן')
  })
  it('rejects empty or non-Hebrew output', () => {
    expect(sanitizeTranslation('')).toBeNull()
    expect(sanitizeTranslation(null)).toBeNull()
    expect(sanitizeTranslation('Sorry, I cannot help with that')).toBeNull()
  })
  it('caps length', () => {
    expect(sanitizeTranslation('א'.repeat(1000))!.length).toBe(300)
  })
})

describe('GroqQueryTranslator', () => {
  it('returns null without an API key instead of throwing', async () => {
    const t = new GroqQueryTranslator('')
    await expect(t.toHebrew('waterfall', { timeoutMs: 100 })).resolves.toBeNull()
  })
})
