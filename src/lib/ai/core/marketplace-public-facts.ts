export type MarketplacePricingVisibility = 'exact' | 'from' | 'range' | 'quote_only'

function cents(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

export function marketplaceAiPricingFacts(input: {
  pricingVisibility?: unknown
  startingPriceCents?: unknown
  maximumPriceCents?: unknown
}) {
  const visibility = input.pricingVisibility === 'exact' ||
    input.pricingVisibility === 'from' ||
    input.pricingVisibility === 'range'
    ? input.pricingVisibility
    : 'quote_only'

  if (visibility === 'quote_only') {
    return {
      pricingVisibility: visibility as MarketplacePricingVisibility,
      startingPriceCents: null,
      maximumPriceCents: null,
    }
  }

  const startingPriceCents = cents(input.startingPriceCents)
  const maximumPriceCents = visibility === 'range' ? cents(input.maximumPriceCents) : null

  return {
    pricingVisibility: visibility as MarketplacePricingVisibility,
    startingPriceCents,
    maximumPriceCents,
  }
}
