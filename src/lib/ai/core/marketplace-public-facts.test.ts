import { describe, expect, test } from 'bun:test'
import { marketplaceAiPricingFacts } from './marketplace-public-facts'

describe('Marketplace Concierge public pricing projection', () => {
  test('quote-only pricing never exposes retained monetary values', () => {
    expect(marketplaceAiPricingFacts({
      pricingVisibility: 'quote_only',
      startingPriceCents: 12500,
      maximumPriceCents: 25000,
    })).toEqual({
      pricingVisibility: 'quote_only',
      startingPriceCents: null,
      maximumPriceCents: null,
    })
  })

  test('unknown visibility fails closed as quote-only', () => {
    expect(marketplaceAiPricingFacts({
      pricingVisibility: 'future_mode',
      startingPriceCents: 12500,
      maximumPriceCents: 25000,
    })).toEqual({
      pricingVisibility: 'quote_only',
      startingPriceCents: null,
      maximumPriceCents: null,
    })
  })

  test('exact and from expose only the published starting amount', () => {
    for (const pricingVisibility of ['exact', 'from'] as const) {
      expect(marketplaceAiPricingFacts({
        pricingVisibility,
        startingPriceCents: 12500,
        maximumPriceCents: 25000,
      })).toEqual({
        pricingVisibility,
        startingPriceCents: 12500,
        maximumPriceCents: null,
      })
    }
  })

  test('range exposes both valid non-negative integer bounds', () => {
    expect(marketplaceAiPricingFacts({
      pricingVisibility: 'range',
      startingPriceCents: 12500,
      maximumPriceCents: 25000,
    })).toEqual({
      pricingVisibility: 'range',
      startingPriceCents: 12500,
      maximumPriceCents: 25000,
    })
  })

  test('malformed monetary values are omitted instead of coerced', () => {
    expect(marketplaceAiPricingFacts({
      pricingVisibility: 'range',
      startingPriceCents: -1,
      maximumPriceCents: '25000',
    })).toEqual({
      pricingVisibility: 'range',
      startingPriceCents: null,
      maximumPriceCents: null,
    })
  })
})
