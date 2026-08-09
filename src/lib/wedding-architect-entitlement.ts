export const WEDDING_ARCHITECT_PROVIDER_ENTITLEMENT = 'ai_wedding_architect_opportunities' as const
export const WEDDING_ARCHITECT_PLANNER_ENTITLEMENT = 'ai_wedding_architect_planning' as const

export type WeddingArchitectBillingOffer = {
  offerCode: string
  accountType: string
  billingModel: string
  status: string
  entitlements: unknown
}

export type WeddingArchitectBillingProfile = {
  accountType: string
  offerCode: string
  status: string
  currentPeriodEndsAt?: Date | string | null
}

export type WeddingArchitectEntitlementInput = {
  accountType: string
  accountStatus: string
  billingProfile?: WeddingArchitectBillingProfile | null
  billingOffer?: WeddingArchitectBillingOffer | null
  entitlement: string
  requirePaid?: boolean
  now?: Date
}

export type WeddingArchitectEntitlementResult = {
  entitled: boolean
  reasons: string[]
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

function currentPeriodIsValid(value: Date | string | null | undefined, now: Date): boolean {
  if (!value) return true
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isFinite(parsed.getTime()) && parsed.getTime() >= now.getTime()
}

function profileStatusAllowsUse(status: string, billingModel: string): boolean {
  if (billingModel === 'free') return status === 'free' || status === 'active'
  return ['active', 'trialing'].includes(status)
}

export function resolveWeddingArchitectEntitlement(
  input: WeddingArchitectEntitlementInput,
): WeddingArchitectEntitlementResult {
  const reasons: string[] = []
  const now = input.now ?? new Date()
  const profile = input.billingProfile
  const offer = input.billingOffer

  if (input.accountStatus !== 'active') reasons.push('Business account is not active.')
  if (!profile) reasons.push('Business account has no governed billing profile.')
  if (!offer) reasons.push('Billing profile does not resolve to an active Wewed offer.')

  if (profile && profile.accountType !== input.accountType) {
    reasons.push('Billing profile account type does not match the business account.')
  }
  if (offer && offer.accountType !== input.accountType) {
    reasons.push('Billing offer account type does not match the business account.')
  }
  if (profile && offer && profile.offerCode !== offer.offerCode) {
    reasons.push('Billing profile and billing offer do not match.')
  }
  if (offer && offer.status !== 'active') reasons.push('Billing offer is not active.')
  if (offer && input.requirePaid && offer.billingModel === 'free') {
    reasons.push('AI-originated commercial opportunities require an entitled paid or contract offer.')
  }
  if (profile && offer && !profileStatusAllowsUse(profile.status, offer.billingModel)) {
    reasons.push('Billing profile is not active for this entitlement.')
  }
  if (profile && !currentPeriodIsValid(profile.currentPeriodEndsAt, now)) {
    reasons.push('Billing entitlement period has expired.')
  }
  if (offer && !stringList(offer.entitlements).includes(input.entitlement)) {
    reasons.push(`Billing offer does not include ${input.entitlement}.`)
  }

  return { entitled: reasons.length === 0, reasons }
}
