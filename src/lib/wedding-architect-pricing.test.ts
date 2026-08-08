import { describe, expect, test } from 'bun:test'
import { calculateWeddingPrice, decimalAmountToCents } from './wedding-architect-pricing'

const source = {
  providerId: 'provider-1',
  offeringId: 'offering-1',
  packageId: null,
  catalogueVersion: '2026-08-07T12:00:00.000Z',
  priceValidUntil: '2026-12-31T23:59:59.999Z',
}

describe('Wedding Architect deterministic pricing', () => {
  test('calculates catering from adult/child quantities, fees, service charge and deposit', () => {
    const result = calculateWeddingPrice({
      currency: 'USD',
      basePriceCents: 0,
      weddingBudgetCents: 2_000_000,
      quantities: { adults: 100, children: 20 },
      components: [
        { id: 'adult', label: 'Adult meal', type: 'per_adult', amount: '30', applies: true },
        { id: 'child', label: 'Child meal', type: 'per_child', amount: '15', applies: true },
      ],
      commercialTerms: {
        setupFee: '50',
        taxIncluded: true,
        serviceChargeType: 'percentage',
        serviceChargeValue: '10',
        depositType: 'percentage',
        depositValue: '30',
        balanceDueRule: '14 days before the wedding',
      },
      source,
      calculatedAt: new Date('2026-08-07T12:30:00.000Z'),
    })

    expect(result.subtotalBeforeCommercialTermsCents).toBe(335_000)
    expect(result.serviceChargeCents).toBe(33_500)
    expect(result.totalCostCents).toBe(368_500)
    expect(result.depositCents).toBe(110_550)
    expect(result.balanceCents).toBe(257_950)
    expect(result.calculatedAt).toBe('2026-08-07T12:30:00.000Z')
  })

  test('calculates percentage-of-budget planner fees without LLM arithmetic', () => {
    const result = calculateWeddingPrice({
      currency: 'USD',
      weddingBudgetCents: 2_000_000,
      quantities: {},
      components: [
        { id: 'planner-fee', label: 'Planning fee', type: 'percentage_of_budget', amount: '10', applies: true },
      ],
      commercialTerms: { taxIncluded: true, depositType: 'none' },
      source,
    })

    expect(result.totalCostCents).toBe(200_000)
    expect(result.lines.find((line) => line.code === 'planner-fee')?.amountCents).toBe(200_000)
  })

  test('applies minimum spend, travel outside the included radius and excluded tax', () => {
    const result = calculateWeddingPrice({
      currency: 'USD',
      basePriceCents: 80_000,
      quantities: { kilometres: 80 },
      components: [],
      commercialTerms: {
        minimumSpend: '1000',
        includedTravelKm: 50,
        travelFeePerKm: '1.50',
        taxIncluded: false,
        taxPercentage: '15',
        depositType: 'fixed',
        depositValue: '250',
      },
      source,
    })

    expect(result.lines.find((line) => line.code === 'travel_fee')).toMatchObject({
      quantity: 30,
      unitAmountCents: 150,
      amountCents: 4_500,
    })
    expect(result.minimumSpendAdjustmentCents).toBe(15_500)
    expect(result.taxCents).toBe(15_000)
    expect(result.totalCostCents).toBe(115_000)
    expect(result.depositCents).toBe(25_000)
  })

  test('keeps refundable security outside service cost while exposing cash required', () => {
    const result = calculateWeddingPrice({
      currency: 'USD',
      basePriceCents: 100_000,
      quantities: {},
      components: [
        { id: 'damage-deposit', label: 'Damage deposit', type: 'refundable_security', amount: '200', applies: true },
      ],
      commercialTerms: { taxIncluded: true },
      source,
    })

    expect(result.refundableSecurityCents).toBe(20_000)
    expect(result.totalCostCents).toBe(100_000)
    expect(result.totalCashRequiredCents).toBe(120_000)
  })

  test('does not charge conditional components that runtime eligibility marked inapplicable', () => {
    const result = calculateWeddingPrice({
      currency: 'USD',
      basePriceCents: 50_000,
      quantities: { hours: 2 },
      components: [
        { id: 'overtime', label: 'Overtime', type: 'per_hour', amount: '100', applies: false },
      ],
      commercialTerms: { taxIncluded: true },
      source,
    })
    expect(result.totalCostCents).toBe(50_000)
    expect(result.lines.some((line) => line.code === 'overtime')).toBe(false)
  })

  test('treats discounts as cost reductions without allowing a negative total', () => {
    const result = calculateWeddingPrice({
      currency: 'USD',
      basePriceCents: 10_000,
      quantities: {},
      components: [
        { id: 'discount', label: 'Discount', type: 'discount', amount: '150', applies: true },
      ],
      commercialTerms: { taxIncluded: true },
      source,
    })
    expect(result.totalCostCents).toBe(0)
  })

  test('rejects invalid money rather than rounding ambiguous input', () => {
    expect(() => decimalAmountToCents('12.345')).toThrow('at most two decimal places')
    expect(() => decimalAmountToCents('-5')).toThrow('non-negative')
  })

  test('requires a wedding budget for percentage-of-budget pricing', () => {
    expect(() => calculateWeddingPrice({
      currency: 'USD',
      quantities: {},
      components: [
        { id: 'planner', label: 'Planner fee', type: 'percentage_of_budget', amount: '10', applies: true },
      ],
      source,
    })).toThrow('requires the wedding budget')
  })
})
