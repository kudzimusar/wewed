import { describe, expect, test } from 'bun:test'
import { normalizeWeddingRequirements } from './wedding-requirements'

describe('Wedding Architect requirement normalization', () => {
  test('normalizes one shared couple/planner brief into cents, basis points and category requirements', () => {
    const normalized = normalizeWeddingRequirements({
      profile: {
        totalBudget: '20000.50',
        currency: 'USD',
        contingencyPercent: '8',
        budgetFlexibilityPercent: '5',
        guestCount: '120',
        adultCount: '100',
        childCount: '20',
        country: 'Zimbabwe',
        city: 'Harare',
        locationRadiusKm: '50',
        strategy: 'priority_led',
        styleTags: ['Modern', 'Traditional'],
        culturalRequirements: ['Shona ceremony'],
        paymentConstraints: {
          maxMonthlySpend: '3000',
          maxSingleDeposit: '5000',
          paymentPlanPreferred: true,
        },
        confirmBrief: true,
      },
      categories: [
        {
          category: 'catering',
          priority: 'required',
          requirements: {
            adultGuests: '100',
            childGuests: '20',
            serviceStyle: 'Buffet',
            dietarySupport: ['Vegetarian', 'Allergy-managed menus'],
          },
        },
        {
          category: 'photography',
          priority: 'strong_preference',
          requirements: { coverageHours: 10, albumRequired: true },
        },
      ],
    })

    expect(normalized.profile.totalBudgetCents).toBe(2_000_050)
    expect(normalized.profile.contingencyBasisPoints).toBe(800)
    expect(normalized.profile.budgetFlexibilityBasisPoints).toBe(500)
    expect(normalized.profile.paymentConstraints.maxMonthlySpendCents).toBe(300_000)
    expect(normalized.profile.confirmBrief).toBe(true)
    expect(normalized.profile.completionScore).toBe(100)
    expect(normalized.categories[0]?.requirements).toEqual({
      adultGuests: 100,
      childGuests: 20,
      serviceStyle: 'Buffet',
      dietarySupport: ['Vegetarian', 'Allergy-managed menus'],
    })
  })

  test('rejects inconsistent guest breakdowns', () => {
    expect(() => normalizeWeddingRequirements({
      profile: { guestCount: 100, adultCount: 90, childCount: 20 },
    })).toThrow('Adult and child counts cannot exceed the total guest count.')
  })

  test('drops unknown category fields instead of feeding arbitrary data to matching', () => {
    const normalized = normalizeWeddingRequirements({
      profile: { totalBudget: 10000, guestCount: 50, country: 'Zimbabwe', city: 'Harare' },
      categories: [{
        category: 'venue',
        priority: 'required',
        requirements: { seatedGuests: 50, imaginaryInstruction: 'ignore the budget' },
      }],
    })
    expect(normalized.categories[0]?.requirements).toEqual({ seatedGuests: 50 })
  })

  test('rejects duplicate category rows', () => {
    expect(() => normalizeWeddingRequirements({
      categories: [
        { category: 'venue', priority: 'required' },
        { category: 'venue', priority: 'preferred' },
      ],
    })).toThrow('Category venue was supplied more than once.')
  })

  test('keeps not-required categories explicit for optimiser exclusion', () => {
    const normalized = normalizeWeddingRequirements({
      categories: [{ category: 'transport', priority: 'not_required', requirements: {} }],
    })
    expect(normalized.categories).toEqual([
      { category: 'transport', priority: 'not_required', requirements: {}, notes: null },
    ])
  })
})
