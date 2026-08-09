export type CandidateAvailability = 'available' | 'unavailable' | 'unknown'

export type WeddingArchitectCandidate = {
  providerId: string
  offeringId: string
  category: string
  businessActive: boolean
  subscriptionEntitled: boolean
  listingStatus: string
  offeringStatus: string
  aiReadinessStatus: string
  pricingVisibility: string
  currency: string
  serviceAreas: string[]
  minimumCapacity?: number | null
  maximumCapacity?: number | null
  priceValidUntil?: string | null
  availability: CandidateAvailability
}

export type WeddingArchitectEligibilityRequest = {
  category: string
  country: string
  city: string
  guestCount?: number | null
  currency: string
  now?: Date
  requireConfirmedAvailability?: boolean
}

export type WeddingArchitectEligibility = {
  status: 'eligible' | 'conditional' | 'ineligible'
  reasons: string[]
  warnings: string[]
}

function normalized(value: string): string {
  return value.trim().toLowerCase()
}

function serviceAreaMatches(serviceAreas: string[], country: string, city: string): boolean {
  const areas = serviceAreas.map(normalized)
  const cityKey = normalized(city)
  const countryKey = normalized(country)
  if (cityKey && areas.includes(cityKey)) return true
  if (countryKey && areas.includes(`${countryKey} nationwide`)) return true
  if (areas.includes('regional / destination')) return true
  return false
}

function currentPrice(priceValidUntil: string | null | undefined, now: Date): boolean {
  if (!priceValidUntil) return false
  const parsed = new Date(priceValidUntil)
  return Number.isFinite(parsed.getTime()) && parsed.getTime() >= now.getTime()
}

export function evaluateWeddingArchitectEligibility(
  candidate: WeddingArchitectCandidate,
  request: WeddingArchitectEligibilityRequest,
): WeddingArchitectEligibility {
  const reasons: string[] = []
  const warnings: string[] = []
  const now = request.now ?? new Date()

  if (!candidate.businessActive) reasons.push('Provider business is not active.')
  if (!candidate.subscriptionEntitled) reasons.push('Provider is not entitled to AI-originated opportunities.')
  // AI-originated commercial recommendations use the strongest operational
  // provider governance state Wewed currently maintains. A claimed listing may
  // continue normal marketplace activity, but only a verified listing can be
  // automatically selected into a paid Wedding Architect plan.
  if (candidate.listingStatus !== 'verified') reasons.push('Provider listing is not verified for AI-originated commercial recommendations.')
  if (candidate.offeringStatus !== 'published') reasons.push('Offering is not published.')
  if (candidate.aiReadinessStatus !== 'ready') reasons.push('Offering is not calculation-ready for AI planning.')
  if (!['exact', 'from', 'range'].includes(candidate.pricingVisibility)) reasons.push('Offering does not expose calculation-ready pricing.')
  if (normalized(candidate.category) !== normalized(request.category)) reasons.push('Offering category does not match the wedding requirement.')
  if (normalized(candidate.currency) !== normalized(request.currency)) reasons.push('Offering currency does not match the wedding budget currency.')
  if (!currentPrice(candidate.priceValidUntil, now)) reasons.push('Offering price validity is missing or expired.')
  if (!serviceAreaMatches(candidate.serviceAreas, request.country, request.city)) reasons.push('Provider service area does not match the wedding location.')

  if (request.guestCount !== null && request.guestCount !== undefined) {
    const guestCount = request.guestCount
    if (!Number.isSafeInteger(guestCount) || guestCount < 0) {
      reasons.push('Wedding guest count is invalid for eligibility evaluation.')
    } else {
      if (candidate.minimumCapacity !== null && candidate.minimumCapacity !== undefined && guestCount < candidate.minimumCapacity) {
        reasons.push('Wedding guest count is below the offering minimum capacity.')
      }
      if (candidate.maximumCapacity !== null && candidate.maximumCapacity !== undefined && guestCount > candidate.maximumCapacity) {
        reasons.push('Wedding guest count exceeds the offering maximum capacity.')
      }
    }
  }

  if (candidate.availability === 'unavailable') {
    reasons.push('Provider is unavailable for the wedding date.')
  } else if (candidate.availability === 'unknown') {
    if (request.requireConfirmedAvailability) {
      reasons.push('Provider availability is not confirmed for the wedding date.')
    } else {
      warnings.push('Provider availability must be confirmed before booking or lead conversion.')
    }
  }

  if (reasons.length > 0) return { status: 'ineligible', reasons, warnings }
  if (warnings.length > 0) return { status: 'conditional', reasons: [], warnings }
  return { status: 'eligible', reasons: [], warnings: [] }
}
