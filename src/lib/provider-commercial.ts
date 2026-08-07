export const PRICING_VISIBILITY_OPTIONS = ['exact', 'from', 'range', 'quote_only'] as const
export const AVAILABILITY_MODE_OPTIONS = ['calendar', 'request', 'always_available'] as const
export const CHARGE_TYPE_OPTIONS = ['none', 'fixed', 'percentage'] as const
export const DEPOSIT_TYPE_OPTIONS = ['none', 'fixed', 'percentage'] as const
export const PRICE_COMPONENT_TYPES = [
  'fixed',
  'per_guest',
  'per_adult',
  'per_child',
  'per_item',
  'per_serving',
  'per_table',
  'per_room',
  'per_vehicle',
  'per_hour',
  'per_day',
  'per_night',
  'per_session',
  'per_kilometre',
  'per_trip',
  'percentage_of_budget',
  'percentage_surcharge',
  'fixed_surcharge',
  'discount',
  'refundable_security',
  'tax',
  'service_charge',
] as const

export type PricingVisibility = (typeof PRICING_VISIBILITY_OPTIONS)[number]
export type AiPlanningReadinessStatus = 'not_ready' | 'needs_review' | 'ready'
export type PriceComponentType = (typeof PRICE_COMPONENT_TYPES)[number]

export type PriceComponentInput = {
  label?: unknown
  type?: unknown
  amount?: unknown
  unit?: unknown
  condition?: unknown
  minimumQuantity?: unknown
  maximumQuantity?: unknown
  quantityKey?: unknown
  multiplierKey?: unknown
}

export type CommercialTermsInput = {
  minimumSpend?: unknown
  includedQuantity?: unknown
  incrementalUnitPrice?: unknown
  minimumBillableQuantity?: unknown
  billingIncrement?: unknown
  setupFee?: unknown
  deliveryFee?: unknown
  includedTravelKm?: unknown
  travelFeePerKm?: unknown
  overtimeRate?: unknown
  overtimeUnit?: unknown
  taxIncluded?: unknown
  taxPercentage?: unknown
  serviceChargeType?: unknown
  serviceChargeValue?: unknown
  depositType?: unknown
  depositValue?: unknown
  balanceDueRule?: unknown
  availabilityMode?: unknown
}

export type CommercialReadinessInput = {
  status?: unknown
  serviceAreas?: unknown
  pricingVisibility?: unknown
  pricingModel?: unknown
  startingPrice?: unknown
  startingPriceCents?: unknown
  maximumPrice?: unknown
  maximumPriceCents?: unknown
  packages?: unknown
  priceValidUntil?: unknown
  commercialTerms?: unknown
  priceComponents?: unknown
  commercialConfirmed?: boolean
  ownerConfirmedCommercialAt?: unknown
  automaticQuantityBindingsApproved?: boolean
}

export type CommercialReadiness = {
  score: number
  status: AiPlanningReadinessStatus
  missing: string[]
}

const EXPLICIT_QUANTITY_BINDING_TYPES = new Set<PriceComponentType>([
  'per_item',
  'per_serving',
  'per_table',
  'per_room',
  'per_vehicle',
  'per_hour',
  'per_day',
  'per_night',
  'per_session',
  'per_trip',
])

function present(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.length > 0
  return typeof value === 'object'
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function packageHasPrice(value: unknown): boolean {
  return array(value).some((entry) => {
    const row = object(entry)
    return present(row.price) || present(row.priceCents)
  })
}

function explicitQuantityBindingsComplete(value: unknown): boolean {
  return array(value).every((entry) => {
    const row = object(entry)
    if (!present(row.amount)) return true
    const type = String(row.type ?? '') as PriceComponentType
    return !EXPLICIT_QUANTITY_BINDING_TYPES.has(type) || present(row.quantityKey)
  })
}

function validFutureDate(value: unknown, now: Date): boolean {
  if (!present(value)) return false
  const date = new Date(String(value))
  return Number.isFinite(date.getTime()) && date.getTime() >= now.getTime()
}

export function calculateCommercialReadiness(
  input: CommercialReadinessInput,
  now = new Date(),
): CommercialReadiness {
  const terms = object(input.commercialTerms)
  const priceVisibility = String(input.pricingVisibility ?? '')
  const hasCalculablePrice =
    present(input.startingPrice) ||
    present(input.startingPriceCents) ||
    present(input.maximumPrice) ||
    present(input.maximumPriceCents) ||
    packageHasPrice(input.packages)
  const confirmed = Boolean(input.commercialConfirmed || present(input.ownerConfirmedCommercialAt))
  const taxDefined = typeof terms.taxIncluded === 'boolean'
  const depositDefined = present(terms.depositType)
  const balanceDefined = present(terms.balanceDueRule)
  const componentsDefined = array(input.priceComponents).length > 0 || packageHasPrice(input.packages)
  const quantityBindingsComplete = explicitQuantityBindingsComplete(input.priceComponents)
  const automaticQuantityBindingsApproved = input.automaticQuantityBindingsApproved !== false

  const checks: Array<[boolean, string, boolean]> = [
    [input.status === 'published', 'Publish this offering', true],
    [array(input.serviceAreas).length > 0, 'Add at least one service area', false],
    [
      priceVisibility === 'exact' || priceVisibility === 'from' || priceVisibility === 'range',
      'Choose exact, from, or range pricing for AI planning',
      true,
    ],
    [present(input.pricingModel), 'Choose a pricing model', false],
    [hasCalculablePrice, 'Add a calculable offering or package price', true],
    [validFutureDate(input.priceValidUntil, now), 'Confirm a current price-valid-until date', true],
    [taxDefined, 'Confirm whether tax is included', false],
    [depositDefined, 'Add deposit terms', false],
    [balanceDefined, 'Add a balance-due rule', false],
    [componentsDefined, 'Add at least one structured price component or priced package', false],
    [
      quantityBindingsComplete,
      'Bind every variable price component to the wedding quantity that drives it',
      true,
    ],
    [
      automaticQuantityBindingsApproved,
      'Review variable quantity bindings before automatic AI planning',
      true,
    ],
    [confirmed, 'Confirm that commercial pricing is current', true],
  ]

  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label)
  const passed = checks.length - missing.length
  const score = Math.round((passed / checks.length) * 100)
  const criticalMissing = checks.some(([ok, , critical]) => critical && !ok)
  const status: AiPlanningReadinessStatus = criticalMissing
    ? 'not_ready'
    : score >= 80
      ? 'ready'
      : 'needs_review'

  return { score, status, missing }
}

export function calculatePackageCompletion(input: Record<string, unknown>): number {
  const terms = object(input.commercialTerms)
  const checks = [
    present(input.name),
    present(input.price) || present(input.priceCents),
    present(input.currency),
    present(input.pricingUnit),
    array(input.inclusions).length > 0,
    present(input.priceValidUntil),
    typeof terms.taxIncluded === 'boolean',
    present(terms.depositType),
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}
