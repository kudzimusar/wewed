import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface StripePriceResponse {
  id?: string
  active?: boolean
  currency?: string
  livemode?: boolean
  unit_amount?: number | null
  recurring?: {
    interval?: string
    interval_count?: number
  } | null
  error?: {
    message?: string
    type?: string
  }
}

const expectedPrices = [
  {
    variable: 'STRIPE_TEST_PRICE_CANON_MONTHLY',
    plan: 'Canon',
    cadence: 'month',
    amount: 1500,
  },
  {
    variable: 'STRIPE_TEST_PRICE_CANON_ANNUAL',
    plan: 'Canon',
    cadence: 'year',
    amount: 15000,
  },
  {
    variable: 'STRIPE_TEST_PRICE_FOREVER_MONTHLY',
    plan: 'Forever',
    cadence: 'month',
    amount: 3900,
  },
  {
    variable: 'STRIPE_TEST_PRICE_FOREVER_ANNUAL',
    plan: 'Forever',
    cadence: 'year',
    amount: 39000,
  },
] as const

export async function GET() {
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ success: false }, { status: 404 })
  }

  const secretKey = process.env.STRIPE_TEST_SECRET_KEY?.trim() || ''
  const webhookSecret = process.env.STRIPE_TEST_WEBHOOK_SECRET?.trim() || ''

  const credentials = {
    secretKeyPresent: Boolean(secretKey),
    secretKeyLooksTestMode: secretKey.startsWith('sk_test_'),
    webhookSecretPresent: Boolean(webhookSecret),
    webhookSecretLooksValid: webhookSecret.startsWith('whsec_'),
  }

  const prices = await Promise.all(expectedPrices.map(async (expected) => {
    const priceId = process.env[expected.variable]?.trim() || ''
    if (!secretKey || !priceId) {
      return {
        variable: expected.variable,
        plan: expected.plan,
        cadence: expected.cadence,
        configured: Boolean(priceId),
        verified: false,
        error: !priceId ? 'missing_price_id' : 'missing_test_secret_key',
      }
    }

    try {
      const response = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
        headers: { Authorization: `Bearer ${secretKey}` },
        cache: 'no-store',
      })
      const price = await response.json() as StripePriceResponse

      const checks = {
        retrieved: response.ok,
        active: price.active === true,
        testMode: price.livemode === false,
        currencyUsd: price.currency === 'usd',
        amountMatches: price.unit_amount === expected.amount,
        cadenceMatches:
          price.recurring?.interval === expected.cadence &&
          price.recurring?.interval_count === 1,
      }

      return {
        variable: expected.variable,
        plan: expected.plan,
        cadence: expected.cadence,
        configured: true,
        verified: Object.values(checks).every(Boolean),
        checks,
        error: response.ok ? null : price.error?.message || 'stripe_lookup_failed',
      }
    } catch {
      return {
        variable: expected.variable,
        plan: expected.plan,
        cadence: expected.cadence,
        configured: true,
        verified: false,
        error: 'stripe_request_failed',
      }
    }
  }))

  const success =
    Object.values(credentials).every(Boolean) &&
    prices.every((price) => price.verified)

  return NextResponse.json(
    {
      success,
      environment: process.env.VERCEL_ENV || 'development',
      stripeMode: 'test',
      credentials,
      prices,
      webhookDeliveryCertified: false,
    },
    { status: success ? 200 : 503 },
  )
}
