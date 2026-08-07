import { describe, expect, test } from 'bun:test'
import {
  defaultPriceBinding,
  priceComponentNeedsExplicitBinding,
  priceComponentsUseCanonicalAutomaticBindings,
  providerPriceBindingOptions,
  resolveBoundQuantity,
} from './provider-price-bindings'

describe('provider price quantity bindings', () => {
  test('uses canonical wedding counts for guest/adult/child pricing', () => {
    expect(defaultPriceBinding('per_guest')).toBe('__guest_count')
    expect(defaultPriceBinding('per_adult')).toBe('__adult_count')
    expect(defaultPriceBinding('per_child')).toBe('__child_count')
  })

  test('requires explicit category binding for ambiguous units', () => {
    expect(priceComponentNeedsExplicitBinding('per_item')).toBe(true)
    expect(priceComponentNeedsExplicitBinding('per_serving')).toBe(true)
    expect(priceComponentNeedsExplicitBinding('per_table')).toBe(true)
    expect(priceComponentNeedsExplicitBinding('per_hour')).toBe(true)
    expect(priceComponentNeedsExplicitBinding('per_guest')).toBe(false)
  })

  test('offers the same numeric wedding requirement fields that couples/planners complete', () => {
    const catering = providerPriceBindingOptions('catering')
    expect(catering).toContainEqual({ key: 'adultGuests', label: 'Adults to cater for' })
    expect(catering).toContainEqual({ key: 'childGuests', label: 'Children to cater for' })

    const stationery = providerPriceBindingOptions('stationery')
    expect(stationery).toContainEqual({ key: 'invitations', label: 'Printed invitations' })
    expect(stationery).toContainEqual({ key: 'menus', label: 'Menus/programmes' })
  })

  test('allows only canonical globally-defined quantity semantics for automatic planning', () => {
    expect(priceComponentsUseCanonicalAutomaticBindings([
      { type: 'fixed', amount: '1000' },
      { type: 'per_guest', amount: '25', quantityKey: '__guest_count' },
      { type: 'per_kilometre', amount: '1.50', quantityKey: '__travel_km' },
    ])).toBe(true)

    expect(priceComponentsUseCanonicalAutomaticBindings([
      { type: 'per_guest', amount: '25', quantityKey: 'drinkingGuests' },
    ])).toBe(false)

    expect(priceComponentsUseCanonicalAutomaticBindings([
      { type: 'per_item', amount: '5', quantityKey: 'invitations' },
    ])).toBe(false)

    expect(priceComponentsUseCanonicalAutomaticBindings([
      { type: 'per_room', amount: '80', quantityKey: 'rooms', multiplierKey: 'nights' },
    ])).toBe(false)
  })

  test('resolves a single requirement quantity deterministically', () => {
    expect(resolveBoundQuantity({
      type: 'per_serving',
      quantityKey: 'servings',
      context: {
        guestCount: 120,
        categoryRequirements: { servings: 130 },
      },
    })).toBe(130)
  })

  test('supports compound quantities such as room nights and guard hours', () => {
    expect(resolveBoundQuantity({
      type: 'per_room',
      quantityKey: 'rooms',
      multiplierKey: 'nights',
      context: {
        categoryRequirements: { rooms: 20, nights: 2 },
      },
    })).toBe(40)

    expect(resolveBoundQuantity({
      type: 'per_hour',
      quantityKey: 'guards',
      multiplierKey: 'hours',
      context: {
        categoryRequirements: { guards: 4, hours: 8 },
      },
    })).toBe(32)
  })

  test('fails rather than guessing an ambiguous quantity', () => {
    expect(() => resolveBoundQuantity({
      type: 'per_item',
      context: { categoryRequirements: {} },
    })).toThrow('requires an explicit wedding requirement quantity binding')
  })

  test('fails when a bound requirement is missing instead of pricing it as zero', () => {
    expect(() => resolveBoundQuantity({
      type: 'per_serving',
      quantityKey: 'servings',
      context: { categoryRequirements: {} },
    })).toThrow('servings is required for deterministic pricing')

    expect(() => resolveBoundQuantity({
      type: 'per_guest',
      context: { guestCount: null, categoryRequirements: {} },
    })).toThrow('Guest count is required for deterministic pricing')
  })
})
