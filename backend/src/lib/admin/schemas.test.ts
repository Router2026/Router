import { describe, it, expect } from 'vitest'
import { PoiRecordSchema, DataSourceSchema } from './schemas'

describe('PoiRecordSchema', () => {
  const valid = {
    name: 'Ein Gedi',
    category: 'hiking_trail' as const,
    region: 'Dead Sea',
    description: 'A beautiful nature reserve',
    address: 'Ein Gedi, Israel',
    latitude: 31.46,
    longitude: 35.39,
  }

  it('parses a valid POI record', () => {
    const result = PoiRecordSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('defaults isActive to true', () => {
    const result = PoiRecordSchema.parse(valid)
    expect(result.isActive).toBe(true)
  })

  it('rejects invalid category', () => {
    const result = PoiRecordSchema.safeParse({ ...valid, category: 'unknown' })
    expect(result.success).toBe(false)
  })

  it('rejects latitude out of range', () => {
    expect(PoiRecordSchema.safeParse({ ...valid, latitude: 91 }).success).toBe(false)
    expect(PoiRecordSchema.safeParse({ ...valid, latitude: -91 }).success).toBe(false)
  })

  it('rejects empty required strings', () => {
    expect(PoiRecordSchema.safeParse({ ...valid, name: '' }).success).toBe(false)
    expect(PoiRecordSchema.safeParse({ ...valid, description: '' }).success).toBe(false)
  })

  it('rejects invalid sourceUrl', () => {
    const result = PoiRecordSchema.safeParse({ ...valid, sourceUrl: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('accepts valid optional sourceUrl', () => {
    const result = PoiRecordSchema.safeParse({ ...valid, sourceUrl: 'https://example.com' })
    expect(result.success).toBe(true)
  })
})

describe('DataSourceSchema', () => {
  const valid = {
    name: 'Trail Source',
    category: 'hiking_trail' as const,
    sourceUrl: 'https://example.com/trails',
  }

  it('parses valid data source', () => {
    expect(DataSourceSchema.safeParse(valid).success).toBe(true)
  })

  it('defaults syncCadenceHours to 168', () => {
    const result = DataSourceSchema.parse(valid)
    expect(result.syncCadenceHours).toBe(168)
  })

  it('rejects syncCadenceHours below 1', () => {
    expect(DataSourceSchema.safeParse({ ...valid, syncCadenceHours: 0 }).success).toBe(false)
  })

  it('rejects invalid category', () => {
    expect(DataSourceSchema.safeParse({ ...valid, category: 'beach' }).success).toBe(false)
  })
})
