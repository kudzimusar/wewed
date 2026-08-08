import { describe, expect, test } from 'bun:test'
import { scoreWeddingArchitectFit } from '@/lib/wedding-architect-fit'

describe('Wedding Architect fit scoring', () => {
  test('scores structured venue capacity and requirements without AI inference', () => {
    const result = scoreWeddingArchitectFit({
      category: 'venue',
      requirements: { seatedGuests: 120, accommodationRequired: true, accessibilityRequired: true },
      providerDetails: {
        seatedCapacity: 180,
        spaces: ['Accommodation', 'Reception hall'],
        venueAmenities: ['Parking', 'Accessible entrance'],
      },
    })
    expect(result.score).toBe(100)
    expect(result.mismatched).toEqual([])
  })

  test('detects client/provider incompatibilities explicitly', () => {
    const result = scoreWeddingArchitectFit({
      category: 'catering',
      requirements: {
        adultGuests: 100,
        childGuests: 20,
        serviceStyle: 'Plated',
        dietarySupport: ['Vegetarian', 'Halal'],
      },
      providerDetails: {
        minimumGuests: 50,
        maximumGuests: 100,
        serviceStyles: ['Buffet'],
        dietarySupport: ['Vegetarian'],
      },
    })
    expect(result.score).toBeLessThan(100)
    expect(result.mismatched.length).toBeGreaterThan(0)
  })
})
