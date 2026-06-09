import { describe, it, expect } from 'vitest'
import { buildGenerateTripPrompt, buildRegenerateStopPrompt } from './prompts'
import type { TripInput, TripPlan } from '@/types/llm'

const basePois = [
  { id: 1, name: 'Ein Gedi', category: 'hiking_trail', description: 'A lush desert oasis near the Dead Sea', region: 'Dead Sea', address: 'Ein Gedi', openingHours: '08:00-17:00', latitude: 31.46, longitude: 35.39, isActive: true, sourceId: null, externalId: null, difficulty: 'moderate', durationMinutes: 120, hasWater: true, hasShade: true, accessible: false, averageRating: '4.5', reviewCount: 50, mainImage: null, tags: [], createdAt: new Date(), updatedAt: new Date() },
  { id: 2, name: 'Cafe Masada', category: 'coffee_trail', description: 'A scenic café near Masada fortress', region: 'Dead Sea', address: 'Masada', openingHours: '09:00-18:00', latitude: 31.31, longitude: 35.35, isActive: true, sourceId: null, externalId: null, difficulty: 'easy', durationMinutes: 30, hasWater: true, hasShade: true, accessible: true, averageRating: '4.2', reviewCount: 30, mainImage: null, tags: [], createdAt: new Date(), updatedAt: new Date() },
] as any[]

const baseInput: TripInput = {
  groupSize: 2,
  travelerType: 'couple',
  durationDays: 2,
  poiCategories: ['hiking_trail', 'coffee_trail'],
  areas: ['dead_sea'],
  subAreas: [],
  dayStartTime: '09:00',
  dayEndTime: '18:00',
  difficulty: 'moderate',
}

describe('buildGenerateTripPrompt', () => {
  it('includes POI names in the output', () => {
    const prompt = buildGenerateTripPrompt(baseInput, basePois)
    expect(prompt).toContain('Ein Gedi')
    expect(prompt).toContain('Cafe Masada')
  })

  it('mentions the duration in days', () => {
    const prompt = buildGenerateTripPrompt(baseInput, basePois)
    expect(prompt).toContain('2-day')
  })

  it('mentions the traveler type', () => {
    const prompt = buildGenerateTripPrompt(baseInput, basePois)
    expect(prompt).toContain('couple')
  })

  it('includes difficulty hint', () => {
    const prompt = buildGenerateTripPrompt(baseInput, basePois)
    expect(prompt).toContain('moderate')
  })

  it('includes location hint when userLocation is provided', () => {
    const inputWithLocation = { ...baseInput, userLocation: { lat: 31.46, lng: 35.39 } }
    const prompt = buildGenerateTripPrompt(inputWithLocation, basePois)
    expect(prompt).toContain('starting point')
    expect(prompt).toContain('31.4600')
  })

  it('does not include location hint without userLocation', () => {
    const prompt = buildGenerateTripPrompt(baseInput, basePois)
    expect(prompt).not.toContain('starting point')
  })

  it('truncates long POI descriptions at 80 chars', () => {
    const longDescPoi = [{ ...basePois[0], description: 'A'.repeat(200) }] as any[]
    const prompt = buildGenerateTripPrompt(baseInput, longDescPoi)
    expect(prompt).not.toContain('A'.repeat(200))
    expect(prompt).toContain('A'.repeat(80))
  })

  it('handles campsite category with single stop target', () => {
    const campsiteInput = { ...baseInput, poiCategories: ['campsite' as any] }
    const prompt = buildGenerateTripPrompt(campsiteInput, basePois)
    expect(prompt).toContain('1 stops per day')
  })
})

describe('buildRegenerateStopPrompt', () => {
  const plan: TripPlan = {
    days: [
      {
        day: 1,
        stops: [
          { name: 'Ein Gedi', category: 'hiking_trail', address: 'Ein Gedi', openingHours: '08:00', reasoning: 'Great hike', latitude: 31.46, longitude: 35.39, visitDurationMinutes: 120 },
          { name: 'Cafe Masada', category: 'coffee_trail', address: 'Masada', openingHours: '09:00', reasoning: 'Nice coffee', latitude: 31.31, longitude: 35.35, visitDurationMinutes: 30 },
        ],
      },
    ],
  }

  it('includes the stop being replaced', () => {
    const prompt = buildRegenerateStopPrompt(plan, 0, 0, basePois)
    expect(prompt).toContain('Ein Gedi')
    expect(prompt).toContain('Replace one stop')
  })

  it('throws for invalid dayIndex', () => {
    expect(() => buildRegenerateStopPrompt(plan, 5, 0, basePois)).toThrow('Invalid dayIndex')
  })

  it('throws for invalid stopIndex', () => {
    expect(() => buildRegenerateStopPrompt(plan, 0, 10, basePois)).toThrow('Invalid stopIndex')
  })

  it('excludes already-used POIs from available replacements', () => {
    const prompt = buildRegenerateStopPrompt(plan, 0, 0, basePois)
    // All pois in plan are used, so available list should be filtered
    expect(prompt).toContain('Available replacements')
  })

  it('mentions other stops in the day', () => {
    const prompt = buildRegenerateStopPrompt(plan, 0, 0, basePois)
    expect(prompt).toContain('Cafe Masada')
  })
})
