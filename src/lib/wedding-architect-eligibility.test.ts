import { describe, expect, test } from 'bun:test'
import { evaluateWeddingArchitectEligibility, type WeddingArchitectCandidate } from './wedding-architect-eligibility'

const baseCandidate: WeddingArchitectCandidate = {
  providerId: 'provider-1',
  offeringId: 'offering-1',
  category: 'catering',
  businessActive: true,
  subscriptionEntitled: true,
  listingStatus: 'verified',
  offeringStatus: 'published',
  aiReadinessStatus: 'ready',
  pricingVisibility: 'exact',
  currency: 'USD',
  serviceAreas: ['Harare', 'Zimbabwe nationwide'],
  minimumCapacity: 50,
  maximumCapacity: 300,
  priceValidUntil: '2026-12-31T23:59:59.999Z',
  availability: 'available',
}

const request = {
  category: 'catering',
  country: 'Zimbabwe',
  city: 'Harare',
  guestCount: 120,
  currency: 'USD',
  now: new Date('2026-08-07T12:00:00.000Z'),
}

describe('Wedding Architect provider eligibility', () => {
  test('accepts a subscribed, verified, AI-ready provider that fits hard constraints', () => {
    expect(evaluateWeddingArchitectEligibility(baseCandidate, request)).toEqual({
      status: 'eligible',
      reasons: [],
      warnings: [],
    })
  })

  test('does not allow unpaid/ineligible providers into AI-originated opportunities', () => {
    const result = evaluateWeddingArchitectEligibility(
      { ...baseCandidate, subscriptionEntitled: false },
      request,
    )
    expect(result.status).toBe('ineligible')
    expect(result.reasons).toContain('Provider is not entitled to AI-originated opportunities.')
  })

  test('requires verified listing status for AI-originated commercial recommendations', () => {
    const claimed = evaluateWeddingArchitectEligibility(
      { ...baseCandidate, listingStatus: 'claimed' },
      request,
    )
    expect(claimed.status).toBe('ineligible')
    expect(claimed.reasons).toContain('Provider listing is not verified for AI-originated commercial recommendations.')

    const unclaimed = evaluateWeddingArchitectEligibility(
      { ...baseCandidate, listingStatus: 'unclaimed' },
      request,
    )
    expect(unclaimed.status).toBe('ineligible')
  })

  test('rejects stale, quote-only or incomplete commercial catalogues', () => {
    const result = evaluateWeddingArchitectEligibility(
      {
        ...baseCandidate,
        aiReadinessStatus: 'not_ready',
        pricingVisibility: 'quote_only',
        priceValidUntil: '2026-08-01T00:00:00.000Z',
      },
      request,
    )
    expect(result.status).toBe('ineligible')
    expect(result.reasons).toContain('Offering is not calculation-ready for AI planning.')
    expect(result.reasons).toContain('Offering does not expose calculation-ready pricing.')
    expect(result.reasons).toContain('Offering price validity is missing or expired.')
  })

  test('enforces location and capacity before ranking', () => {
    const result = evaluateWeddingArchitectEligibility(
      { ...baseCandidate, serviceAreas: ['Bulawayo'], maximumCapacity: 100 },
      request,
    )
    expect(result.status).toBe('ineligible')
    expect(result.reasons).toContain('Provider service area does not match the wedding location.')
    expect(result.reasons).toContain('Wedding guest count exceeds the offering maximum capacity.')
  })

  test('rejects currency mismatch instead of silently performing FX', () => {
    const result = evaluateWeddingArchitectEligibility(
      { ...baseCandidate, currency: 'ZAR' },
      request,
    )
    expect(result.status).toBe('ineligible')
    expect(result.reasons).toContain('Offering currency does not match the wedding budget currency.')
  })

  test('keeps unknown availability conditional unless confirmed availability is required', () => {
    const conditional = evaluateWeddingArchitectEligibility(
      { ...baseCandidate, availability: 'unknown' },
      request,
    )
    expect(conditional.status).toBe('conditional')
    expect(conditional.warnings).toContain('Provider availability must be confirmed before booking or lead conversion.')

    const strict = evaluateWeddingArchitectEligibility(
      { ...baseCandidate, availability: 'unknown' },
      { ...request, requireConfirmedAvailability: true },
    )
    expect(strict.status).toBe('ineligible')
    expect(strict.reasons).toContain('Provider availability is not confirmed for the wedding date.')
  })

  test('accepts nationwide scope only for its matching country', () => {
    const candidate = { ...baseCandidate, serviceAreas: ['Zimbabwe nationwide'] }
    expect(evaluateWeddingArchitectEligibility(candidate, request).status).toBe('eligible')
    expect(evaluateWeddingArchitectEligibility(candidate, { ...request, country: 'Zambia', city: 'Lusaka' }).status).toBe('ineligible')
  })
})
