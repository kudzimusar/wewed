import { describe, expect, test } from 'bun:test'
import {
  WEDDING_ARCHITECT_PROVIDER_ENTITLEMENT,
  resolveWeddingArchitectEntitlement,
} from '@/lib/wedding-architect-entitlement'

const now = new Date('2026-08-08T00:00:00.000Z')
const offer = {
  offerCode: 'vendor_growth',
  accountType: 'vendor',
  billingModel: 'contract',
  status: 'active',
  entitlements: [WEDDING_ARCHITECT_PROVIDER_ENTITLEMENT],
}
const profile = {
  accountType: 'vendor',
  offerCode: 'vendor_growth',
  status: 'active',
  currentPeriodEndsAt: '2026-09-08T00:00:00.000Z',
}

describe('Wedding Architect entitlement resolver', () => {
  test('allows an active paid provider with the explicit opportunity entitlement', () => {
    expect(resolveWeddingArchitectEntitlement({
      accountType: 'vendor',
      accountStatus: 'active',
      billingProfile: profile,
      billingOffer: offer,
      entitlement: WEDDING_ARCHITECT_PROVIDER_ENTITLEMENT,
      requirePaid: true,
      now,
    })).toEqual({ entitled: true, reasons: [] })
  })

  test('fails closed for free provider profiles even if entitlement data were misconfigured', () => {
    const result = resolveWeddingArchitectEntitlement({
      accountType: 'vendor',
      accountStatus: 'active',
      billingProfile: { ...profile, offerCode: 'vendor_profile', status: 'free' },
      billingOffer: { ...offer, offerCode: 'vendor_profile', billingModel: 'free' },
      entitlement: WEDDING_ARCHITECT_PROVIDER_ENTITLEMENT,
      requirePaid: true,
      now,
    })
    expect(result.entitled).toBe(false)
    expect(result.reasons).toContain('AI-originated commercial opportunities require an entitled paid or contract offer.')
  })

  test('fails closed when billing profile is missing, expired, mismatched or inactive', () => {
    expect(resolveWeddingArchitectEntitlement({
      accountType: 'vendor',
      accountStatus: 'active',
      billingProfile: null,
      billingOffer: offer,
      entitlement: WEDDING_ARCHITECT_PROVIDER_ENTITLEMENT,
      requirePaid: true,
      now,
    }).entitled).toBe(false)

    expect(resolveWeddingArchitectEntitlement({
      accountType: 'vendor',
      accountStatus: 'active',
      billingProfile: { ...profile, currentPeriodEndsAt: '2026-08-07T23:59:59.000Z' },
      billingOffer: offer,
      entitlement: WEDDING_ARCHITECT_PROVIDER_ENTITLEMENT,
      requirePaid: true,
      now,
    }).entitled).toBe(false)

    expect(resolveWeddingArchitectEntitlement({
      accountType: 'venue',
      accountStatus: 'active',
      billingProfile: profile,
      billingOffer: offer,
      entitlement: WEDDING_ARCHITECT_PROVIDER_ENTITLEMENT,
      requirePaid: true,
      now,
    }).entitled).toBe(false)

    expect(resolveWeddingArchitectEntitlement({
      accountType: 'vendor',
      accountStatus: 'suspended',
      billingProfile: profile,
      billingOffer: offer,
      entitlement: WEDDING_ARCHITECT_PROVIDER_ENTITLEMENT,
      requirePaid: true,
      now,
    }).entitled).toBe(false)
  })
})
