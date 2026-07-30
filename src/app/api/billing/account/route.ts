import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { db } from '@/lib/db'
import {
  createStripeCheckoutSession,
  createStripeCustomer,
  createStripePortalSession,
  stripeBillingConfiguration,
  stripePriceIdForPlan,
  type StripePlan,
} from '@/lib/stripe-billing'

export const dynamic = 'force-dynamic'

interface BillingAccountRow {
  id: string
  name: string
  type: string
  status: string
  subscriptionPlan: string
  subscriptionStatus: string
  currentPeriodEndsAt: Date | null
  metadata: Record<string, unknown>
  memberRole: string
  memberStatus: string
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

async function resolveBillingAccount(request: NextRequest): Promise<{
  session: NonNullable<ReturnType<typeof readAppSession>>
  account: BillingAccountRow
} | null> {
  const session = readAppSession(request)
  if (!session) return null

  const rows = await db.$queryRawUnsafe<BillingAccountRow[]>(
    `SELECT ba.id, ba.name, ba.type, ba.status,
      ba."subscriptionPlan", ba."subscriptionStatus", ba."currentPeriodEndsAt",
      ba.metadata, bam.role AS "memberRole", bam.status AS "memberStatus"
     FROM public."BusinessAccountMember" bam
     JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId"
     WHERE bam."userId" = $1
       AND bam.status = 'active'
       AND ba.type <> 'wewed_internal'
     ORDER BY CASE WHEN ba.status = 'active' THEN 0 ELSE 1 END, ba."updatedAt" DESC
     LIMIT 1`,
    session.userId,
  )

  return rows[0] ? { session, account: rows[0] } : null
}

export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveBillingAccount(request)
    if (!resolved) {
      return NextResponse.json(
        { success: false, error: 'An active business membership is required.' },
        { status: 401 },
      )
    }

    const metadata = objectValue(resolved.account.metadata)
    return NextResponse.json({
      success: true,
      account: {
        id: resolved.account.id,
        name: resolved.account.name,
        type: resolved.account.type,
        status: resolved.account.status,
        subscriptionPlan: resolved.account.subscriptionPlan,
        subscriptionStatus: resolved.account.subscriptionStatus,
        currentPeriodEndsAt: resolved.account.currentPeriodEndsAt?.toISOString() ?? null,
        memberRole: resolved.account.memberRole,
        stripeCustomerId: typeof metadata.stripeCustomerId === 'string' ? metadata.stripeCustomerId : null,
      },
      stripe: stripeBillingConfiguration(),
    })
  } catch (error) {
    console.error('[api/billing/account] GET error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load billing.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const resolved = await resolveBillingAccount(request)
    if (!resolved) {
      return NextResponse.json(
        { success: false, error: 'An active business membership is required.' },
        { status: 401 },
      )
    }
    if (resolved.account.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'This business account is not active for billing.' },
        { status: 403 },
      )
    }

    const body = (await request.json()) as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action.trim() : ''
    const metadata = objectValue(resolved.account.metadata)
    let stripeCustomerId = typeof metadata.stripeCustomerId === 'string'
      ? metadata.stripeCustomerId
      : null

    if (action === 'checkout') {
      const plan = typeof body.plan === 'string' ? body.plan.trim() as StripePlan : 'starter'
      if (!['starter', 'professional', 'enterprise'].includes(plan)) {
        return NextResponse.json({ success: false, error: 'A valid paid plan is required.' }, { status: 400 })
      }
      if (!stripePriceIdForPlan(plan)) {
        return NextResponse.json(
          { success: false, error: `Stripe pricing for ${plan} has not been configured.` },
          { status: 503 },
        )
      }

      if (!stripeCustomerId) {
        const customer = await createStripeCustomer({
          businessAccountId: resolved.account.id,
          email: resolved.session.email,
          name: resolved.account.name,
        })
        stripeCustomerId = customer.id
        await db.$executeRawUnsafe(
          `UPDATE public."BusinessAccount"
           SET metadata = $2::jsonb, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1`,
          resolved.account.id,
          JSON.stringify({ ...metadata, stripeCustomerId }),
        )
      }

      const checkout = await createStripeCheckoutSession({
        origin: request.nextUrl.origin,
        businessAccountId: resolved.account.id,
        customerId: stripeCustomerId,
        plan,
      })

      return NextResponse.json({ success: true, url: checkout.url })
    }

    if (action === 'portal') {
      if (!stripeCustomerId) {
        return NextResponse.json(
          { success: false, error: 'No Stripe customer exists for this account yet.' },
          { status: 409 },
        )
      }
      const portal = await createStripePortalSession({
        origin: request.nextUrl.origin,
        customerId: stripeCustomerId,
      })
      return NextResponse.json({ success: true, url: portal.url })
    }

    return NextResponse.json({ success: false, error: 'Unknown billing action.' }, { status: 400 })
  } catch (error) {
    console.error('[api/billing/account] POST error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unable to start billing.' },
      { status: 500 },
    )
  }
}
