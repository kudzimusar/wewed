import { describe, expect, test } from 'bun:test'
import { PROVIDER_CATEGORIES } from './provider-catalog'
import {
  WEDDING_REQUIREMENT_PRIORITIES,
  WEDDING_PLAN_STRATEGIES,
  assertWeddingRequirementCatalogCoverage,
  weddingRequirementFields,
} from './wedding-requirement-catalog'

describe('Wedding Architect requirement catalogue', () => {
  test('covers every marketplace provider category', () => {
    expect(assertWeddingRequirementCatalogCoverage()).toEqual([])
    for (const category of PROVIDER_CATEGORIES) {
      expect(weddingRequirementFields(category.value).length).toBeGreaterThanOrEqual(3)
      const keys = weddingRequirementFields(category.value).map((entry) => entry.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  test('uses the approved requirement priorities and plan strategies', () => {
    expect(WEDDING_REQUIREMENT_PRIORITIES).toEqual([
      'required',
      'strong_preference',
      'preferred',
      'flexible',
      'not_required',
    ])
    expect(WEDDING_PLAN_STRATEGIES).toEqual(['value', 'balanced', 'priority_led'])
  })

  test('captures the principal client-by-client cost drivers', () => {
    expect(weddingRequirementFields('catering').map((entry) => entry.key)).toContain('adultGuests')
    expect(weddingRequirementFields('catering').map((entry) => entry.key)).toContain('childGuests')
    expect(weddingRequirementFields('venue').map((entry) => entry.key)).toContain('seatedGuests')
    expect(weddingRequirementFields('photography').map((entry) => entry.key)).toContain('coverageHours')
    expect(weddingRequirementFields('transport').map((entry) => entry.key)).toContain('passengers')
    expect(weddingRequirementFields('cakes').map((entry) => entry.key)).toContain('servings')
  })
})
