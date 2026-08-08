import { describe, expect, test } from 'bun:test'
import { PROVIDER_CATEGORIES } from './provider-catalog'
import { PRICE_COMPONENT_TYPES } from './provider-commercial'
import { providerPricingPrompts } from './provider-pricing-catalog'

describe('provider Wedding Architect pricing prompts', () => {
  test('prompts every provider category for calculation-relevant commercial data', () => {
    for (const category of PROVIDER_CATEGORIES) {
      const prompts = providerPricingPrompts(category.value)
      expect(prompts.length).toBeGreaterThanOrEqual(3)
      expect(prompts.some((entry) => entry.priority === 'core')).toBe(true)
      expect(new Set(prompts.map((entry) => entry.key)).size).toBe(prompts.length)
      for (const entry of prompts) {
        expect(PRICE_COMPONENT_TYPES).toContain(entry.type)
        expect(entry.label.length).toBeGreaterThan(2)
        expect(entry.help.length).toBeGreaterThan(10)
      }
    }
  })

  test('captures client-by-client drivers for major wedding categories', () => {
    expect(providerPricingPrompts('catering').map((entry) => entry.type)).toContain('per_adult')
    expect(providerPricingPrompts('catering').map((entry) => entry.type)).toContain('per_child')
    expect(providerPricingPrompts('planning').map((entry) => entry.type)).toContain('percentage_of_budget')
    expect(providerPricingPrompts('venue').map((entry) => entry.type)).toContain('per_guest')
    expect(providerPricingPrompts('transport').map((entry) => entry.type)).toContain('per_vehicle')
    expect(providerPricingPrompts('cakes').map((entry) => entry.type)).toContain('per_serving')
  })

  test('falls back to a safe generic pricing checklist for unknown categories', () => {
    expect(providerPricingPrompts('future-category')).toEqual(providerPricingPrompts('other'))
  })
})
