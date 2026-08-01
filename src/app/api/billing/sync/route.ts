import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { businessMemberCanManageBilling } from '@/lib/business-access'
import { db } from '@/lib/db'
import {
  stripeAccountMetadataKeys,
  stripeEnvironment,
  stripeUsesTestMode,
} from '@/lib/stripe-billing'
import {
  isWewedBillingInterval,
  isWewedPlanId,
} from '@/lib/wewed-plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type BillingAccountRow = {
  id: string
  status: string
  onboardingStatus: string
  metadata: Record<string, unknown> | null
  memberRole: string
  memberPermissions: unknown
}

type StripeSubscription = {
  id: string
  customer: string | { id?: string } | null
  status: string
  created?: number
  current_period_end?: number
  cancel_at_period_end?: boolean
  metadata?: Record<string, string>
  items?: {
    data?: Array<{
      current_period_end?: number
      price?: {
        recurring?: { interval?: string }
      }
    }>
  }
}

type StripeList<T> = {
  data?: T[]
  error?: { message?: string }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function metadataText(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function stringId(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' ? id : null
  }
  return null
}

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.trunc(value)
    : null
}

function requiredStripeSecretKey(): string {
  const variable = stripeUsesTestMode()
    ? 'STRIPE_TEST_SECRET_KEY'
    : 'STRIPE_SECRET_KEY'
  const value = process.env[variable]?.trim()
  if (!value) throw new Error(`[wewed] Missing ${variable}.`)
  return value
}

async function stripeGet<T>(
  path: string,
  parameters: Record<string, string | number | null | undefined>,
): Promise<T> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(parameters)) {
    if (value === null || value === undefined) continue
    query.set(key, String(value))
  }

  const response = await fetch(
    `https://api.stripe.com/v1${path}?${query.toString()}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${requiredStripeSecretKey()}` },
      cache: 'no-store',
    },
  )
  const payload = (await response.json()) as T & { error?: { message?: string } }
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Stripe rejected the reconciliation request.')
  }
  return payload
}

function subscriptionPriority(status: string): number {
  const order = [
    'active',
    'trialing',
    'past_due',
    'unpaid',
    'incomplete',
    'paused',
    'canceled',
    'incomplete_expired',
  ]
  const index = order.indexOf(status)
  return index === -1 ? order.length : index
}

function normalizeStatus(status: string): string {
  return status === 'canceled' ? 'cancelled' : status
}

async function resolveBillingAccount(request: NextRequest): Promise<BillingAccountRow | null> {
  const session = readAppSession(request)
  if (!session) return null

  const rows = await db.$queryRawUnsafe<BillingAccountRow[]>(
    `SELECT ba.id, ba.status, ba."onboardingStatus", ba.metadata,
      bam.role AS "memberRole", bam.permissions AS "memberPermissions"
     FROM public."BusinessAccountMember" bam
     JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
     WHERE bam."userId" = $1
       AND bam.status = 'active'
       AND ba.type <> 'wewed_internal'
     ORDER BY CASE
       WHEN ba.status = 'active' AND ba."onboardingStatus" = 'complete' THEN 0
       WHEN ba.status = 'active' THEN 1
       ELSE 2
     END, ba."updatedAt" DESC
     LIMIT 1`,
    session.userId,
  )

  return rows[0] ?? null
}

export async function POST(request: NextRequest) {
  try {
    const account = await resolveBillingAccount(request)
    if (!account) {
      return NextResponse.json(
        { success: false, error: 'An active business membership is required.' },
        { status: 401 },
      )
    }

    if (!businessMemberCanManageBilling(account.memberRole, account.memberPermissions)) {
      return NextResponse.json(
        { success: false, error: 'Only a business owner or billing manager may synchronize billing.' },
        { status: 403 },
      )
    }

    if (account.status !== 'active' || account.onboardingStatus !== 'complete') {
      return NextResponse.json(
        { success: false, error: 'Complete approval and onboarding before synchronizing billing.' },
        { status: 403 },
      )
    }

    const metadata = objectValue(account.metadata)
    const keys = stripeAccountMetadataKeys()
    const customerId = metadataText(metadata, keys.customerId)
    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'No Stripe customer exists for this account yet.' },
        { status: 409 },
      )
    }

    const environment = stripeEnvironment()
    const payload = await stripeGet<StripeList<StripeSubscription>>('/subscriptions', {
      customer: customerId,
      status: 'all',
      limit: 20,
    })

    const subscriptions = (payload.data || [])
      .filter((subscription) => {
        const subscriptionCustomer = stringId(subscription.customer)
        const subscriptionMetadata = subscription.metadata || {}
        const accountMatches = subscriptionMetadata.businessAccountId === account.id
        const environmentMatches = !subscriptionMetadata.environment ||
          subscriptionMetadata.environment === environment
        return subscriptionCustomer === customerId && accountMatches && environmentMatches
      })
      .sort((left, right) => {
        const priority = subscriptionPriority(left.status) - subscriptionPriority(right.status)
        if (priority !== 0) return priority
        return (right.created || 0) - (left.created || 0)
      })

    const subscription = subscriptions[0]
    if (!subscription) {
      return NextResponse.json(
        {
          success: false,
          error: 'Stripe Checkout returned, but no matching subscription was found for this account.',
        },
        { status: 409 },
      )
    }

    const subscriptionMetadata = subscription.metadata || {}
    const plan = subscriptionMetadata.plan
    const recurringInterval = subscription.items?.data?.[0]?.price?.recurring?.interval
    const interval = subscriptionMetadata.interval || recurringInterval || null

    if (!isWewedPlanId(plan) || plan === 'free') {
      throw new Error(`Stripe subscription ${subscription.id} has an invalid Wewed plan.`)
    }
    if (!isWewedBillingInterval(interval)) {
      throw new Error(`Stripe subscription ${subscription.id} has an invalid billing interval.`)
    }

    const currentPeriodEnd = integer(subscription.current_period_end) ??
      integer(subscription.items?.data?.[0]?.current_period_end)
    const normalizedStatus = normalizeStatus(subscription.status)
    const cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end)
    const metadataPatch: Record<string, string> = {
      [keys.customerId]: customerId,
      [keys.subscriptionId]: subscription.id,
      [keys.subscriptionPlan]: plan,
      [keys.subscriptionStatus]: normalizedStatus,
      [keys.billingInterval]: interval,
      [keys.cancelAtPeriodEnd]: String(cancelAtPeriodEnd),
      [keys.lastSyncedAt]: new Date().toISOString(),
    }
    if (currentPeriodEnd) {
      metadataPatch[keys.currentPeriodEndsAt] = new Date(currentPeriodEnd * 1000).toISOString()
    }

    await db.$transaction(async (tx) => {
      if (stripeUsesTestMode()) {
        await tx.$executeRawUnsafe(
          `UPDATE public."BusinessAccount"
           SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
             "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1`,
          account.id,
          JSON.stringify(metadataPatch),
        )
      } else {
        await tx.$executeRawUnsafe(
          `UPDATE public."BusinessAccount"
           SET "subscriptionPlan" = $2,
             "subscriptionStatus" = $3,
             "currentPeriodEndsAt" = CASE
               WHEN $4::bigint IS NULL THEN "currentPeriodEndsAt"
               ELSE to_timestamp($4::bigint)
             END,
             metadata = COALESCE(metadata, '{}'::jsonb) || $5::jsonb,
             "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1`,
          account.id,
          plan,
          normalizedStatus,
          currentPeriodEnd,
          JSON.stringify(metadataPatch),
        )
      }

      await tx.$executeRawUnsafe(
        `INSERT INTO public."BusinessAuditLog"
          ("id", "actorUserId", "businessAccountId", "action", "resourceType", "resourceId", "details")
         VALUES ($1, NULL, $2, 'stripe.subscription_reconciled', 'StripeSubscription', $3, $4::jsonb)`,
        `audit-${randomUUID()}`,
        account.id,
        `${environment}:${subscription.id}`,
        JSON.stringify({
          environment,
          customerId,
          subscriptionId: subscription.id,
          plan,
          interval,
          status: normalizedStatus,
          cancelAtPeriodEnd,
          source: 'stripe_api_reconciliation',
          liveLedgerWriteSkipped: stripeUsesTestMode(),
        }),
      )
    })

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        plan,
        interval,
        status: normalizedStatus,
        cancelAtPeriodEnd,
        currentPeriodEndsAt: currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000).toISOString()
          : null,
      },
    })
  } catch (error) {
    console.error('[api/billing/sync] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Unable to synchronize billing with Stripe.',
      },
      { status: 500 },
    )
  }
}
