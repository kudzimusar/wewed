import { describe, expect, test } from 'bun:test'
import {
  calculateCommercialReadiness,
  calculatePackageCompletion,
  PRICE_COMPONENT_TYPES,
} from './provider-commercial'

describe('provider commercial readiness', () => {
  const now = new Date('2026-08-07T10:00:00.000Z')

  test('requires published, calculable, current and confirmed pricing for AI-ready selection', () => {
    const readiness = calculateCommercialReadiness({
      status: 'published',
      serviceAreas: ['Harare'],
      pricingVisibility: 'exact',
      pricingModel: 'Per guest',
      startingPrice: '25',
      priceValidUntil: '2026-12-31T23:59:59.000Z',
      commercialTerms: {
        taxIncluded: true,
        depositType: 'percentage',
        balanceDueRule: 'Balance due 14 days before the wedding',
      },
      priceComponents: [
        { label: 'Adult guest', type: 'per_adult', amount: '25', unit: 'guest' },
      ],
      commercialConfirmed: true,
    }, now)

    expect(readiness.status).toBe('ready')
    expect(readiness.score).toBe(100)
    expect(readiness.missing).toEqual([])
  })

  test('does not treat contact-for-pricing as exact-budget ready', () => {
    const readiness = calculateCommercialReadiness({
      status: 'published',
      serviceAreas: ['Harare'],
      pricingVisibility: 'quote_only',
      pricingModel: 'Custom proposal',
      priceValidUntil: '2026-12-31T23:59:59.000Z',
      commercialTerms: {
        taxIncluded: false,
        depositType: 'fixed',
        balanceDueRule: 'On booking',
      },
      commercialConfirmed: true,
    }, now)

    expect(readiness.status).toBe('not_ready')
    expect(readiness.missing).toContain('Choose exact, from, or range pricing for AI planning')
    expect(readiness.missing).toContain('Add a calculable offering or package price')
  })

  test('marks expired catalogue pricing as not ready', () => {
    const readiness = calculateCommercialReadiness({
      status: 'published',
      serviceAreas: ['Harare'],
      pricingVisibility: 'from',
      pricingModel: 'Fixed package',
      packages: [{ name: 'Classic', price: '1500' }],
      priceValidUntil: '2026-08-01T00:00:00.000Z',
      commercialTerms: {
        taxIncluded: true,
        depositType: 'percentage',
        balanceDueRule: '14 days before the wedding',
      },
      commercialConfirmed: true,
    }, now)

    expect(readiness.status).toBe('not_ready')
    expect(readiness.missing).toContain('Confirm a current price-valid-until date')
  })

  test('accepts a priced package as a calculable source', () => {
    const readiness = calculateCommercialReadiness({
      status: 'published',
      serviceAreas: ['Harare'],
      pricingVisibility: 'range',
      pricingModel: 'Fixed package',
      packages: [{ name: 'Gold', priceCents: 150000 }],
      priceValidUntil: '2027-01-01T00:00:00.000Z',
      commercialTerms: {
        taxIncluded: true,
        depositType: 'percentage',
        balanceDueRule: '30 days before the wedding',
      },
      commercialConfirmed: true,
    }, now)

    expect(readiness.status).toBe('ready')
    expect(readiness.missing).toEqual([])
  })

  test('refuses ambiguous variable pricing until it is bound to the wedding quantity that drives it', () => {
    const unbound = calculateCommercialReadiness({
      status: 'published',
      serviceAreas: ['Harare'],
      pricingVisibility: 'exact',
      pricingModel: 'Per item',
      startingPrice: '5',
      priceValidUntil: '2027-01-01T00:00:00.000Z',
      commercialTerms: {
        taxIncluded: true,
        depositType: 'percentage',
        balanceDueRule: '14 days before the wedding',
      },
      priceComponents: [
        { label: 'Printed invitation', type: 'per_item', amount: '5', unit: 'invitation' },
      ],
      commercialConfirmed: true,
    }, now)

    expect(unbound.status).toBe('not_ready')
    expect(unbound.missing).toContain('Bind every variable price component to the wedding quantity that drives it')

    const bound = calculateCommercialReadiness({
      status: 'published',
      serviceAreas: ['Harare'],
      pricingVisibility: 'exact',
      pricingModel: 'Per item',
      startingPrice: '5',
      priceValidUntil: '2027-01-01T00:00:00.000Z',
      commercialTerms: {
        taxIncluded: true,
        depositType: 'percentage',
        balanceDueRule: '14 days before the wedding',
      },
      priceComponents: [
        { label: 'Printed invitation', type: 'per_item', amount: '5', unit: 'invitation', quantityKey: 'invitations' },
      ],
      commercialConfirmed: true,
    }, now)

    expect(bound.status).toBe('ready')
    expect(bound.missing).not.toContain('Bind every variable price component to the wedding quantity that drives it')
  })

  test('keeps semantically unapproved variable bindings out of automatic AI planning', () => {
    const readiness = calculateCommercialReadiness({
      status: 'published',
      serviceAreas: ['Harare'],
      pricingVisibility: 'exact',
      pricingModel: 'Per item',
      startingPrice: '5',
      priceValidUntil: '2027-01-01T00:00:00.000Z',
      commercialTerms: {
        taxIncluded: true,
        depositType: 'percentage',
        balanceDueRule: '14 days before the wedding',
      },
      priceComponents: [
        { label: 'Printed invitation', type: 'per_item', amount: '5', unit: 'invitation', quantityKey: 'invitations' },
      ],
      automaticQuantityBindingsApproved: false,
      commercialConfirmed: true,
    }, now)

    expect(readiness.status).toBe('not_ready')
    expect(readiness.missing).toContain('Review variable quantity bindings before automatic AI planning')
  })

  test('keeps package completeness distinct from AI readiness', () => {
    expect(calculatePackageCompletion({
      name: 'Gold',
      price: '1500',
      currency: 'USD',
      pricingUnit: 'package',
      inclusions: ['8 hours'],
      priceValidUntil: '2026-12-31',
      commercialTerms: { taxIncluded: true, depositType: 'percentage' },
    })).toBe(100)
  })

  test('supports deterministic wedding commerce component types', () => {
    expect(PRICE_COMPONENT_TYPES).toContain('per_guest')
    expect(PRICE_COMPONENT_TYPES).toContain('per_child')
    expect(PRICE_COMPONENT_TYPES).toContain('per_kilometre')
    expect(PRICE_COMPONENT_TYPES).toContain('percentage_of_budget')
    expect(PRICE_COMPONENT_TYPES).toContain('percentage_surcharge')
    expect(PRICE_COMPONENT_TYPES).toContain('tax')
    expect(PRICE_COMPONENT_TYPES).toContain('discount')
  })
})
