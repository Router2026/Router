import { describe, it, expect, vi } from 'vitest'
import { assessPlace, isDesert, parseDay, runConditionsAgent, MAX_FORECAST_DAYS_AHEAD, type DayWeather } from './conditions-agent'
import type { TripIntent } from './intent-agent'
import type { PoiCandidate } from './types'

const TODAY = '2026-11-25'

function poi(id: number, over: Partial<PoiCandidate> = {}): PoiCandidate {
  return {
    id, name: `p${id}`, category: 'נחל', regionName: null, lat: 33.0, lng: 35.5, durationMinutes: 60,
    difficulty: 'קל', hasWater: true, hasShade: false, accessible: false, rating: 4.5, description: '',
    mainImage: null, sources: ['postgis'], ...over,
  }
}

function day(over: Partial<DayWeather> = {}): DayWeather {
  return { tempMaxC: 24, precipMm: 0, precipProb: 0, gustsKmh: 20, prevPrecipMm: 0, sunrise: '06:15', sunset: '16:40', ...over }
}

const DESERT = { lat: 30.6, lng: 34.8 } // Mitzpe Ramon
const INTENT = { date: TODAY } as TripIntent

describe('isDesert', () => {
  it('classifies Negev / Dead Sea as desert and the Galilee / Jerusalem as not', () => {
    expect(isDesert(30.6, 34.8)).toBe(true)
    expect(isDesert(31.46, 35.39)).toBe(true) // Ein Gedi
    expect(isDesert(33.0, 35.5)).toBe(false)
    expect(isDesert(31.77, 35.21)).toBe(false) // Jerusalem
  })
})

describe('assessPlace', () => {
  it('rejects a desert streambed on light rain, the day before counts too', () => {
    expect(assessPlace(poi(1, DESERT), day({ precipMm: 2 }))[0]).toMatchObject({ code: 'flash_flood_risk', severity: 'reject' })
    expect(assessPlace(poi(1, DESERT), day({ prevPrecipMm: 3 }))[0].code).toBe('flash_flood_risk')
    expect(assessPlace(poi(1, DESERT), day({ precipProb: 55 }))[0].code).toBe('flash_flood_risk')
  })

  it('does not apply the flood rule to a desert viewpoint', () => {
    const notes = assessPlace(poi(1, { ...DESERT, category: 'מצפה' }), day({ precipMm: 3 }))
    expect(notes.every((n) => n.severity !== 'reject')).toBe(true)
  })

  it('rejects northern streams only on heavy rain, warns on moderate rain', () => {
    expect(assessPlace(poi(1), day({ precipMm: 3 }))).toEqual([])
    expect(assessPlace(poi(1), day({ precipMm: 6 }))[0]).toMatchObject({ code: 'rain', severity: 'warning' })
    expect(assessPlace(poi(1), day({ precipMm: 20 }))[0]).toMatchObject({ code: 'heavy_rain_streams', severity: 'reject' })
  })

  it('applies heat rules by difficulty and shade', () => {
    expect(assessPlace(poi(1, { difficulty: 'מאתגר' }), day({ tempMaxC: 36 }))[0].code).toBe('extreme_heat_hard_hike')
    expect(assessPlace(poi(1), day({ tempMaxC: 36 }))[0]).toMatchObject({ code: 'heat', severity: 'warning' })
    expect(assessPlace(poi(1), day({ tempMaxC: 39 }))[0].code).toBe('extreme_heat_exposed')
    expect(assessPlace(poi(1, { hasShade: true }), day({ tempMaxC: 39 }))[0].code).toBe('heat')
    expect(assessPlace(poi(1, { category: 'אתר היסטורי' }), day({ tempMaxC: 39 }))).toEqual([])
  })

  it('warns on strong wind and when there is no forecast', () => {
    expect(assessPlace(poi(1, { category: 'מצפה' }), day({ gustsKmh: 75 }))[0].code).toBe('strong_wind')
    expect(assessPlace(poi(1), null)[0]).toMatchObject({ code: 'no_forecast', severity: 'warning' })
  })
})

describe('parseDay', () => {
  it('reads the requested day, the previous day\'s rain and HH:MM sun times', () => {
    const point = { daily: {
      time: ['2026-11-24', '2026-11-25'], temperature_2m_max: [20, 22.5], precipitation_sum: [4, 0],
      precipitation_probability_max: [80, 5], wind_gusts_10m_max: [30, 25],
      sunrise: ['2026-11-24T06:14', '2026-11-25T06:15'], sunset: ['2026-11-24T16:41', '2026-11-25T16:40'],
    } }
    expect(parseDay(point, '2026-11-25')).toEqual({ tempMaxC: 22.5, precipMm: 0, precipProb: 5, gustsKmh: 25, prevPrecipMm: 4, sunrise: '06:15', sunset: '16:40' })
    expect(parseDay(point, '2026-12-01')).toBeNull()
  })
})

describe('runConditionsAgent', () => {
  it('fetches one point per ~11km cell, rejects unsafe places and keeps approved spares', async () => {
    const shortlist = [poi(1, DESERT), poi(2, { ...DESERT, lat: 30.61, category: 'מצפה' }), poi(3)]
    const pool = [...shortlist, poi(4, { lat: 33.01 }), poi(5, DESERT)]
    const fetchWeather = vi.fn(async (points: { lat: number }[]) =>
      points.map((p) => (p.lat < 31 ? day({ precipMm: 5 }) : day())))
    const r = await runConditionsAgent({ ...INTENT }, shortlist, pool, { fetchWeather, today: TODAY })

    expect(fetchWeather.mock.calls[0][0]).toHaveLength(2) // desert cell + north cell
    expect(r.forecastAvailable).toBe(true)
    expect(r.approved.map((a) => a.place.id)).toEqual([2, 3])
    expect(r.approvedSpares.map((a) => a.place.id)).toEqual([4])
    expect(r.rejected.map((a) => a.place.id).sort()).toEqual([1, 5])
    expect(r.sunset).toBe('16:40')
  })

  it('fails open with a no_forecast warning when the weather API fails', async () => {
    const fetchWeather = vi.fn(async () => { throw new Error('down') })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await runConditionsAgent(INTENT, [poi(1, DESERT)], [], { fetchWeather, today: TODAY })
    expect(r.forecastAvailable).toBe(false)
    expect(r.approved[0].notes[0].code).toBe('no_forecast')
  })

  it('skips the API for dates beyond the forecast range', async () => {
    const fetchWeather = vi.fn()
    const far = new Date(Date.parse(`${TODAY}T00:00:00Z`) + (MAX_FORECAST_DAYS_AHEAD + 1) * 86_400_000).toISOString().slice(0, 10)
    const r = await runConditionsAgent({ date: far } as TripIntent, [poi(1)], [], { fetchWeather, today: TODAY })
    expect(fetchWeather).not.toHaveBeenCalled()
    expect(r.forecastAvailable).toBe(false)
  })
})
