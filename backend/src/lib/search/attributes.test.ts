import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db/raw-client', () => ({ rawDb: { query: vi.fn() } }))

import { detectAttributes } from './attributes'
import { buildHybridSql, ATTRIBUTE_BOOST } from './hybrid'

describe('detectAttributes', () => {
  it.each([
    ['שמורת טבע נגישה לכיסא גלגלים', ['accessible']],
    ['wheelchair accessible nature reserve', ['accessible']],
    ['מסלול מוצל', ['shade']],
    ['shady trail', ['shade']],
    ['מעיין עם מים לרחצה', ['water']],
    ['spring to swim in', ['water']],
    ['מסלול מאתגר במדבר', ['challenging']],
    ['challenging desert hike', ['challenging']],
    ['מסלול מוצל ונגיש עם מים', ['accessible', 'shade', 'water']],
  ])('%s → %j', (q, expected) => {
    expect(detectAttributes(q)).toEqual(expected)
  })

  it('handles Hebrew prefixes', () => {
    expect(detectAttributes('טיול בצל')).toEqual(['shade'])
    expect(detectAttributes('ולטבול')).toEqual(['water'])
  })

  it('does not match inside other words', () => {
    expect(detectAttributes('waterfall')).toEqual([])   // not "water"
    expect(detectAttributes('מעיין צלול')).toEqual([])  // "צלול" is not "צל"
    expect(detectAttributes('hardware store')).toEqual([])
  })

  it('unions across original and translated text, ignoring nulls', () => {
    expect(detectAttributes('shaded trail', 'מסלול מוצל ונגיש')).toEqual(['accessible', 'shade'])
    expect(detectAttributes('beach', null)).toEqual([])
  })
})

describe('buildHybridSql attributes', () => {
  it('boost mode adds a scoped vector list and per-attribute boost, no hard filter', () => {
    const { sql } = buildHybridSql({
      ftsText: 'x', vector: '[1]', boostRegionSlugs: [], limit: 5, attributes: ['accessible', 'shade'],
    })
    expect(sql).toContain('(l.accessible = TRUE AND l.has_shade = TRUE) AS attr_match')
    expect(sql).toContain(`CASE WHEN l.accessible = TRUE THEN ${ATTRIBUTE_BOOST}::float8`)
    expect(sql).not.toMatch(/AND l\.accessible = TRUE\s*\n\)/) // not in the filtered WHERE
  })

  it('filter mode requires attributes and drops the boost', () => {
    const { sql } = buildHybridSql({
      ftsText: 'x', vector: '[1]', boostRegionSlugs: [], limit: 5, attributes: ['water'], attributeMode: 'filter',
    })
    expect(sql).toMatch(/AND l\.has_water = TRUE/)
    expect(sql).toContain('(FALSE) AS attr_match')
    expect(sql).not.toContain('CASE WHEN l.has_water')
  })

  it('treats UI chip attributes and difficulty as hard filters, independent of detected boosts', () => {
    const { sql, params } = buildHybridSql({
      ftsText: 'x', vector: '[1]', boostRegionSlugs: [], limit: 5,
      requiredAttributes: ['accessible'], difficulties: ['מאתגר'], attributes: ['shade'],
    })
    expect(sql).toMatch(/AND l\.accessible = TRUE/)
    expect(sql).toMatch(/l\.difficulty = ANY\(\$\d+::text\[\]\)/)
    expect(params).toContainEqual(['מאתגר'])
    expect(sql).toContain('(l.has_shade = TRUE) AS attr_match') // detected → still a boost
  })

  it('ignores unknown attribute keys', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { sql } = buildHybridSql({ ftsText: 'x', vector: null, boostRegionSlugs: [], limit: 5, attributes: ['1=1; DROP' as any] })
    expect(sql).not.toContain('DROP')
    expect(sql).toContain('(FALSE) AS attr_match')
  })
})
