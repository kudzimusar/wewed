import { describe, expect, test } from 'bun:test'
import {
  isApprovedAutomaticPriceBinding,
  priceComponentsUseApprovedAutomaticBindings,
} from '@/lib/wedding-architect-binding-policy'

describe('Wedding Architect automatic binding policy', () => {
  test('keeps globally canonical guest pricing safe', () => {
    expect(isApprovedAutomaticPriceBinding({
      category: 'catering',
      type: 'per_guest',
      quantityKey: '__guest_count',
    })).toBe(true)
  })

  test('approves exact category semantics', () => {
    expect(isApprovedAutomaticPriceBinding({
      category: 'cakes',
      type: 'per_serving',
      quantityKey: 'servings',
    })).toBe(true)
    expect(isApprovedAutomaticPriceBinding({
      category: 'accommodation-travel',
      type: 'per_room',
      quantityKey: 'rooms',
      multiplierKey: 'nights',
    })).toBe(true)
    expect(isApprovedAutomaticPriceBinding({
      category: 'security',
      type: 'per_hour',
      quantityKey: 'hours',
      multiplierKey: 'guards',
    })).toBe(true)
  })

  test('rejects unrelated numeric fields and unapproved compound pricing', () => {
    expect(isApprovedAutomaticPriceBinding({
      category: 'cakes',
      type: 'per_serving',
      quantityKey: 'tiers',
    })).toBe(false)
    expect(isApprovedAutomaticPriceBinding({
      category: 'photography',
      type: 'per_hour',
      quantityKey: 'coverageHours',
      multiplierKey: 'coverageHours',
    })).toBe(false)
    expect(priceComponentsUseApprovedAutomaticBindings('stationery', [{
      type: 'per_item',
      amount: '2.50',
      quantityKey: 'invitations',
    }])).toBe(true)
    expect(priceComponentsUseApprovedAutomaticBindings('stationery', [{
      type: 'per_item',
      amount: '2.50',
      quantityKey: 'placeCards',
      multiplierKey: 'invitations',
    }])).toBe(false)
  })
})
