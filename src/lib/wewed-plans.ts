export type WewedPlanId = 'free' | 'starter' | 'professional' | 'enterprise'
export type WewedBillingInterval = 'month' | 'year'

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

export const WEWED_PLANS: readonly WewedPlan[] = [
  {
    id: 'free',
    publicName: 'Free',
    audience: 'Couples and first-time Wewed users',
    summary: 'Launch a wedding space and experience the core collaboration flow before upgrading.',
    monthlyCents: 0,
    annualCents: 0,
    selfService: false,
    features: [
      'Public wedding page and mobile experience',
      'RSVP, guest participation, live wall and memories',
      'One active wedding workspace',
      'Wewed branding',
      'Community support',
    ],
  },
  {
    id: 'starter',
    publicName: 'Canon',
    audience: 'Couples and solo wedding professionals',
    summary: 'The complete planning workspace for one active wedding, with preservation and professional tools.',
    monthlyCents: 1500,
    annualCents: 15000,
    selfService: true,
    highlighted: true,
    features: [
      'Everything in Free',
      'Full planner workspace: tasks, budget, guests, vendors and timeline',
      'Private or link-only wedding experience',
      'Reusable planner templates and exports',
      'Email support',
    ],
  },
  {
    id: 'professional',
    publicName: 'Forever',
    audience: 'Planners, planning companies and growing teams',
    summary: 'Run multiple weddings with team governance, operational visibility and priority support.',
    monthlyCents: 3900,
    annualCents: 39000,
    selfService: true,
    features: [
      'Everything in Canon',
      'Multi-wedding planner operations',
      'Team roles and permissions',
      'Operational analytics and audit history',
      'Priority onboarding and support',
    ],
  },
  {
    id: 'enterprise',
    publicName: 'Enterprise',
    audience: 'Venues, agencies and larger wedding portfolios',
    summary: 'A sales-assisted plan for custom governance, onboarding, portfolio and support requirements.',
    monthlyCents: 12900,
    annualCents: 129000,
    selfService: false,
    features: [
      'Everything in Forever',
      'Custom account and portfolio structure',
      'Dedicated implementation and data onboarding',
      'Advanced governance and support controls',
      'Contracted service and support terms',
    ],
  },
] as const

export const WEWED_PLAN_BY_ID = Object.fromEntries(
  WEWED_PLANS.map((plan) => [plan.id, plan]),
) as Record<WewedPlanId, WewedPlan>

export function isWewedPlanId(value: unknown): value is WewedPlanId {
  return typeof value === 'string' && value in WEWED_PLAN_BY_ID
}

export function isWewedBillingInterval(value: unknown): value is WewedBillingInterval {
  return value === 'month' || value === 'year'
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

export function annualMonthlyEquivalent(plan: WewedPlan): number | null {
  if (plan.annualCents === null) return null
  return Math.round(plan.annualCents / 12)
}
