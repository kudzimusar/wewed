import type { PriceComponentType } from '@/lib/provider-commercial'
import { weddingRequirementFields } from '@/lib/wedding-requirement-catalog'

export const GLOBAL_PRICE_BINDINGS = [
  { key: '__guest_count', label: 'Total wedding guests' },
  { key: '__adult_count', label: 'Adult guests' },
  { key: '__child_count', label: 'Child guests' },
  { key: '__travel_km', label: 'Calculated service travel distance (km)' },
] as const

export type PriceQuantityContext = {
  guestCount?: number | null
  adultCount?: number | null
  childCount?: number | null
  travelKm?: number | null
  categoryRequirements: Record<string, unknown>
}

export type PriceBindingOption = {
  key: string
  label: string
}

const DEFAULT_BINDING_BY_TYPE: Partial<Record<PriceComponentType, string>> = {
  per_guest: '__guest_count',
  per_adult: '__adult_count',
  per_child: '__child_count',
  per_kilometre: '__travel_km',
}

const QUANTITY_TYPES = new Set<PriceComponentType>([
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
])

export function defaultPriceBinding(type: PriceComponentType): string | null {
  return DEFAULT_BINDING_BY_TYPE[type] ?? null
}

export function priceComponentNeedsQuantity(type: PriceComponentType): boolean {
  return QUANTITY_TYPES.has(type)
}

export function priceComponentNeedsExplicitBinding(type: PriceComponentType): boolean {
  return priceComponentNeedsQuantity(type) && !defaultPriceBinding(type)
}

export function providerPriceBindingOptions(category: string): PriceBindingOption[] {
  const categoryOptions = weddingRequirementFields(category)
    .filter((field) => field.type === 'number')
    .map((field) => ({ key: field.key, label: field.label }))
  return [...GLOBAL_PRICE_BINDINGS, ...categoryOptions]
}

function integerValue(value: unknown, label: string): number {
  if (value === null || value === undefined || value === '') return 0
  const numeric = typeof value === 'number' ? value : Number(String(value))
  if (!Number.isSafeInteger(numeric) || numeric < 0) {
    throw new Error(`${label} must resolve to a non-negative whole-number quantity.`)
  }
  return numeric
}

function bindingValue(key: string, context: PriceQuantityContext): number {
  switch (key) {
    case '__guest_count': return integerValue(context.guestCount, 'Guest count')
    case '__adult_count': return integerValue(context.adultCount, 'Adult count')
    case '__child_count': return integerValue(context.childCount, 'Child count')
    case '__travel_km': return integerValue(context.travelKm, 'Travel distance')
    default: return integerValue(context.categoryRequirements[key], key)
  }
}

export function resolveBoundQuantity(input: {
  type: PriceComponentType
  quantityKey?: string | null
  multiplierKey?: string | null
  context: PriceQuantityContext
}): number {
  if (!priceComponentNeedsQuantity(input.type)) return 1
  const quantityKey = input.quantityKey || defaultPriceBinding(input.type)
  if (!quantityKey) {
    throw new Error(`${input.type} pricing requires an explicit wedding requirement quantity binding.`)
  }
  const quantity = bindingValue(quantityKey, input.context)
  if (!input.multiplierKey) return quantity
  const multiplier = bindingValue(input.multiplierKey, input.context)
  const result = quantity * multiplier
  if (!Number.isSafeInteger(result)) throw new Error('Bound pricing quantity exceeds the supported range.')
  return result
}
