import { describe, it, expect } from 'vitest'
import { TripStopSchema, AccommodationSchema, TripPlanSchema } from './schemas'

const validStop = {
  name: 'Ein Gedi',
  latitude: 31.46,
  longitude: 35.39,
}

describe('TripStopSchema', () => {
  it('parses a minimal valid stop', () => {
    const result = TripStopSchema.safeParse(validStop)
    expect(result.success).toBe(true)
  })

  it('defaults visitDurationMinutes to 60', () => {
    const result = TripStopSchema.parse(validStop)
    expect(result.visitDurationMinutes).toBe(60)
  })

  it('clamps visitDurationMinutes to 15 minimum', () => {
    const result = TripStopSchema.parse({ ...validStop, visitDurationMinutes: 5 })
    expect(result.visitDurationMinutes).toBe(15)
  })

  it('clamps visitDurationMinutes to 480 maximum', () => {
    const result = TripStopSchema.parse({ ...validStop, visitDurationMinutes: 999 })
    expect(result.visitDurationMinutes).toBe(480)
  })

  it('rejects empty name', () => {
    expect(TripStopSchema.safeParse({ ...validStop, name: '' }).success).toBe(false)
  })

  it('rejects latitude > 90', () => {
    expect(TripStopSchema.safeParse({ ...validStop, latitude: 91 }).success).toBe(false)
  })

  it('rejects longitude < -180', () => {
    expect(TripStopSchema.safeParse({ ...validStop, longitude: -181 }).success).toBe(false)
  })
})

describe('AccommodationSchema', () => {
  const validAccom = {
    name: 'Masada Hotel',
    type: 'מלון',
    address: 'Dead Sea Road',
    estimatedCostPerNight: 500,
  }

  it('parses valid accommodation', () => {
    expect(AccommodationSchema.safeParse(validAccom).success).toBe(true)
  })

  it('defaults notes to empty string', () => {
    const result = AccommodationSchema.parse(validAccom)
    expect(result.notes).toBe('')
  })

  it('rejects negative cost', () => {
    expect(AccommodationSchema.safeParse({ ...validAccom, estimatedCostPerNight: -1 }).success).toBe(false)
  })

  it('rejects cost over 100000', () => {
    expect(AccommodationSchema.safeParse({ ...validAccom, estimatedCostPerNight: 100001 }).success).toBe(false)
  })
})

describe('TripPlanSchema', () => {
  const validPlan = {
    days: [
      {
        day: 1,
        stops: [{ name: 'Ein Gedi', latitude: 31.46, longitude: 35.39 }],
      },
    ],
  }

  it('parses a valid trip plan', () => {
    expect(TripPlanSchema.safeParse(validPlan).success).toBe(true)
  })

  it('parses plan with accommodation on non-last day', () => {
    const plan = {
      days: [
        {
          day: 1,
          stops: [{ name: 'Stop A', latitude: 31, longitude: 35 }],
          accommodation: { name: 'Hotel', type: 'מלון', address: 'Addr', estimatedCostPerNight: 300 },
        },
        {
          day: 2,
          stops: [{ name: 'Stop B', latitude: 31.1, longitude: 35.1 }],
        },
      ],
    }
    expect(TripPlanSchema.safeParse(plan).success).toBe(true)
  })

  it('rejects day number below 1', () => {
    const plan = { days: [{ day: 0, stops: [{ name: 'X', latitude: 0, longitude: 0 }] }] }
    expect(TripPlanSchema.safeParse(plan).success).toBe(false)
  })
})
