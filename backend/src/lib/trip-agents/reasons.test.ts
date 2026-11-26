import { describe, it, expect } from 'vitest'
import { planReason, stopReasons } from './reasons'
import type { PlannedStop } from './planner-agent'
import type { PoiCandidate } from './types'

function stop(over: Partial<Omit<PlannedStop, 'place'>> & { place?: Partial<PoiCandidate> } = {}): PlannedStop {
  const { place, ...rest } = over
  return {
    place: {
      id: 1, name: 'p', category: 'אתר היסטורי', regionName: null, lat: 32, lng: 35, durationMinutes: 60,
      difficulty: 'קל', hasWater: false, hasShade: false, accessible: false, rating: null, description: '',
      mainImage: null, sources: ['postgis'], ...place,
    },
    slot: 'afternoon', visitMinutes: 60, arrivalTime: '12:00', departureTime: '13:00',
    driveMinutesFromPrev: 20, distanceFromPrevKm: 15, waitMinutes: 0, conditions: [], ...rest,
  }
}

const plan = (stops: PlannedStop[], orderStrategy: 'time_of_day' | 'shortest_drive' = 'time_of_day') =>
  ({ stops, sunset: '16:40', orderStrategy })

describe('stopReasons', () => {
  it('explains a morning hike and a sunset viewpoint', () => {
    const r = stopReasons(plan([
      stop({ slot: 'morning', arrivalTime: '08:00', place: { category: 'נחל', difficulty: 'מאתגר' } }),
      stop({ slot: 'sunset', arrivalTime: '15:40', departureTime: '16:40', waitMinutes: 30, driveMinutesFromPrev: 10, place: { category: 'מצפה' } }),
    ]))
    expect(r[0]).toContain('בבוקר')
    expect(r[1]).toContain('השקיעה (16:40)')
    expect(r[1]).toContain("רק 10 דק' נסיעה")
  })

  it('talks about the real time: a "midday" spring at 09:00 is not called a midday stop', () => {
    const [r] = stopReasons(plan([stop({ slot: 'midday', arrivalTime: '09:00', place: { category: 'מעיין', hasWater: true } })]))
    expect(r).not.toContain('צהריים')
    expect(r).toContain('מים')
  })

  it('says the order saves driving when the planner chose the shortest order', () => {
    const [r] = stopReasons(plan([stop({ slot: 'morning', arrivalTime: '13:00', place: { category: 'נחל' } })], 'shortest_drive'))
    expect(r).toContain('חוסך')
    expect(r).not.toContain('בבוקר')
  })

  it('mentions the drive from the start point for the first stop', () => {
    const [r] = stopReasons(plan([stop({ driveMinutesFromPrev: 25 })]), true)
    expect(r).toContain("25 דק' נסיעה מנקודת ההתחלה")
  })
})

describe('planReason', () => {
  it('is factual about order, driving and sunset', () => {
    const r = planReason({ ...plan([stop()]), totalDriveMinutes: 55 })
    expect(r).toContain("55 דק'")
    expect(r).toContain('16:40')
  })
})

describe('stopReasons — viewpoints', () => {
  it('gives a second viewpoint (not the sunset one) a real reason', () => {
    const [r] = stopReasons(plan([stop({ slot: 'afternoon', arrivalTime: '13:00', place: { category: 'מצפה' } })]))
    expect(r).toContain('לנוף')
  })
})
