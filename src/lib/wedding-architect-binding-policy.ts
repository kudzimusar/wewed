import type { PriceComponentType } from '@/lib/provider-commercial'
import { defaultPriceBinding, priceComponentNeedsQuantity } from '@/lib/provider-price-bindings'

export type ApprovedPriceBinding = {
  category: string
  type: PriceComponentType
  quantityKey: string
  multiplierKey?: string | null
}

const APPROVED_BINDINGS: readonly ApprovedPriceBinding[] = [
  { category: 'photography', type: 'per_hour', quantityKey: 'coverageHours' },
  { category: 'videography', type: 'per_hour', quantityKey: 'coverageHours' },
  { category: 'florals', type: 'per_item', quantityKey: 'bridalBouquets' },
  { category: 'florals', type: 'per_item', quantityKey: 'buttonholes' },
  { category: 'florals', type: 'per_table', quantityKey: 'guestTables' },
  { category: 'cakes', type: 'per_serving', quantityKey: 'servings' },
  { category: 'entertainment', type: 'per_hour', quantityKey: 'performanceHours' },
  { category: 'decor-rentals', type: 'per_item', quantityKey: 'chairs' },
  { category: 'decor-rentals', type: 'per_item', quantityKey: 'tables' },
  { category: 'decor-rentals', type: 'per_item', quantityKey: 'linenSets' },
  { category: 'decor-rentals', type: 'per_table', quantityKey: 'tables' },
  { category: 'beauty', type: 'per_item', quantityKey: 'partyCount' },
  { category: 'attire', type: 'per_item', quantityKey: 'garments' },
  { category: 'transport', type: 'per_trip', quantityKey: 'trips' },
  { category: 'transport', type: 'per_hour', quantityKey: 'hireHours' },
  { category: 'stationery', type: 'per_item', quantityKey: 'invitations' },
  { category: 'stationery', type: 'per_item', quantityKey: 'menus' },
  { category: 'stationery', type: 'per_item', quantityKey: 'placeCards' },
  { category: 'jewellery', type: 'per_item', quantityKey: 'itemsRequired' },
  { category: 'accommodation-travel', type: 'per_room', quantityKey: 'rooms', multiplierKey: 'nights' },
  { category: 'lighting-av', type: 'per_hour', quantityKey: 'serviceHours' },
  { category: 'lighting-av', type: 'per_item', quantityKey: 'microphones' },
  { category: 'bar-beverages', type: 'per_guest', quantityKey: 'drinkingGuests' },
  { category: 'bar-beverages', type: 'per_hour', quantityKey: 'serviceHours' },
  { category: 'photo-booth', type: 'per_hour', quantityKey: 'hours' },
  { category: 'content-creation', type: 'per_hour', quantityKey: 'coverageHours' },
  { category: 'content-creation', type: 'per_item', quantityKey: 'reels' },
  { category: 'gifts-favours', type: 'per_item', quantityKey: 'quantity' },
  { category: 'choreography', type: 'per_session', quantityKey: 'sessions' },
  { category: 'security', type: 'per_hour', quantityKey: 'hours', multiplierKey: 'guards' },
] as const

function normalized(value: unknown): string {
  return String(value ?? '').trim()
}

export function isApprovedAutomaticPriceBinding(input: {
  category: string
  type: PriceComponentType
  quantityKey?: string | null
  multiplierKey?: string | null
}): boolean {
  if (!priceComponentNeedsQuantity(input.type)) return true

  const canonical = defaultPriceBinding(input.type)
  const quantityKey = normalized(input.quantityKey) || canonical || ''
  const multiplierKey = normalized(input.multiplierKey)

  if (canonical && quantityKey === canonical && !multiplierKey) return true
  if (!quantityKey) return false

  return APPROVED_BINDINGS.some((binding) =>
    binding.category === input.category &&
    binding.type === input.type &&
    binding.quantityKey === quantityKey &&
    normalized(binding.multiplierKey) === multiplierKey,
  )
}

export function priceComponentsUseApprovedAutomaticBindings(category: string, value: unknown): boolean {
  if (!Array.isArray(value)) return true
  return value.every((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false
    const row = entry as Record<string, unknown>
    if (row.amount === null || row.amount === undefined || row.amount === '') return true
    const type = String(row.type ?? '') as PriceComponentType
    return isApprovedAutomaticPriceBinding({
      category,
      type,
      quantityKey: normalized(row.quantityKey) || null,
      multiplierKey: normalized(row.multiplierKey) || null,
    })
  })
}

export function approvedWeddingArchitectBindings(): readonly ApprovedPriceBinding[] {
  return APPROVED_BINDINGS
}
