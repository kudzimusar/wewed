import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { WewedBillingInterval, WewedPlanId } from '@/lib/wewed-plans'

const STRIPE_API_BASE = 'https://api.stripe.com/v1'
const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 5 * 60

export type StripePlan = Exclude<WewedPlanId, 'free'>

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`[wewed] Missing ${name}.`)
  return value
}

function optional(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return null
}

export function stripePriceIdForPlan(
  plan: string,
  interval: WewedBillingInterval = 'month',
): string | null {
  if (plan === 'starter' && interval === 'month') {
    return optional(
      'STRIPE_PRICE_STARTER_MONTHLY',
      'STRIPE_PRICE_CANON_MONTHLY',
      'STRIPE_PRICE_STARTER',
      'STRIPE_PRICE_CANON',
    )
  }
  if (plan === 'starter' && interval === 'year') {
    return optional('STRIPE_PRICE_STARTER_ANNUAL', 'STRIPE_PRICE_CANON_ANNUAL')
  }
  if (plan === 'professional' && interval === 'month') {
    return optional(
      'STRIPE_PRICE_PROFESSIONAL_MONTHLY',
      'STRIPE_PRICE_FOREVER_MONTHLY',
      'STRIPE_PRICE_PROFESSIONAL',
      'STRIPE_PRICE_FOREVER',
    )
  }
  if (plan === 'professional' && interval === 'year') {
    return optional('STRIPE_PRICE_PROFESSIONAL_ANNUAL', 'STRIPE_PRICE_FOREVER_ANNUAL')
  }
  if (plan === 'enterprise' && interval === 'month') {
    return optional('STRIPE_PRICE_ENTERPRISE_MONTHLY', 'STRIPE_PRICE_ENTERPRISE')
  }
  if (plan === 'enterprise' && interval === 'year') {
    return optional('STRIPE_PRICE_ENTERPRISE_ANNUAL')
  }
  return null
}

export function stripeBillingConfiguration() {
  return {
    enabled: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
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
      Authorization: `Bearer ${required('STRIPE_SECRET_KEY')}`,
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
  return stripeRequest<{ id: string }>('/customers', {
    email: input.email,
    name: input.name,
    'metadata[businessAccountId]': input.businessAccountId,
    'metadata[platform]': 'wewed',
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
    'subscription_data[metadata][businessAccountId]': input.businessAccountId,
    'subscription_data[metadata][plan]': input.plan,
    'subscription_data[metadata][interval]': input.interval,
    'subscription_data[metadata][platform]': 'wewed',
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

  const expected = createHmac('sha256', required('STRIPE_WEBHOOK_SECRET'))
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')

  return signatures.some((signature) => safeEqual(signature, expected))
}
