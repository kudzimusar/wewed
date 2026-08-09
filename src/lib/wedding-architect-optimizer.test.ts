import { describe, expect, test } from 'bun:test'
import { optimizeWeddingArchitectPlan, type WeddingArchitectPricedCandidate } from '@/lib/wedding-architect-optimizer'

function candidate(category: string, id: string, cost: number, fitScore: number): WeddingArchitectPricedCandidate {
  return {
    candidateId: id,
    providerId: `provider-${id}`,
    businessAccountId: `business-${id}`,
    offeringId: `offering-${id}`,
    packageId: null,
    category,
    providerName: `Provider ${id}`,
    providerSlug: `provider-${id}`,
    offeringName: `${category} ${id}`,
    packageName: null,
    fitScore,
    warnings: [],
    why: [],
    pricing: {
      currency: 'USD',
      subtotalBeforeCommercialTermsCents: cost,
      minimumSpendAdjustmentCents: 0,
      serviceChargeCents: 0,
      taxCents: 0,
      refundableSecurityCents: 0,
      totalCostCents: cost,
      totalCashRequiredCents: cost,
      depositCents: 0,
      balanceCents: cost,
      balanceDueRule: null,
      lines: [],
      source: { providerId: `provider-${id}`, offeringId: `offering-${id}`, catalogueVersion: '1' },
      calculatedAt: '2026-08-08T00:00:00.000Z',
    },
  }
}

describe('Wedding Architect optimizer', () => {
  test('reserves contingency and chooses a complete combination within spendable budget', () => {
    const plan = optimizeWeddingArchitectPlan({
      totalBudgetCents: 1_000_000,
      contingencyBasisPoints: 1000,
      strategy: 'balanced',
      pools: [
        { category: 'venue', priority: 'required', candidates: [candidate('venue', 'venue-a', 500_000, 95), candidate('venue', 'venue-b', 400_000, 80)] },
        { category: 'catering', priority: 'required', candidates: [candidate('catering', 'food-a', 500_000, 95), candidate('catering', 'food-b', 450_000, 85)] },
      ],
    })
    expect(plan.contingencyCents).toBe(100_000)
    expect(plan.spendableBudgetCents).toBe(900_000)
    expect(plan.coverageComplete).toBe(true)
    expect(plan.selectedCostCents).toBeLessThanOrEqual(900_000)
    expect(plan.selections).toHaveLength(2)
  })

  test('never fabricates a required category when no eligible candidate exists', () => {
    const plan = optimizeWeddingArchitectPlan({
      totalBudgetCents: 500_000,
      strategy: 'value',
      pools: [
        { category: 'venue', priority: 'required', candidates: [] },
        { category: 'photography', priority: 'preferred', candidates: [candidate('photography', 'photo', 100_000, 90)] },
      ],
    })
    expect(plan.coverageComplete).toBe(false)
    expect(plan.uncoveredRequiredCategories).toContain('venue')
    expect(plan.selections.some((entry) => entry.category === 'venue')).toBe(false)
  })

  test('keeps every selected provider inside the hard wedding budget', () => {
    const plan = optimizeWeddingArchitectPlan({
      totalBudgetCents: 300_000,
      strategy: 'priority_led',
      pools: [
        { category: 'venue', priority: 'required', candidates: [candidate('venue', 'too-expensive', 400_000, 100)] },
      ],
    })
    expect(plan.selectedCostCents).toBe(0)
    expect(plan.uncoveredRequiredCategories).toEqual(['venue'])
  })
})
