import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyStripeWebhookSignature } from '@/lib/stripe-billing'

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
  data: { object: StripeObject }
}

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

async function eventAlreadyProcessed(eventId: string): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
      SELECT 1 FROM public."BusinessAuditLog"
      WHERE "resourceType" = 'StripeEvent' AND "resourceId" = $1
    ) AS exists`,
    eventId,
  )
  return Boolean(rows[0]?.exists)
}

async function findAccount(input: {
  businessAccountId?: string | null
  customerId?: string | null
}) {
  const rows = await db.$queryRawUnsafe<
    Array<{
      id: string
      name: string
      metadata: Record<string, unknown>
      subscriptionPlan: string
      subscriptionStatus: string
    }>
  >(
    `SELECT id, name, metadata, "subscriptionPlan", "subscriptionStatus"
     FROM public."BusinessAccount"
     WHERE ($1::text IS NOT NULL AND id = $1)
        OR ($2::text IS NOT NULL AND metadata->>'stripeCustomerId' = $2)
     ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
     LIMIT 1`,
    input.businessAccountId ?? null,
    input.customerId ?? null,
  )
  return rows[0] ?? null
}

async function updateSubscriptionAccount(input: {
  accountId: string
  metadata: Record<string, unknown>
  plan?: string | null
  status?: string | null
  customerId?: string | null
  subscriptionId?: string | null
  checkoutSessionId?: string | null
  currentPeriodEnd?: number | null
}) {
  const nextMetadata = {
    ...input.metadata,
    ...(input.customerId ? { stripeCustomerId: input.customerId } : {}),
    ...(input.subscriptionId ? { stripeSubscriptionId: input.subscriptionId } : {}),
    ...(input.checkoutSessionId ? { stripeCheckoutSessionId: input.checkoutSessionId } : {}),
    stripeLastSyncedAt: new Date().toISOString(),
  }

  await db.$executeRawUnsafe(
    `UPDATE public."BusinessAccount"
     SET "subscriptionPlan" = COALESCE($2, "subscriptionPlan"),
       "subscriptionStatus" = COALESCE($3, "subscriptionStatus"),
       "currentPeriodEndsAt" = CASE
         WHEN $4::bigint IS NULL THEN "currentPeriodEndsAt"
         ELSE to_timestamp($4::bigint)
       END,
       metadata = $5::jsonb,
       "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1`,
    input.accountId,
    input.plan ?? null,
    input.status ?? null,
    input.currentPeriodEnd ?? null,
    JSON.stringify(nextMetadata),
  )
}

function normalizeSubscriptionStatus(status: string | null, eventType: string): string | null {
  if (eventType === 'customer.subscription.deleted') return 'cancelled'
  if (!status) return null
  if (status === 'trialing') return 'trialing'
  if (status === 'active') return 'active'
  if (['past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'].includes(status)) return status
  if (status === 'canceled') return 'cancelled'
  return status
}

async function recordInvoice(input: {
  accountId: string
  object: StripeObject
  status: 'paid' | 'failed' | 'refunded'
}) {
  const invoiceId = text(input.object.id)
  if (!invoiceId) return
  const currency = (text(input.object.currency) || 'usd').toUpperCase()
  const amount = input.status === 'paid'
    ? integer(input.object.amount_paid) ?? integer(input.object.amount_due) ?? 0
    : input.status === 'refunded'
      ? integer(input.object.amount_refunded) ?? integer(input.object.amount) ?? 0
      : integer(input.object.amount_due) ?? integer(input.object.amount_remaining) ?? 0

  await db.$executeRawUnsafe(
    `INSERT INTO public."PaymentRecord"
      ("id", "businessAccountId", "provider", "providerReference", "type", "amountCents", "currency", "status", "paidAt")
     SELECT $1, $2, 'stripe', $3, 'subscription', $4, $5, $6,
       CASE WHEN $6 = 'paid' THEN CURRENT_TIMESTAMP ELSE NULL END
     WHERE NOT EXISTS (
       SELECT 1 FROM public."PaymentRecord"
       WHERE provider = 'stripe' AND "providerReference" = $3
     )`,
    `payment-${randomUUID()}`,
    input.accountId,
    invoiceId,
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
    if (await eventAlreadyProcessed(event.id)) {
      return NextResponse.json({ success: true, duplicate: true })
    }

    const object = event.data.object
    const metadata = object.metadata || {}
    const businessAccountId = text(metadata.businessAccountId) || text(object.client_reference_id)
    const customerId = stringId(object.customer)
    const account = await findAccount({ businessAccountId, customerId })

    if (account) {
      if (event.type === 'checkout.session.completed') {
        const plan = text(metadata.plan)
        await updateSubscriptionAccount({
          accountId: account.id,
          metadata: account.metadata,
          plan,
          status: text(object.status) === 'complete' ? 'active' : account.subscriptionStatus,
          customerId,
          subscriptionId: stringId(object.subscription),
          checkoutSessionId: text(object.id),
        })
      }

      if (event.type.startsWith('customer.subscription.')) {
        await updateSubscriptionAccount({
          accountId: account.id,
          metadata: account.metadata,
          plan: text(metadata.plan),
          status: normalizeSubscriptionStatus(text(object.status), event.type),
          customerId,
          subscriptionId: text(object.id),
          currentPeriodEnd: integer(object.current_period_end),
        })
      }

      if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
        await recordInvoice({ accountId: account.id, object, status: 'paid' })
        await updateSubscriptionAccount({
          accountId: account.id,
          metadata: account.metadata,
          status: 'active',
          customerId,
          subscriptionId: stringId(object.subscription),
        })
      }

      if (event.type === 'invoice.payment_failed') {
        await recordInvoice({ accountId: account.id, object, status: 'failed' })
        await updateSubscriptionAccount({
          accountId: account.id,
          metadata: account.metadata,
          status: 'past_due',
          customerId,
          subscriptionId: stringId(object.subscription),
        })
      }

      if (event.type === 'charge.refunded') {
        await recordInvoice({ accountId: account.id, object, status: 'refunded' })
      }
    }

    await db.$executeRawUnsafe(
      `INSERT INTO public."BusinessAuditLog"
        ("id", "actorUserId", "businessAccountId", "action", "resourceType", "resourceId", "details")
       VALUES ($1, NULL, $2, 'stripe.webhook_processed', 'StripeEvent', $3, $4::jsonb)`,
      `audit-${randomUUID()}`,
      account?.id ?? null,
      event.id,
      JSON.stringify({ type: event.type, stripeObjectId: text(object.id), matchedAccount: Boolean(account) }),
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[api/stripe/webhook] Error:', error)
    return NextResponse.json({ success: false, error: 'Stripe event processing failed.' }, { status: 500 })
  }
}
