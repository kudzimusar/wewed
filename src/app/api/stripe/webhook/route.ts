import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  stripeAccountMetadataKeys,
  stripeEnvironment,
  stripeEventResourceId,
  stripeUsesTestMode,
  verifyStripeWebhookSignature,
} from '@/lib/stripe-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StripeObject = Record<string, unknown> & {
  id?: string
  customer?: string | { id?: string } | null
  subscription?: string | { id?: string } | null
  metadata?: Record<string, string>
}

type StripeEvent = {
  id: string
  type: string
  created?: number
  livemode?: boolean
  data: { object: StripeObject }
}

type Transaction = Prisma.TransactionClient

const SUPPORTED_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'charge.refunded',
])

function stringId(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id
  }
  return null
}

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function lock(tx: Transaction, key: string): Promise<void> {
  await tx.$queryRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    key,
  )
}

async function eventAlreadyProcessed(tx: Transaction, eventId: string): Promise<boolean> {
  const resourceId = stripeEventResourceId(eventId)
  const rows = await tx.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
      SELECT 1 FROM public."BusinessAuditLog"
      WHERE "resourceType" = 'StripeEvent'
        AND "resourceId" = $1
        AND action = 'stripe.webhook_processed'
    ) AS exists`,
    resourceId,
  )
  return Boolean(rows[0]?.exists)
}

async function findAccount(tx: Transaction, input: {
  businessAccountId?: string | null
  customerId?: string | null
}) {
  const keys = stripeAccountMetadataKeys()
  const rows = await tx.$queryRawUnsafe<
    Array<{
      id: string
      name: string
      subscriptionPlan: string
      subscriptionStatus: string
    }>
  >(
    `SELECT id, name, "subscriptionPlan", "subscriptionStatus"
     FROM public."BusinessAccount"
     WHERE ($1::text IS NOT NULL AND id = $1)
        OR ($2::text IS NOT NULL AND metadata->>$3 = $2)
     ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    input.businessAccountId ?? null,
    input.customerId ?? null,
    keys.customerId,
  )
  return rows[0] ?? null
}

async function updateSubscriptionAccount(tx: Transaction, input: {
  accountId: string
  plan?: string | null
  status?: string | null
  customerId?: string | null
  subscriptionId?: string | null
  checkoutSessionId?: string | null
  billingInterval?: string | null
  currentPeriodEnd?: number | null
}) {
  const keys = stripeAccountMetadataKeys()
  const metadataPatch: Record<string, string> = {
    [keys.lastSyncedAt]: new Date().toISOString(),
  }
  if (input.customerId) metadataPatch[keys.customerId] = input.customerId
  if (input.subscriptionId) metadataPatch[keys.subscriptionId] = input.subscriptionId
  if (input.checkoutSessionId) metadataPatch[keys.checkoutSessionId] = input.checkoutSessionId
  if (input.billingInterval) metadataPatch[keys.billingInterval] = input.billingInterval
  if (input.plan) metadataPatch[keys.subscriptionPlan] = input.plan
  if (input.status) metadataPatch[keys.subscriptionStatus] = input.status
  if (input.currentPeriodEnd) {
    metadataPatch[keys.currentPeriodEndsAt] = new Date(input.currentPeriodEnd * 1000).toISOString()
  }

  if (stripeUsesTestMode()) {
    await tx.$executeRawUnsafe(
      `UPDATE public."BusinessAccount"
       SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
         "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1`,
      input.accountId,
      JSON.stringify(metadataPatch),
    )
    return
  }

  await tx.$executeRawUnsafe(
    `UPDATE public."BusinessAccount"
     SET "subscriptionPlan" = COALESCE($2, "subscriptionPlan"),
       "subscriptionStatus" = COALESCE($3, "subscriptionStatus"),
       "currentPeriodEndsAt" = CASE
         WHEN $4::bigint IS NULL THEN "currentPeriodEndsAt"
         ELSE to_timestamp($4::bigint)
       END,
       metadata = COALESCE(metadata, '{}'::jsonb) || $5::jsonb,
       "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1`,
    input.accountId,
    input.plan ?? null,
    input.status ?? null,
    input.currentPeriodEnd ?? null,
    JSON.stringify(metadataPatch),
  )
}

function normalizeSubscriptionStatus(status: string | null, eventType: string): string | null {
  if (eventType === 'customer.subscription.deleted') return 'cancelled'
  if (!status) return null
  if (status === 'canceled') return 'cancelled'
  return status
}

async function recordPayment(tx: Transaction, input: {
  accountId: string
  object: StripeObject
  status: 'paid' | 'failed' | 'refunded'
}) {
  // Sandbox events are verified and audited, but never enter the live revenue ledger.
  if (stripeUsesTestMode()) return

  const providerReference = text(input.object.id)
  if (!providerReference) return

  await lock(tx, `stripe-payment:${providerReference}`)

  const currency = (text(input.object.currency) || 'usd').toUpperCase()
  const amount = input.status === 'paid'
    ? integer(input.object.amount_paid) ?? integer(input.object.amount_due) ?? 0
    : input.status === 'refunded'
      ? integer(input.object.amount_refunded) ?? integer(input.object.amount) ?? 0
      : integer(input.object.amount_due) ?? integer(input.object.amount_remaining) ?? 0

  const existing = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM public."PaymentRecord"
     WHERE provider = 'stripe' AND "providerReference" = $1
     LIMIT 1`,
    providerReference,
  )

  if (existing[0]) {
    await tx.$executeRawUnsafe(
      `UPDATE public."PaymentRecord"
       SET "businessAccountId" = $2,
         "amountCents" = $3,
         currency = $4,
         status = $5,
         "paidAt" = CASE WHEN $5 = 'paid' THEN CURRENT_TIMESTAMP ELSE "paidAt" END,
         "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1`,
      existing[0].id,
      input.accountId,
      amount,
      currency,
      input.status,
    )
    return
  }

  await tx.$executeRawUnsafe(
    `INSERT INTO public."PaymentRecord"
      ("id", "businessAccountId", "provider", "providerReference", "type", "amountCents", "currency", "status", "paidAt")
     VALUES ($1, $2, 'stripe', $3, 'subscription', $4, $5, $6,
       CASE WHEN $6 = 'paid' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
    `payment-${randomUUID()}`,
    input.accountId,
    providerReference,
    amount,
    currency,
    input.status,
  )
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  if (!verifyStripeWebhookSignature(rawBody, request.headers.get('stripe-signature'))) {
    return NextResponse.json({ success: false, error: 'Invalid Stripe signature.' }, { status: 400 })
  }

  try {
    const event = JSON.parse(rawBody) as StripeEvent
    if (!event.id || !event.type || !event.data?.object) {
      return NextResponse.json({ success: false, error: 'Invalid Stripe event.' }, { status: 400 })
    }

    const environment = stripeEnvironment()
    const expectedLivemode = environment === 'live'
    if (event.livemode !== expectedLivemode) {
      return NextResponse.json(
        { success: false, error: 'Stripe event environment mismatch.' },
        { status: 400 },
      )
    }

    const result = await db.$transaction(async (tx) => {
      await lock(tx, `stripe-event:${stripeEventResourceId(event.id)}`)
      if (await eventAlreadyProcessed(tx, event.id)) {
        return { duplicate: true }
      }

      const object = event.data.object
      const metadata = object.metadata || {}
      const metadataEnvironment = text(metadata.environment)
      if (metadataEnvironment && metadataEnvironment !== environment) {
        throw new Error(`Stripe event ${event.id} metadata environment mismatch.`)
      }

      const businessAccountId = text(metadata.businessAccountId) || text(object.client_reference_id)
      const customerId = stringId(object.customer)
      const account = await findAccount(tx, { businessAccountId, customerId })
      const supported = SUPPORTED_EVENTS.has(event.type)

      if (supported && !account) {
        throw new Error(`Stripe event ${event.id} could not be matched to a Wewed account.`)
      }

      if (account) {
        if (event.type === 'checkout.session.completed') {
          await updateSubscriptionAccount(tx, {
            accountId: account.id,
            plan: text(metadata.plan),
            customerId,
            subscriptionId: stringId(object.subscription),
            checkoutSessionId: text(object.id),
            billingInterval: text(metadata.interval),
          })
        }

        if (event.type.startsWith('customer.subscription.')) {
          await updateSubscriptionAccount(tx, {
            accountId: account.id,
            plan: text(metadata.plan),
            status: normalizeSubscriptionStatus(text(object.status), event.type),
            customerId,
            subscriptionId: text(object.id),
            billingInterval: text(metadata.interval),
            currentPeriodEnd: integer(object.current_period_end),
          })
        }

        if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
          await recordPayment(tx, { accountId: account.id, object, status: 'paid' })
          await updateSubscriptionAccount(tx, {
            accountId: account.id,
            status: 'active',
            customerId,
            subscriptionId: stringId(object.subscription),
          })
        }

        if (event.type === 'invoice.payment_failed') {
          await recordPayment(tx, { accountId: account.id, object, status: 'failed' })
          await updateSubscriptionAccount(tx, {
            accountId: account.id,
            status: 'past_due',
            customerId,
            subscriptionId: stringId(object.subscription),
          })
        }

        if (event.type === 'charge.refunded') {
          await recordPayment(tx, { accountId: account.id, object, status: 'refunded' })
        }
      }

      await tx.$executeRawUnsafe(
        `INSERT INTO public."BusinessAuditLog"
          ("id", "actorUserId", "businessAccountId", "action", "resourceType", "resourceId", "details")
         VALUES ($1, NULL, $2, 'stripe.webhook_processed', 'StripeEvent', $3, $4::jsonb)
         ON CONFLICT DO NOTHING`,
        `audit-${randomUUID()}`,
        account?.id ?? null,
        stripeEventResourceId(event.id),
        JSON.stringify({
          type: event.type,
          environment,
          stripeObjectId: text(object.id),
          matchedAccount: Boolean(account),
          supported,
          billingInterval: text(metadata.interval),
          sandboxLedgerWriteSkipped: stripeUsesTestMode(),
        }),
      )

      return { duplicate: false }
    })

    return NextResponse.json({ success: true, duplicate: result.duplicate })
  } catch (error) {
    console.error('[api/stripe/webhook] Error:', error)
    return NextResponse.json({ success: false, error: 'Stripe event processing failed.' }, { status: 500 })
  }
}
