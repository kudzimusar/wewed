import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { db } from '@/lib/db'
import { businessMemberCanManageBilling } from '@/lib/business-access'
import { publicOrigin } from '@/lib/public-origin'
import {
  createStripeCheckoutSession,
  createStripeCustomer,
  createStripePortalSession,
  stripeAccountMetadataKeys,
  stripeBillingConfiguration,
  stripePriceIdForOffer,
  stripeUsesTestMode,
} from '@/lib/stripe-billing'
import {
  BILLING_OFFER_BY_CODE,
  billingOffersForAccountType,
  defaultBillingOfferCode,
  isWewedBillableAccountType,
  isWewedBillingInterval,
  resolveBillingOfferCode,
  type WewedBillingInterval,
} from '@/lib/wewed-plans'

export const dynamic = 'force-dynamic'

interface BillingAccountRow {
  id: string
  name: string
  type: string
  status: string
  onboardingStatus: string
  subscriptionPlan: string
  subscriptionStatus: string
  currentPeriodEndsAt: Date | null
  metadata: Record<string, unknown>
  memberRole: string
  memberStatus: string
  memberPermissions: unknown
  billingOfferCode: string | null
  billingProfileInterval: string | null
  billingProfileStatus: string | null
  billingProfileSource: string | null
}

type AccountDepartmentRow = {
  departmentKey: string
  name: string
  description: string
  systemKey: string
  dataPoints: unknown
  resourceTools: unknown
  status: string
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function metadataText(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function metadataBoolean(
  metadata: Record<string, unknown>,
  key: string,
): boolean {
  const value = metadata[key]
  return value === true || value === 'true'
}

function metadataDate(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadataText(metadata, key)
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

async function resolveBillingAccount(request: NextRequest): Promise<{
  session: NonNullable<ReturnType<typeof readAppSession>>
  account: BillingAccountRow
} | null> {
  const session = readAppSession(request)
  if (!session) return null

  const rows = await db.$queryRawUnsafe<BillingAccountRow[]>(
    `SELECT ba.id, ba.name, ba.type, ba.status, ba."onboardingStatus",
      ba."subscriptionPlan", ba."subscriptionStatus", ba."currentPeriodEndsAt",
      ba.metadata, bam.role AS "memberRole", bam.status AS "memberStatus",
      bam.permissions AS "memberPermissions",
      billing."offerCode" AS "billingOfferCode",
      billing.interval AS "billingProfileInterval",
      billing.status AS "billingProfileStatus",
      billing.source AS "billingProfileSource"
     FROM wewed_admin."BusinessAccountMember" bam
     JOIN wewed_admin."BusinessAccount" ba ON ba.id = bam."businessAccountId"
     LEFT JOIN wewed_admin."BusinessAccountBillingProfile" billing
       ON billing."businessAccountId" = ba.id
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

  return rows[0] ? { session, account: rows[0] } : null
}

async function listAccountDepartments(
  businessAccountId: string,
): Promise<AccountDepartmentRow[]> {
  return db.$queryRawUnsafe<AccountDepartmentRow[]>(
    `SELECT assignment."departmentKey", definition.name,
       definition.description, definition."systemKey",
       definition."dataPoints", definition."resourceTools", assignment.status
     FROM wewed_admin."BusinessAccountDepartment" assignment
     JOIN wewed_admin."ClientDepartmentDefinition" definition
       ON definition."departmentKey" = assignment."departmentKey"
      AND definition."accountType" = assignment."accountType"
     WHERE assignment."businessAccountId" = $1
       AND definition.status = 'active'
     ORDER BY definition."sortOrder", definition.name`,
    businessAccountId,
  )
}

function billingAccessError(
  resolved: Awaited<ReturnType<typeof resolveBillingAccount>>,
) {
  if (!resolved) {
    return NextResponse.json(
      { success: false, error: 'An active business membership is required.' },
      { status: 401 },
    )
  }

  if (
    !businessMemberCanManageBilling(
      resolved.account.memberRole,
      resolved.account.memberPermissions,
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        error: 'Only a business owner or billing manager may manage billing.',
      },
      { status: 403 },
    )
  }

  if (
    resolved.account.status !== 'active' ||
    resolved.account.onboardingStatus !== 'complete'
  ) {
    return NextResponse.json(
      {
        success: false,
        error: 'Complete account approval and onboarding before managing billing.',
      },
      { status: 403 },
    )
  }

  if (!isWewedBillableAccountType(resolved.account.type)) {
    return NextResponse.json(
      { success: false, error: 'This account type is not eligible for billing.' },
      { status: 403 },
    )
  }

  return null
}

export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveBillingAccount(request)
    const accessError = billingAccessError(resolved)
    if (accessError) return accessError
    if (!resolved) throw new Error('Billing account resolution failed.')

    const metadata = objectValue(resolved.account.metadata)
    const keys = stripeAccountMetadataKeys()
    const testMode = stripeUsesTestMode()
    const metadataInterval = metadataText(metadata, keys.billingInterval)
    const offerCode =
      resolveBillingOfferCode({
        accountType: resolved.account.type,
        offerCode:
          (testMode ? metadataText(metadata, keys.billingOfferCode) : null) ||
          resolved.account.billingOfferCode,
        legacyPlan: testMode
          ? metadataText(metadata, keys.subscriptionPlan) || 'free'
          : resolved.account.subscriptionPlan,
      }) || defaultBillingOfferCode(resolved.account.type)

    if (!offerCode) {
      throw new Error('No valid billing offer exists for this account type.')
    }

    const departments = await listAccountDepartments(resolved.account.id)
    const currentOffer = BILLING_OFFER_BY_CODE[offerCode]
    const eligibleOffers = billingOffersForAccountType(resolved.account.type)

    return NextResponse.json({
      success: true,
      account: {
        id: resolved.account.id,
        name: resolved.account.name,
        type: resolved.account.type,
        status: resolved.account.status,
        onboardingStatus: resolved.account.onboardingStatus,
        billingOfferCode: offerCode,
        billingOfferName: currentOffer.publicName,
        billingModel: currentOffer.billingModel,
        subscriptionPlan: currentOffer.legacyPlan,
        subscriptionStatus: testMode
          ? metadataText(metadata, keys.subscriptionStatus) ||
            resolved.account.billingProfileStatus ||
            'inactive'
          : resolved.account.billingProfileStatus ||
            resolved.account.subscriptionStatus,
        currentPeriodEndsAt: testMode
          ? metadataDate(metadata, keys.currentPeriodEndsAt)
          : resolved.account.currentPeriodEndsAt?.toISOString() ?? null,
        cancelAtPeriodEnd: metadataBoolean(metadata, keys.cancelAtPeriodEnd),
        memberRole: resolved.account.memberRole,
        stripeCustomerId: metadataText(metadata, keys.customerId),
        billingInterval: isWewedBillingInterval(
          (testMode ? metadataInterval : null) ||
            resolved.account.billingProfileInterval,
        )
          ? (((testMode ? metadataInterval : null) ||
              resolved.account.billingProfileInterval) as WewedBillingInterval)
          : null,
        billingProfileSource: resolved.account.billingProfileSource,
      },
      departments,
      offers: eligibleOffers,
      stripe: stripeBillingConfiguration(resolved.account.type),
    })
  } catch (error) {
    console.error('[api/billing/account] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to load billing.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const resolved = await resolveBillingAccount(request)
    const accessError = billingAccessError(resolved)
    if (accessError) return accessError
    if (!resolved || !isWewedBillableAccountType(resolved.account.type)) {
      throw new Error('Billing account resolution failed.')
    }

    const body = (await request.json()) as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action.trim() : ''
    const metadata = objectValue(resolved.account.metadata)
    const keys = stripeAccountMetadataKeys()
    let stripeCustomerId = metadataText(metadata, keys.customerId)

    if (action === 'checkout') {
      const offerCode = resolveBillingOfferCode({
        accountType: resolved.account.type,
        offerCode: body.offerCode,
        legacyPlan: body.plan,
      })
      const intervalValue =
        typeof body.interval === 'string' ? body.interval.trim() : 'month'

      if (!offerCode) {
        return NextResponse.json(
          {
            success: false,
            error: 'Select a billing offer valid for this account category.',
          },
          { status: 400 },
        )
      }
      if (!isWewedBillingInterval(intervalValue)) {
        return NextResponse.json(
          { success: false, error: 'A valid billing interval is required.' },
          { status: 400 },
        )
      }

      const offer = BILLING_OFFER_BY_CODE[offerCode]
      if (!offer.selfService || offer.billingModel !== 'subscription') {
        return NextResponse.json(
          {
            success: false,
            error: `${offer.publicName} requires contract or internal onboarding.`,
          },
          { status: 409 },
        )
      }
      if (!stripePriceIdForOffer(offerCode, intervalValue)) {
        return NextResponse.json(
          {
            success: false,
            error: `Stripe pricing for ${offer.publicName} (${intervalValue}) has not been configured.`,
          },
          { status: 503 },
        )
      }

      if (!stripeCustomerId) {
        const customer = await createStripeCustomer({
          businessAccountId: resolved.account.id,
          email: resolved.session.email,
          name: resolved.account.name,
          accountType: resolved.account.type,
        })
        stripeCustomerId = customer.id
        await db.$executeRawUnsafe(
          `UPDATE wewed_admin."BusinessAccount"
           SET metadata = COALESCE(metadata, '{}'::jsonb)
             || jsonb_build_object($2::text, $3::text),
             "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1`,
          resolved.account.id,
          keys.customerId,
          stripeCustomerId,
        )
      }

      const checkout = await createStripeCheckoutSession({
        origin: publicOrigin(),
        businessAccountId: resolved.account.id,
        customerId: stripeCustomerId,
        accountType: resolved.account.type,
        offerCode,
        interval: intervalValue,
      })

      return NextResponse.json({ success: true, url: checkout.url })
    }

    if (action === 'portal') {
      if (!stripeCustomerId) {
        return NextResponse.json(
          {
            success: false,
            error: 'No Stripe customer exists for this account yet.',
          },
          { status: 409 },
        )
      }
      const portal = await createStripePortalSession({
        origin: publicOrigin(),
        customerId: stripeCustomerId,
      })
      return NextResponse.json({ success: true, url: portal.url })
    }

    return NextResponse.json(
      { success: false, error: 'Unknown billing action.' },
      { status: 400 },
    )
  } catch (error) {
    console.error('[api/billing/account] POST error:', error)
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unable to start billing.',
      },
      { status: 500 },
    )
  }
}
