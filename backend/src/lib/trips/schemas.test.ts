import { describe, it, expect } from 'vitest'
import {
  TripInputSchema,
  RegenerateStopSchema,
  POI_CATEGORIES,
  REGION_HIERARCHY,
  REGIONS,
  ALL_SUB_AREAS,
} from './schemas'

const validInput = {
  groupSize: 2,
  travelerType: 'couple' as const,
  durationDays: 3,
  poiCategories: ['hiking_trail' as const],
  areas: ['galilee'],
  dayStartTime: '09:00',
  dayEndTime: '18:00',
}

describe('POI_CATEGORIES', () => {
  it('includes the five expected categories', () => {
    expect(POI_CATEGORIES).toContain('restaurant')
    expect(POI_CATEGORIES).toContain('hiking_trail')
    expect(POI_CATEGORIES).toContain('campsite')
    expect(POI_CATEGORIES).toHaveLength(5)
  })
})

describe('REGION_HIERARCHY', () => {
  it('has four top-level regions', () => {
    expect(Object.keys(REGION_HIERARCHY)).toHaveLength(4)
  })

  it('each region has label, emoji, and subAreas', () => {
    for (const region of Object.values(REGION_HIERARCHY)) {
      expect(region.label).toBeTruthy()
      expect(region.emoji).toBeTruthy()
      expect(Object.keys(region.subAreas).length).toBeGreaterThan(0)
    }
  })
})

describe('REGIONS', () => {
  it('matches REGION_HIERARCHY keys', () => {
    expect(REGIONS).toEqual(expect.arrayContaining(['galilee', 'jerusalem', 'tel_aviv', 'negev']))
  })
})

describe('ALL_SUB_AREAS', () => {
  it('contains all subarea keys from all regions', () => {
    expect(ALL_SUB_AREAS).toContain('upper_galilee')
    expect(ALL_SUB_AREAS).toContain('jerusalem_city')
    expect(ALL_SUB_AREAS.length).toBeGreaterThan(10)
  })
})

describe('TripInputSchema', () => {
  it('parses a valid input', () => {
    expect(TripInputSchema.safeParse(validInput).success).toBe(true)
  })

  it('defaults subAreas to empty array', () => {
    const result = TripInputSchema.parse(validInput)
    expect(result.subAreas).toEqual([])
  })

  it('defaults dayStartTime to 09:00 and dayEndTime to 20:00', () => {
    const { dayStartTime, dayEndTime, ...rest } = validInput
    const result = TripInputSchema.parse(rest)
    expect(result.dayStartTime).toBe('09:00')
    expect(result.dayEndTime).toBe('20:00')
  })

  it('rejects groupSize above 20', () => {
    expect(TripInputSchema.safeParse({ ...validInput, groupSize: 21 }).success).toBe(false)
  })

  it('rejects groupSize below 1', () => {
    expect(TripInputSchema.safeParse({ ...validInput, groupSize: 0 }).success).toBe(false)
  })

  it('rejects empty poiCategories', () => {
    expect(TripInputSchema.safeParse({ ...validInput, poiCategories: [] }).success).toBe(false)
  })

  it('rejects empty areas', () => {
    expect(TripInputSchema.safeParse({ ...validInput, areas: [] }).success).toBe(false)
  })

  it('rejects durationDays above 14', () => {
    expect(TripInputSchema.safeParse({ ...validInput, durationDays: 15 }).success).toBe(false)
  })

  it('rejects end time before start time (refine)', () => {
    const result = TripInputSchema.safeParse({
      ...validInput,
      dayStartTime: '18:00',
      dayEndTime: '09:00',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid time format', () => {
    expect(TripInputSchema.safeParse({ ...validInput, dayStartTime: '9:00' }).success).toBe(false)
  })

  it('accepts userLocation when provided', () => {
    const result = TripInputSchema.safeParse({ ...validInput, userLocation: { lat: 31.5, lng: 35.0 } })
    expect(result.success).toBe(true)
  })
})

describe('RegenerateStopSchema', () => {
  it('parses valid indices', () => {
    expect(RegenerateStopSchema.safeParse({ dayIndex: 0, stopIndex: 2 }).success).toBe(true)
  })

  it('rejects negative dayIndex', () => {
    expect(RegenerateStopSchema.safeParse({ dayIndex: -1, stopIndex: 0 }).success).toBe(false)
  })

  it('rejects non-integer values', () => {
    expect(RegenerateStopSchema.safeParse({ dayIndex: 1.5, stopIndex: 0 }).success).toBe(false)
  })
})
