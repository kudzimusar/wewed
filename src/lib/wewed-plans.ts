export type WewedPlanId = 'free' | 'starter' | 'professional' | 'enterprise'
export type WewedBillingInterval = 'month' | 'year'
export type WewedBillableAccountType =
  | 'couple'
  | 'planning_company'
  | 'venue'
  | 'vendor'
  | 'client'

export type WewedBillingOfferCode =
  | 'couple_free'
  | 'couple_canon'
  | 'planner_free'
  | 'planner_professional'
  | 'vendor_profile'
  | 'vendor_growth'
  | 'venue_profile'
  | 'venue_portfolio'
  | 'client_custom'

export type WewedPlan = {
  id: WewedPlanId
  publicName: string
  audience: string
  summary: string
  monthlyCents: number | null
  annualCents: number | null
  selfService: boolean
  highlighted?: boolean
  features: string[]
}

export type WewedBillingOffer = {
  code: WewedBillingOfferCode
  accountType: WewedBillableAccountType
  publicName: string
  audience: string
  summary: string
  billingModel: 'free' | 'subscription' | 'contract'
  legacyPlan: WewedPlanId
  monthlyCents: number | null
  annualCents: number | null
  selfService: boolean
  highlighted?: boolean
  departmentKeys: string[]
  features: string[]
}

/**
 * Compatibility catalog retained for registration, reporting, and existing
 * Stripe mirrors. Checkout must use BILLING_OFFERS and account-type validation.
 */
export const WEWED_PLANS: readonly WewedPlan[] = [
  {
    id: 'free',
    publicName: 'Free',
    audience: 'Category-specific Wewed foundations',
    summary: 'The free foundation selected for the account category.',
    monthlyCents: 0,
    annualCents: 0,
    selfService: false,
    features: [
      'Account-category foundation',
      'Core profile or workspace',
      'Community support',
    ],
  },
  {
    id: 'starter',
    publicName: 'Canon',
    audience: 'Couples',
    summary: 'The complete planning and collaboration workspace for one couple.',
    monthlyCents: 1500,
    annualCents: 15000,
    selfService: true,
    highlighted: true,
    features: [
      'Private wedding workspace',
      'Tasks, budget, guests, vendors, timeline and seating',
      'Content, memories, templates and exports',
      'Email support',
    ],
  },
  {
    id: 'professional',
    publicName: 'Professional',
    audience: 'Planners and planning companies',
    summary: 'Multi-wedding operations with team governance and reusable resources.',
    monthlyCents: 3900,
    annualCents: 39000,
    selfService: true,
    features: [
      'Multi-wedding portfolio operations',
      'Client delivery and engagement authority',
      'Templates, imports, exports and worksheets',
      'Team roles, audit history and analytics',
    ],
  },
  {
    id: 'enterprise',
    publicName: 'Contract',
    audience: 'Vendors, venues and contract clients',
    summary: 'A sales-assisted offer configured for the account category and contracted services.',
    monthlyCents: null,
    annualCents: null,
    selfService: false,
    features: [
      'Category-specific systems and data points',
      'Contract-defined resources and support',
      'Configured governance and billing terms',
    ],
  },
] as const

export const BILLING_OFFERS: readonly WewedBillingOffer[] = [
  {
    code: 'couple_free',
    accountType: 'couple',
    publicName: 'Couple Free',
    audience: 'Couples starting their wedding workspace',
    summary: 'Core wedding site, guest participation, content and support foundation.',
    billingModel: 'free',
    legacyPlan: 'free',
    monthlyCents: 0,
    annualCents: 0,
    selfService: false,
    departmentKeys: [
      'couple_wedding_workspace',
      'couple_guest_experience',
      'couple_content_memories',
      'couple_billing_support',
    ],
    features: [
      'Wedding site and core settings',
      'Guest list and RSVP',
      'Content and memories',
      'Community support',
    ],
  },
  {
    code: 'couple_canon',
    accountType: 'couple',
    publicName: 'Couple Canon',
    audience: 'Couples who need complete planning controls',
    summary: 'Complete private wedding planning and collaboration for one couple.',
    billingModel: 'subscription',
    legacyPlan: 'starter',
    monthlyCents: 1500,
    annualCents: 15000,
    selfService: true,
    highlighted: true,
    departmentKeys: [
      'couple_wedding_workspace',
      'couple_guest_experience',
      'couple_planning_controls',
      'couple_content_memories',
      'couple_billing_support',
    ],
    features: [
      'Everything in Couple Free',
      'Tasks, budget, vendors, timeline and seating',
      'Private or link-only wedding experience',
      'Templates, exports and email support',
    ],
  },
  {
    code: 'planner_free',
    accountType: 'planning_company',
    publicName: 'Planner Starter',
    audience: 'New planning professionals and teams',
    summary: 'Profile, client-delivery and commercial workflow foundation.',
    billingModel: 'free',
    legacyPlan: 'free',
    monthlyCents: 0,
    annualCents: 0,
    selfService: false,
    departmentKeys: [
      'planner_portfolio_operations',
      'planner_client_delivery',
      'planner_commercial_operations',
    ],
    features: [
      'Planner profile and workspace',
      'Client delivery foundation',
      'Enquiry workflow',
    ],
  },
  {
    code: 'planner_professional',
    accountType: 'planning_company',
    publicName: 'Planner Professional',
    audience: 'Planning companies running multiple weddings',
    summary: 'Multi-wedding operations, templates, team governance and analytics.',
    billingModel: 'subscription',
    legacyPlan: 'professional',
    monthlyCents: 3900,
    annualCents: 39000,
    selfService: true,
    highlighted: true,
    departmentKeys: [
      'planner_portfolio_operations',
      'planner_client_delivery',
      'planner_templates_resources',
      'planner_team_governance',
      'planner_commercial_operations',
    ],
    features: [
      'Multi-wedding portfolio operations',
      'Client authority and collaboration',
      'Reusable templates, imports and exports',
      'Team permissions, audit history and analytics',
    ],
  },
  {
    code: 'vendor_profile',
    accountType: 'vendor',
    publicName: 'Vendor Profile',
    audience: 'Wedding vendors building a verified Wewed presence',
    summary: 'Profile, services, packages, portfolio, enquiries and verification foundation.',
    billingModel: 'free',
    legacyPlan: 'free',
    monthlyCents: 0,
    annualCents: 0,
    selfService: false,
    departmentKeys: [
      'vendor_business_profile',
      'vendor_services_packages',
      'vendor_portfolio',
      'vendor_enquiries',
      'vendor_verification_billing',
    ],
    features: [
      'Business profile and service areas',
      'Service and package catalog',
      'Portfolio and enquiry inbox',
      'Verification foundation',
    ],
  },
  {
    code: 'vendor_growth',
    accountType: 'vendor',
    publicName: 'Vendor Growth',
    audience: 'Verified vendors requiring expanded commercial tools',
    summary: 'Contract/configured vendor tools; Checkout stays unavailable until a dedicated vendor price is approved.',
    billingModel: 'contract',
    legacyPlan: 'enterprise',
    monthlyCents: null,
    annualCents: null,
    selfService: false,
    departmentKeys: [
      'vendor_business_profile',
      'vendor_services_packages',
      'vendor_portfolio',
      'vendor_enquiries',
      'vendor_verification_billing',
    ],
    features: [
      'Expanded enquiry workflow',
      'Commercial analytics',
      'Contracted support and billing terms',
    ],
  },
  {
    code: 'venue_profile',
    accountType: 'venue',
    publicName: 'Venue Profile',
    audience: 'Venues publishing spaces and packages',
    summary: 'Venue profile, capacity, availability, packages, enquiries and verification foundation.',
    billingModel: 'free',
    legacyPlan: 'free',
    monthlyCents: 0,
    annualCents: 0,
    selfService: false,
    departmentKeys: [
      'venue_profile_spaces',
      'venue_capacity_availability',
      'venue_packages_services',
      'venue_enquiries_visits',
      'venue_verification_billing',
    ],
    features: [
      'Venue profile and spaces',
      'Capacity and availability',
      'Packages and enquiries',
      'Verification foundation',
    ],
  },
  {
    code: 'venue_portfolio',
    accountType: 'venue',
    publicName: 'Venue Portfolio',
    audience: 'Venues requiring expanded multi-space operations',
    summary: 'Contract/configured venue portfolio tools; no cross-audience Stripe fallback.',
    billingModel: 'contract',
    legacyPlan: 'enterprise',
    monthlyCents: null,
    annualCents: null,
    selfService: false,
    departmentKeys: [
      'venue_profile_spaces',
      'venue_capacity_availability',
      'venue_packages_services',
      'venue_enquiries_visits',
      'venue_verification_billing',
    ],
    features: [
      'Expanded space and availability operations',
      'Site-visit and commercial analytics',
      'Contracted support and billing terms',
    ],
  },
  {
    code: 'client_custom',
    accountType: 'client',
    publicName: 'Business Custom',
    audience: 'Contract clients with defined systems and resources',
    summary: 'Sales-assisted services, data operations, integrations and support.',
    billingModel: 'contract',
    legacyPlan: 'enterprise',
    monthlyCents: null,
    annualCents: null,
    selfService: false,
    departmentKeys: [
      'client_account_governance',
      'client_data_operations',
      'client_resources_support',
      'client_contract_billing',
    ],
    features: [
      'Contract-defined systems and datasets',
      'Integration and reporting resources',
      'Governed support and billing terms',
    ],
  },
] as const

export const WEWED_PLAN_BY_ID = Object.fromEntries(
  WEWED_PLANS.map((plan) => [plan.id, plan]),
) as Record<WewedPlanId, WewedPlan>

export const BILLING_OFFER_BY_CODE = Object.fromEntries(
  BILLING_OFFERS.map((offer) => [offer.code, offer]),
) as Record<WewedBillingOfferCode, WewedBillingOffer>

export function isWewedPlanId(value: unknown): value is WewedPlanId {
  return typeof value === 'string' && value in WEWED_PLAN_BY_ID
}

export function isWewedBillingInterval(value: unknown): value is WewedBillingInterval {
  return value === 'month' || value === 'year'
}

export function isWewedBillableAccountType(
  value: unknown,
): value is WewedBillableAccountType {
  return (
    value === 'couple' ||
    value === 'planning_company' ||
    value === 'venue' ||
    value === 'vendor' ||
    value === 'client'
  )
}

export function isWewedBillingOfferCode(
  value: unknown,
): value is WewedBillingOfferCode {
  return typeof value === 'string' && value in BILLING_OFFER_BY_CODE
}

export function billingOffersForAccountType(
  accountType: string,
): readonly WewedBillingOffer[] {
  return isWewedBillableAccountType(accountType)
    ? BILLING_OFFERS.filter((offer) => offer.accountType === accountType)
    : []
}

export function billingOfferAllowsAccountType(
  offerCode: string,
  accountType: string,
): boolean {
  return (
    isWewedBillingOfferCode(offerCode) &&
    isWewedBillableAccountType(accountType) &&
    BILLING_OFFER_BY_CODE[offerCode].accountType === accountType
  )
}

export function legacyPlanForBillingOffer(
  offerCode: WewedBillingOfferCode,
): WewedPlanId {
  return BILLING_OFFER_BY_CODE[offerCode].legacyPlan
}

export function resolveBillingOfferCode(input: {
  accountType: string
  offerCode?: unknown
  legacyPlan?: unknown
}): WewedBillingOfferCode | null {
  if (
    isWewedBillingOfferCode(input.offerCode) &&
    billingOfferAllowsAccountType(input.offerCode, input.accountType)
  ) {
    return input.offerCode
  }

  if (!isWewedPlanId(input.legacyPlan)) return null

  const candidates = billingOffersForAccountType(input.accountType).filter(
    (offer) => offer.legacyPlan === input.legacyPlan,
  )
  return candidates.length === 1 ? candidates[0].code : null
}

export function defaultBillingOfferCode(
  accountType: string,
): WewedBillingOfferCode | null {
  const freeOffer = billingOffersForAccountType(accountType).find(
    (offer) => offer.billingModel === 'free',
  )
  return freeOffer?.code ??
    (accountType === 'client' ? 'client_custom' : null)
}

export function formatUsd(cents: number | null): string {
  if (cents === null) return 'Custom'
  if (cents === 0) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function annualMonthlyEquivalent(
  plan: Pick<WewedPlan | WewedBillingOffer, 'annualCents'>,
): number | null {
  if (plan.annualCents === null) return null
  return Math.round(plan.annualCents / 12)
}
