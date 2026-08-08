import type { PriceComponentType } from '@/lib/provider-commercial'
import { isApprovedAutomaticPriceBinding, priceComponentsUseApprovedAutomaticBindings } from '@/lib/wedding-architect-binding-policy'
import { resolveBoundQuantity, type PriceQuantityContext } from '@/lib/provider-price-bindings'
import { calculateWeddingPrice, decimalAmountToCents, type CalculableCommercialTerms, type CalculablePriceComponent, type WeddingPriceCalculation } from '@/lib/wedding-architect-pricing'

export type WeddingArchitectCatalogueVariant = {
  providerId: string
  businessAccountId: string
  offeringId: string
  packageId?: string | null
  category: string
  currency: string
  pricingVisibility: string
  startingPriceCents?: number | null
  offeringCommercialTerms?: unknown
  offeringPriceComponents?: unknown
  offeringPriceValidUntil?: Date | string | null
  packageName?: string | null
  packagePriceCents?: number | null
  packageCommercialTerms?: unknown
  packagePriceComponents?: unknown
  packagePriceValidUntil?: Date | string | null
  packageIncludedQuantity?: number | null
  packageAdditionalUnitPriceCents?: number | null
  packageMinimumQuantity?: number | null
  packageMaximumQuantity?: number | null
  packageQuantityType?: PriceComponentType | null
  packageQuantityKey?: string | null
  packageMultiplierKey?: string | null
}

export type WeddingArchitectCandidatePriceResult =
  | { ok: true; calculation: WeddingPriceCalculation }
  | { ok: false; reasons: string[] }

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function components(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
    : []
}

function integer(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

function componentType(value: unknown): PriceComponentType | null {
  const type = String(value ?? '') as PriceComponentType
  return [
    'fixed','per_guest','per_adult','per_child','per_item','per_serving','per_table','per_room',
    'per_vehicle','per_hour','per_day','per_night','per_session','per_kilometre','per_trip',
    'percentage_of_budget','percentage_surcharge','fixed_surcharge','discount','refundable_security',
    'tax','service_charge',
  ].includes(type) ? type : null
}

function mergeTerms(base: unknown, override: unknown): CalculableCommercialTerms {
  return { ...object(base), ...object(override) } as CalculableCommercialTerms
}

function buildComponents(input: {
  category: string
  source: unknown
  quantityContext: PriceQuantityContext
  reasons: string[]
}): CalculablePriceComponent[] {
  if (!priceComponentsUseApprovedAutomaticBindings(input.category, input.source)) {
    input.reasons.push('Price components contain an unapproved wedding quantity binding.')
    return []
  }

  const output: CalculablePriceComponent[] = []
  for (const [index, row] of components(input.source).entries()) {
    const type = componentType(row.type)
    if (!type || row.amount === null || row.amount === undefined || row.amount === '') continue
    try {
      const quantity = resolveBoundQuantity({
        type,
        quantityKey: typeof row.quantityKey === 'string' ? row.quantityKey : null,
        multiplierKey: typeof row.multiplierKey === 'string' ? row.multiplierKey : null,
        context: input.quantityContext,
      })
      const minimum = integer(row.minimumQuantity)
      const maximum = integer(row.maximumQuantity)
      if (minimum !== null && quantity < minimum) {
        input.reasons.push(`${String(row.label ?? `Price component ${index + 1}`)} requires a minimum quantity of ${minimum}.`)
        continue
      }
      if (maximum !== null && quantity > maximum) {
        input.reasons.push(`${String(row.label ?? `Price component ${index + 1}`)} supports a maximum quantity of ${maximum}.`)
        continue
      }
      output.push({
        id: String(row.id ?? `component-${index + 1}`),
        label: String(row.label ?? `Price component ${index + 1}`),
        type,
        amount: row.amount as string | number,
        applies: true,
        quantityOverride: quantity,
        note: typeof row.condition === 'string' && row.condition.trim() ? row.condition.trim() : null,
      })
    } catch (error) {
      input.reasons.push(error instanceof Error ? error.message : 'A price component could not be calculated.')
    }
  }
  return output
}

function packageOverageComponent(input: {
  variant: WeddingArchitectCatalogueVariant
  quantityContext: PriceQuantityContext
  reasons: string[]
}): CalculablePriceComponent | null {
  const additionalCents = integer(input.variant.packageAdditionalUnitPriceCents)
  if (!additionalCents || additionalCents <= 0) return null
  const type = input.variant.packageQuantityType
  const quantityKey = input.variant.packageQuantityKey
  if (!type || !quantityKey) {
    input.reasons.push('Variable package pricing is missing its explicit wedding quantity type or binding.')
    return null
  }
  if (!isApprovedAutomaticPriceBinding({
    category: input.variant.category,
    type,
    quantityKey,
    multiplierKey: input.variant.packageMultiplierKey,
  })) {
    input.reasons.push('Variable package pricing uses an unapproved wedding quantity binding.')
    return null
  }
  try {
    const requestedQuantity = resolveBoundQuantity({
      type,
      quantityKey,
      multiplierKey: input.variant.packageMultiplierKey,
      context: input.quantityContext,
    })
    const minimum = input.variant.packageMinimumQuantity ?? null
    const maximum = input.variant.packageMaximumQuantity ?? null
    if (minimum !== null && requestedQuantity < minimum) input.reasons.push(`Package requires a minimum quantity of ${minimum}.`)
    if (maximum !== null && requestedQuantity > maximum) input.reasons.push(`Package supports a maximum quantity of ${maximum}.`)
    const included = input.variant.packageIncludedQuantity ?? 0
    const overage = Math.max(0, requestedQuantity - included)
    if (!overage) return null
    return {
      id: 'package_overage',
      label: 'Package additional quantity',
      type: 'fixed',
      amount: (additionalCents * overage / 100).toFixed(2),
      applies: true,
      quantityOverride: 1,
      note: `${included} included; ${overage} additional`,
    }
  } catch (error) {
    input.reasons.push(error instanceof Error ? error.message : 'Package quantity could not be calculated.')
    return null
  }
}

export function priceWeddingArchitectCandidate(input: {
  variant: WeddingArchitectCatalogueVariant
  weddingBudgetCents: number
  quantityContext: PriceQuantityContext
  calculatedAt?: Date
}): WeddingArchitectCandidatePriceResult {
  const { variant } = input
  const reasons: string[] = []
  const hasPackage = Boolean(variant.packageId)
  const basePriceCents = hasPackage ? variant.packagePriceCents : variant.startingPriceCents
  const commercialTerms = mergeTerms(variant.offeringCommercialTerms, variant.packageCommercialTerms)

  // "From" and range prices are useful in ordinary marketplace browsing, but an
  // exact-budget Wedding Architect plan must never present their lower bound as
  // the final client price. A fixed package price is exact by definition.
  if (!hasPackage && variant.pricingVisibility !== 'exact') {
    reasons.push('Offering pricing is not exact enough for an automatic budget plan.')
  }
  if (basePriceCents === null || basePriceCents === undefined || !Number.isSafeInteger(basePriceCents) || basePriceCents < 0) {
    reasons.push('Candidate has no exact non-negative base price.')
  }

  try {
    const travelRateCents = decimalAmountToCents(commercialTerms.travelFeePerKm, 'Travel fee per kilometre')
    if (travelRateCents > 0 && (input.quantityContext.travelKm === null || input.quantityContext.travelKm === undefined)) {
      reasons.push('Provider travel distance is unknown, so kilometre-based travel charges cannot be calculated exactly.')
    }
  } catch (error) {
    reasons.push(error instanceof Error ? error.message : 'Travel pricing could not be validated.')
  }

  const offeringComponents = buildComponents({
    category: variant.category,
    source: variant.offeringPriceComponents,
    quantityContext: input.quantityContext,
    reasons,
  })
  const packageComponents = buildComponents({
    category: variant.category,
    source: variant.packagePriceComponents,
    quantityContext: input.quantityContext,
    reasons,
  })
  const overage = hasPackage ? packageOverageComponent({ variant, quantityContext: input.quantityContext, reasons }) : null
  if (reasons.length) return { ok: false, reasons: Array.from(new Set(reasons)) }

  try {
    return {
      ok: true,
      calculation: calculateWeddingPrice({
        currency: variant.currency,
        basePriceCents: basePriceCents ?? 0,
        weddingBudgetCents: input.weddingBudgetCents,
        quantities: {
          kilometres: input.quantityContext.travelKm ?? 0,
        },
        components: [...offeringComponents, ...packageComponents, ...(overage ? [overage] : [])],
        commercialTerms,
        source: {
          providerId: variant.providerId,
          offeringId: variant.offeringId,
          packageId: variant.packageId ?? null,
          catalogueVersion: `${variant.offeringId}:${variant.packageId ?? 'offering'}`,
          priceValidUntil: String(variant.packagePriceValidUntil ?? variant.offeringPriceValidUntil ?? '') || null,
        },
        calculatedAt: input.calculatedAt,
      }),
    }
  } catch (error) {
    return { ok: false, reasons: [error instanceof Error ? error.message : 'Candidate price could not be calculated.'] }
  }
}
