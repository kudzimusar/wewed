import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { WewedBillingInterval, WewedPlanId } from '@/lib/wewed-plans'

const STRIPE_API_BASE = 'https://api.stripe.com/v1'
const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 5 * 60

export type StripePlan = Exclude<WewedPlanId, 'free'>
export type StripeEnvironment = 'test' | 'live'

function optional(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return null
}

/**
 * Vercel Preview and local development must use Stripe test-mode resources.
 * Only an explicit Vercel Production deployment may read live Stripe variables.
 */
export function stripeUsesTestMode(): boolean {
  return process.env.VERCEL_ENV !== 'production'
}

export function stripeEnvironment(): StripeEnvironment {
  return stripeUsesTestMode() ? 'test' : 'live'
}

export function stripeAccountMetadataKeys() {
  const prefix = stripeUsesTestMode() ? 'stripeTest' : 'stripe'
  return {
    customerId: `${prefix}CustomerId`,
    subscriptionId: `${prefix}SubscriptionId`,
    checkoutSessionId: `${prefix}CheckoutSessionId`,
    billingInterval: `${prefix}BillingInterval`,
    subscriptionPlan: `${prefix}SubscriptionPlan`,
    subscriptionStatus: `${prefix}SubscriptionStatus`,
    currentPeriodEndsAt: `${prefix}CurrentPeriodEndsAt`,
    lastSyncedAt: `${prefix}LastSyncedAt`,
  }
}

export function stripeEventResourceId(eventId: string): string {
  return `${stripeEnvironment()}:${eventId}`
}

function stripeSecretKey(): string | null {
  return stripeUsesTestMode()
    ? optional('STRIPE_TEST_SECRET_KEY')
    : optional('STRIPE_SECRET_KEY')
}

function stripeWebhookSecret(): string | null {
  return stripeUsesTestMode()
    ? optional('STRIPE_TEST_WEBHOOK_SECRET')
    : optional('STRIPE_WEBHOOK_SECRET')
}

function requiredStripeSecretKey(): string {
  const value = stripeSecretKey()
  if (!value) {
    throw new Error(
      stripeUsesTestMode()
        ? '[wewed] Missing STRIPE_TEST_SECRET_KEY.'
        : '[wewed] Missing STRIPE_SECRET_KEY.',
    )
  }
  return value
}

function requiredStripeWebhookSecret(): string {
  const value = stripeWebhookSecret()
  if (!value) {
    throw new Error(
      stripeUsesTestMode()
        ? '[wewed] Missing STRIPE_TEST_WEBHOOK_SECRET.'
        : '[wewed] Missing STRIPE_WEBHOOK_SECRET.',
    )
  }
  return value
}

function priceVariableNames(
  liveNames: string[],
  testNames: string[],
): string[] {
  return stripeUsesTestMode() ? testNames : liveNames
}

export function stripePriceIdForPlan(
  plan: string,
  interval: WewedBillingInterval = 'month',
): string | null {
  if (plan === 'starter' && interval === 'month') {
    return optional(...priceVariableNames(
      [
        'STRIPE_PRICE_STARTER_MONTHLY',
        'STRIPE_PRICE_CANON_MONTHLY',
        'STRIPE_PRICE_STARTER',
        'STRIPE_PRICE_CANON',
      ],
      [
        'STRIPE_TEST_PRICE_STARTER_MONTHLY',
        'STRIPE_TEST_PRICE_CANON_MONTHLY',
      ],
    ))
  }
  if (plan === 'starter' && interval === 'year') {
    return optional(...priceVariableNames(
      ['STRIPE_PRICE_STARTER_ANNUAL', 'STRIPE_PRICE_CANON_ANNUAL'],
      ['STRIPE_TEST_PRICE_STARTER_ANNUAL', 'STRIPE_TEST_PRICE_CANON_ANNUAL'],
    ))
  }
  if (plan === 'professional' && interval === 'month') {
    return optional(...priceVariableNames(
      [
        'STRIPE_PRICE_PROFESSIONAL_MONTHLY',
        'STRIPE_PRICE_FOREVER_MONTHLY',
        'STRIPE_PRICE_PROFESSIONAL',
        'STRIPE_PRICE_FOREVER',
      ],
      [
        'STRIPE_TEST_PRICE_PROFESSIONAL_MONTHLY',
        'STRIPE_TEST_PRICE_FOREVER_MONTHLY',
      ],
    ))
  }
  if (plan === 'professional' && interval === 'year') {
    return optional(...priceVariableNames(
      ['STRIPE_PRICE_PROFESSIONAL_ANNUAL', 'STRIPE_PRICE_FOREVER_ANNUAL'],
      ['STRIPE_TEST_PRICE_PROFESSIONAL_ANNUAL', 'STRIPE_TEST_PRICE_FOREVER_ANNUAL'],
    ))
  }
  if (plan === 'enterprise' && interval === 'month') {
    return optional(...priceVariableNames(
      ['STRIPE_PRICE_ENTERPRISE_MONTHLY', 'STRIPE_PRICE_ENTERPRISE'],
      ['STRIPE_TEST_PRICE_ENTERPRISE_MONTHLY'],
    ))
  }
  if (plan === 'enterprise' && interval === 'year') {
    return optional(...priceVariableNames(
      ['STRIPE_PRICE_ENTERPRISE_ANNUAL'],
      ['STRIPE_TEST_PRICE_ENTERPRISE_ANNUAL'],
    ))
  }
  return null
}

export function stripeBillingConfiguration() {
  return {
    mode: stripeEnvironment(),
    enabled: Boolean(stripeSecretKey()),
    webhookConfigured: Boolean(stripeWebhookSecret()),
    plans: {
      starter: {
        month: Boolean(stripePriceIdForPlan('starter', 'month')),
        year: Boolean(stripePriceIdForPlan('starter', 'year')),
      },
      professional: {
        month: Boolean(stripePriceIdForPlan('professional', 'month')),
        year: Boolean(stripePriceIdForPlan('professional', 'year')),
      },
      enterprise: {
        month: Boolean(stripePriceIdForPlan('enterprise', 'month')),
        year: Boolean(stripePriceIdForPlan('enterprise', 'year')),
      },
    },
  }
}

export async function stripeRequest<T>(
  path: string,
  parameters: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(parameters)) {
    if (value === null || value === undefined) continue
    body.set(key, String(value))
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requiredStripeSecretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  })

  const payload = (await response.json()) as T & {
    error?: { message?: string; type?: string }
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Stripe rejected the billing request.')
  }

  return payload
}

export async function createStripeCustomer(input: {
  businessAccountId: string
  email: string
  name: string
}) {
  const environment = stripeEnvironment()
  return stripeRequest<{ id: string }>('/customers', {
    email: input.email,
    name: input.name,
    'metadata[businessAccountId]': input.businessAccountId,
    'metadata[platform]': 'wewed',
    'metadata[environment]': environment,
  })
}

export async function createStripeCheckoutSession(input: {
  origin: string
  businessAccountId: string
  customerId: string
  plan: StripePlan
  interval: WewedBillingInterval
}) {
  const priceId = stripePriceIdForPlan(input.plan, input.interval)
  if (!priceId) {
    throw new Error(`Stripe pricing for ${input.plan} (${input.interval}) is not configured.`)
  }

  const environment = stripeEnvironment()
  return stripeRequest<{ id: string; url: string | null }>('/checkout/sessions', {
    mode: 'subscription',
    customer: input.customerId,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': 1,
    success_url: `${input.origin}/billing?checkout=success`,
    cancel_url: `${input.origin}/billing?checkout=cancelled`,
    client_reference_id: input.businessAccountId,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    'metadata[businessAccountId]': input.businessAccountId,
    'metadata[plan]': input.plan,
    'metadata[interval]': input.interval,
    'metadata[platform]': 'wewed',
    'metadata[environment]': environment,
    'subscription_data[metadata][businessAccountId]': input.businessAccountId,
    'subscription_data[metadata][plan]': input.plan,
    'subscription_data[metadata][interval]': input.interval,
    'subscription_data[metadata][platform]': 'wewed',
    'subscription_data[metadata][environment]': environment,
  })
}

export async function createStripePortalSession(input: {
  origin: string
  customerId: string
}) {
  return stripeRequest<{ id: string; url: string }>('/billing_portal/sessions', {
    customer: input.customerId,
    return_url: `${input.origin}/billing`,
  })
}

function safeEqual(actual: string, expected: string): boolean {
  try {
    const actualBuffer = Buffer.from(actual, 'hex')
    const expectedBuffer = Buffer.from(expected, 'hex')
    if (actualBuffer.length !== expectedBuffer.length) return false
    return timingSafeEqual(actualBuffer, expectedBuffer)
  } catch {
    return false
  }
}

export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!signatureHeader) return false

  const parts = signatureHeader.split(',').map((part) => part.trim())
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2)
  const signatures = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.slice(3))

  if (!timestamp || signatures.length === 0) return false
  const timestampNumber = Number(timestamp)
  if (!Number.isFinite(timestampNumber)) return false
  if (Math.abs(nowSeconds - timestampNumber) > STRIPE_SIGNATURE_TOLERANCE_SECONDS) {
    return false
  }

  const expected = createHmac('sha256', requiredStripeWebhookSecret())
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')

  return signatures.some((signature) => safeEqual(signature, expected))
}
