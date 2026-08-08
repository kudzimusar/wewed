import { describe, expect, test } from 'bun:test'
import { priceWeddingArchitectCandidate } from '@/lib/wedding-architect-candidate-pricing'

const quantityContext = {
  guestCount: 120,
  adultCount: 100,
  childCount: 20,
  travelKm: 40,
  categoryRequirements: { servings: 120, rooms: 10, nights: 2, coverageHours: 8 },
}

describe('Wedding Architect candidate pricing', () => {
  test('calculates exact offering pricing from bound wedding quantities', () => {
    const result = priceWeddingArchitectCandidate({
      weddingBudgetCents: 2_000_000,
      quantityContext,
      calculatedAt: new Date('2026-08-08T00:00:00.000Z'),
      variant: {
        providerId: 'provider-1', businessAccountId: 'business-1', offeringId: 'cake-1', category: 'cakes', currency: 'USD',
        pricingVisibility: 'exact', startingPriceCents: 10_000,
        offeringPriceValidUntil: '2026-12-31T23:59:59.999Z',
        offeringCommercialTerms: { taxIncluded: true, depositType: 'percentage', depositValue: '30' },
        offeringPriceComponents: [{ id: 'servings', label: 'Cake servings', type: 'per_serving', amount: '2.00', quantityKey: 'servings' }],
      },
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.calculation.totalCostCents).toBe(34_000)
      expect(result.calculation.depositCents).toBe(10_200)
    }
  })

  test('rejects from/range lower bounds as final exact client prices', () => {
    const result = priceWeddingArchitectCandidate({
      weddingBudgetCents: 2_000_000,
      quantityContext,
      variant: {
        providerId: 'provider-1', businessAccountId: 'business-1', offeringId: 'photo-1', category: 'photography', currency: 'USD',
        pricingVisibility: 'from', startingPriceCents: 100_000,
      },
    })
    expect(result.ok).toBe(false)
  })

  test('supports approved package compound overage without parsing pricing labels', () => {
    const result = priceWeddingArchitectCandidate({
      weddingBudgetCents: 2_000_000,
      quantityContext,
      variant: {
        providerId: 'provider-2', businessAccountId: 'business-2', offeringId: 'stay-1', packageId: 'package-1', category: 'accommodation-travel', currency: 'USD',
        pricingVisibility: 'range', startingPriceCents: 0,
        packageName: 'Guest rooms', packagePriceCents: 100_000,
        packageIncludedQuantity: 10,
        packageAdditionalUnitPriceCents: 5_000,
        packageQuantityType: 'per_room', packageQuantityKey: 'rooms', packageMultiplierKey: 'nights',
        packageCommercialTerms: { taxIncluded: true, depositType: 'none' },
      },
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.calculation.totalCostCents).toBe(150_000)
  })
})
