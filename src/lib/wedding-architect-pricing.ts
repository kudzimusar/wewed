import type { PriceComponentType } from '@/lib/provider-commercial'

export type WeddingPriceQuantities = {
  guests?: number
  adults?: number
  children?: number
  items?: number
  servings?: number
  tables?: number
  rooms?: number
  vehicles?: number
  hours?: number
  days?: number
  nights?: number
  sessions?: number
  kilometres?: number
  trips?: number
}

export type CalculablePriceComponent = {
  id: string
  label: string
  type: PriceComponentType
  amount: string | number
  applies: boolean
  quantityOverride?: number | null
  note?: string | null
}

export type CalculableCommercialTerms = {
  minimumSpend?: string | number | null
  setupFee?: string | number | null
  deliveryFee?: string | number | null
  includedTravelKm?: number | null
  travelFeePerKm?: string | number | null
  taxIncluded?: boolean | null
  taxPercentage?: string | number | null
  serviceChargeType?: 'none' | 'fixed' | 'percentage' | null
  serviceChargeValue?: string | number | null
  depositType?: 'none' | 'fixed' | 'percentage' | null
  depositValue?: string | number | null
  balanceDueRule?: string | null
}

export type WeddingPriceCalculationInput = {
  currency: string
  basePriceCents?: number | null
  weddingBudgetCents?: number | null
  quantities: WeddingPriceQuantities
  components: CalculablePriceComponent[]
  commercialTerms?: CalculableCommercialTerms
  source: {
    providerId: string
    offeringId: string
    packageId?: string | null
    catalogueVersion: string
    priceValidUntil?: string | null
  }
  calculatedAt?: Date
}

export type WeddingPriceLine = {
  code: string
  label: string
  type: string
  quantity: number
  unitAmountCents: number
  amountCents: number
  refundable: boolean
  note: string | null
}

export type WeddingPriceCalculation = {
  currency: string
  subtotalBeforeCommercialTermsCents: number
  minimumSpendAdjustmentCents: number
  serviceChargeCents: number
  taxCents: number
  refundableSecurityCents: number
  totalCostCents: number
  totalCashRequiredCents: number
  depositCents: number
  balanceCents: number
  balanceDueRule: string | null
  lines: WeddingPriceLine[]
  source: WeddingPriceCalculationInput['source']
  calculatedAt: string
}

const MAX_SAFE_CENTS = 9_000_000_000_000

function assertNonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`)
  }
  return value
}

export function decimalAmountToCents(value: string | number | null | undefined, label = 'Amount'): number {
  if (value === null || value === undefined || value === '') return 0
  const normalized = typeof value === 'number' ? String(value) : value.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`${label} must be a non-negative amount with at most two decimal places.`)
  }
  const [whole, fraction = ''] = normalized.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > MAX_SAFE_CENTS) {
    throw new Error(`${label} is outside the supported monetary range.`)
  }
  return cents
}

function percentageBasisPoints(value: string | number | null | undefined, label: string): number {
  if (value === null || value === undefined || value === '') return 0
  const normalized = typeof value === 'number' ? String(value) : value.trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`${label} must be a percentage with at most two decimal places.`)
  }
  const [whole, fraction = ''] = normalized.split('.')
  const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 1_000_000) {
    throw new Error(`${label} is outside the supported percentage range.`)
  }
  return basisPoints
}

function multiplyRate(unitAmountCents: number, quantity: number, label: string): number {
  assertNonNegativeInteger(unitAmountCents, `${label} unit amount`)
  assertNonNegativeInteger(quantity, `${label} quantity`)
  const value = unitAmountCents * quantity
  if (!Number.isSafeInteger(value) || value > MAX_SAFE_CENTS) {
    throw new Error(`${label} exceeds the supported monetary range.`)
  }
  return value
}

function percentageOf(baseCents: number, basisPoints: number, label: string): number {
  assertNonNegativeInteger(baseCents, `${label} base`)
  assertNonNegativeInteger(basisPoints, `${label} basis points`)
  const value = Math.round((baseCents * basisPoints) / 10_000)
  if (!Number.isSafeInteger(value) || value > MAX_SAFE_CENTS) {
    throw new Error(`${label} exceeds the supported monetary range.`)
  }
  return value
}

function standardQuantity(type: PriceComponentType, quantities: WeddingPriceQuantities): number {
  const quantity = (() => {
    switch (type) {
      case 'per_guest': return quantities.guests
      case 'per_adult': return quantities.adults
      case 'per_child': return quantities.children
      case 'per_item': return quantities.items
      case 'per_serving': return quantities.servings
      case 'per_table': return quantities.tables
      case 'per_room': return quantities.rooms
      case 'per_vehicle': return quantities.vehicles
      case 'per_hour': return quantities.hours
      case 'per_day': return quantities.days
      case 'per_night': return quantities.nights
      case 'per_session': return quantities.sessions
      case 'per_kilometre': return quantities.kilometres
      case 'per_trip': return quantities.trips
      default: return 1
    }
  })()
  return quantity === undefined ? 0 : assertNonNegativeInteger(quantity, `${type} quantity`)
}

function componentLine(
  component: CalculablePriceComponent,
  input: WeddingPriceCalculationInput,
  runningSubtotalCents: number,
): WeddingPriceLine | null {
  if (!component.applies) return null
  const quantity = component.quantityOverride === null || component.quantityOverride === undefined
    ? standardQuantity(component.type, input.quantities)
    : assertNonNegativeInteger(component.quantityOverride, `${component.label} quantity`)

  if (component.type === 'percentage_of_budget') {
    if (input.weddingBudgetCents === null || input.weddingBudgetCents === undefined) {
      throw new Error(`${component.label} requires the wedding budget.`)
    }
    const rate = percentageBasisPoints(component.amount, component.label)
    return {
      code: component.id,
      label: component.label,
      type: component.type,
      quantity: 1,
      unitAmountCents: rate,
      amountCents: percentageOf(input.weddingBudgetCents, rate, component.label),
      refundable: false,
      note: component.note ?? null,
    }
  }

  if (component.type === 'percentage_surcharge' || component.type === 'tax' || component.type === 'service_charge') {
    const rate = percentageBasisPoints(component.amount, component.label)
    return {
      code: component.id,
      label: component.label,
      type: component.type,
      quantity: 1,
      unitAmountCents: rate,
      amountCents: percentageOf(runningSubtotalCents, rate, component.label),
      refundable: false,
      note: component.note ?? null,
    }
  }

  const unitAmountCents = decimalAmountToCents(component.amount, component.label)
  const refundable = component.type === 'refundable_security'
  const amountCents = component.type === 'discount'
    ? -multiplyRate(unitAmountCents, quantity, component.label)
    : multiplyRate(unitAmountCents, quantity, component.label)

  return {
    code: component.id,
    label: component.label,
    type: component.type,
    quantity,
    unitAmountCents,
    amountCents,
    refundable,
    note: component.note ?? null,
  }
}

function addFixedLine(lines: WeddingPriceLine[], code: string, label: string, amountCents: number) {
  if (amountCents <= 0) return
  lines.push({
    code,
    label,
    type: 'fixed',
    quantity: 1,
    unitAmountCents: amountCents,
    amountCents,
    refundable: false,
    note: null,
  })
}

export function calculateWeddingPrice(input: WeddingPriceCalculationInput): WeddingPriceCalculation {
  const basePriceCents = assertNonNegativeInteger(input.basePriceCents ?? 0, 'Base price')
  const terms = input.commercialTerms ?? {}
  const lines: WeddingPriceLine[] = []
  addFixedLine(lines, 'base_price', 'Base price', basePriceCents)

  let runningSubtotalCents = basePriceCents
  let refundableSecurityCents = 0
  for (const component of input.components) {
    const line = componentLine(component, input, runningSubtotalCents)
    if (!line) continue
    if (line.refundable) {
      refundableSecurityCents += Math.max(0, line.amountCents)
    } else {
      runningSubtotalCents += line.amountCents
      if (runningSubtotalCents < 0) runningSubtotalCents = 0
    }
    lines.push(line)
  }

  const setupFeeCents = decimalAmountToCents(terms.setupFee, 'Setup fee')
  const deliveryFeeCents = decimalAmountToCents(terms.deliveryFee, 'Delivery fee')
  addFixedLine(lines, 'setup_fee', 'Setup fee', setupFeeCents)
  addFixedLine(lines, 'delivery_fee', 'Delivery fee', deliveryFeeCents)
  runningSubtotalCents += setupFeeCents + deliveryFeeCents

  const includedTravelKm = assertNonNegativeInteger(terms.includedTravelKm ?? 0, 'Included travel')
  const requestedTravelKm = assertNonNegativeInteger(input.quantities.kilometres ?? 0, 'Travel distance')
  const billableTravelKm = Math.max(0, requestedTravelKm - includedTravelKm)
  const travelRateCents = decimalAmountToCents(terms.travelFeePerKm, 'Travel fee per kilometre')
  if (billableTravelKm > 0 && travelRateCents > 0) {
    const amountCents = multiplyRate(travelRateCents, billableTravelKm, 'Travel')
    lines.push({
      code: 'travel_fee',
      label: 'Travel beyond included distance',
      type: 'per_kilometre',
      quantity: billableTravelKm,
      unitAmountCents: travelRateCents,
      amountCents,
      refundable: false,
      note: `${includedTravelKm} km included`,
    })
    runningSubtotalCents += amountCents
  }

  const subtotalBeforeCommercialTermsCents = runningSubtotalCents
  const minimumSpendCents = decimalAmountToCents(terms.minimumSpend, 'Minimum spend')
  const minimumSpendAdjustmentCents = Math.max(0, minimumSpendCents - runningSubtotalCents)
  if (minimumSpendAdjustmentCents > 0) {
    addFixedLine(lines, 'minimum_spend_adjustment', 'Minimum spend adjustment', minimumSpendAdjustmentCents)
    runningSubtotalCents += minimumSpendAdjustmentCents
  }

  let serviceChargeCents = 0
  if (terms.serviceChargeType === 'fixed') {
    serviceChargeCents = decimalAmountToCents(terms.serviceChargeValue, 'Service charge')
  } else if (terms.serviceChargeType === 'percentage') {
    serviceChargeCents = percentageOf(
      runningSubtotalCents,
      percentageBasisPoints(terms.serviceChargeValue, 'Service charge'),
      'Service charge',
    )
  }
  addFixedLine(lines, 'service_charge', 'Service charge', serviceChargeCents)
  runningSubtotalCents += serviceChargeCents

  let taxCents = 0
  if (terms.taxIncluded === false) {
    taxCents = percentageOf(
      runningSubtotalCents,
      percentageBasisPoints(terms.taxPercentage, 'Tax percentage'),
      'Tax',
    )
  }
  addFixedLine(lines, 'tax', 'Tax', taxCents)
  runningSubtotalCents += taxCents

  const totalCostCents = assertNonNegativeInteger(runningSubtotalCents, 'Total cost')
  const totalCashRequiredCents = assertNonNegativeInteger(totalCostCents + refundableSecurityCents, 'Total cash required')

  let depositCents = 0
  if (terms.depositType === 'fixed') {
    depositCents = decimalAmountToCents(terms.depositValue, 'Deposit')
  } else if (terms.depositType === 'percentage') {
    depositCents = percentageOf(
      totalCostCents,
      percentageBasisPoints(terms.depositValue, 'Deposit'),
      'Deposit',
    )
  }
  depositCents = Math.min(depositCents, totalCostCents)

  return {
    currency: input.currency,
    subtotalBeforeCommercialTermsCents,
    minimumSpendAdjustmentCents,
    serviceChargeCents,
    taxCents,
    refundableSecurityCents,
    totalCostCents,
    totalCashRequiredCents,
    depositCents,
    balanceCents: totalCostCents - depositCents,
    balanceDueRule: terms.balanceDueRule ?? null,
    lines,
    source: input.source,
    calculatedAt: (input.calculatedAt ?? new Date()).toISOString(),
  }
}
