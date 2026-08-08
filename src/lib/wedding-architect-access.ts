import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission, type WeddingContext } from '@/lib/wedding-access'
import {
  WEDDING_ARCHITECT_PLANNER_ENTITLEMENT,
  resolveWeddingArchitectEntitlement,
} from '@/lib/wedding-architect-entitlement'

interface PlannerBillingRow {
  accountType: string
  accountStatus: string
  offerCode: string | null
  profileStatus: string | null
  currentPeriodEndsAt: Date | null
  billingModel: string | null
  offerStatus: string | null
  entitlements: unknown
}

function plannerBillingRowIsEntitled(row: PlannerBillingRow): boolean {
  return resolveWeddingArchitectEntitlement({
    accountType: row.accountType,
    accountStatus: row.accountStatus,
    billingProfile: row.offerCode && row.profileStatus ? {
      accountType: row.accountType,
      offerCode: row.offerCode,
      status: row.profileStatus,
      currentPeriodEndsAt: row.currentPeriodEndsAt,
    } : null,
    billingOffer: row.offerCode && row.billingModel && row.offerStatus ? {
      offerCode: row.offerCode,
      accountType: row.accountType,
      billingModel: row.billingModel,
      status: row.offerStatus,
      entitlements: row.entitlements,
    } : null,
    entitlement: WEDDING_ARCHITECT_PLANNER_ENTITLEMENT,
    requirePaid: true,
  }).entitled
}

async function plannerHasArchitectAccess(userId: string): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<PlannerBillingRow[]>(
    `SELECT ba.type AS "accountType", ba.status AS "accountStatus",
            bp."offerCode", bp.status AS "profileStatus", bp."currentPeriodEndsAt",
            bo."billingModel", bo.status AS "offerStatus", bo.entitlements
     FROM wewed_admin."BusinessAccountMember" bam
     JOIN wewed_admin."BusinessAccount" ba ON ba.id=bam."businessAccountId"
     LEFT JOIN wewed_admin."BusinessAccountBillingProfile" bp ON bp."businessAccountId"=ba.id
     LEFT JOIN wewed_admin."BillingOffer" bo ON bo."offerCode"=bp."offerCode" AND bo."accountType"=bp."accountType"
     WHERE bam."userId"=$1 AND bam.status='active' AND ba.type='planning_company'
       AND ba.status='active' AND ba."onboardingStatus"='complete'
     ORDER BY CASE bam.role WHEN 'business_owner' THEN 0 ELSE 1 END, ba.id`,
    userId,
  )

  // Entitlement belongs to the planning company, not to an arbitrary first
  // membership row. A planner may operate across multiple active companies.
  return rows.some(plannerBillingRowIsEntitled)
}

export async function requireWeddingArchitectPlanningAccess(request: NextRequest): Promise<
  | { context: WeddingContext; error: null }
  | { context: null; error: NextResponse }
> {
  const access = await requireWeddingPermission(request, 'planner.view')
  if (access.error) return access
  const role = access.context.session.role

  if (role === 'couple') return access
  if (role === 'planner') {
    if (await plannerHasArchitectAccess(access.context.session.userId)) return access
    return {
      context: null,
      error: NextResponse.json({
        success: false,
        code: 'WEDDING_ARCHITECT_SUBSCRIPTION_REQUIRED',
        error: 'Wedding Architect planning for professionals requires an active Planner Professional entitlement.',
      }, { status: 403 }),
    }
  }

  return {
    context: null,
    error: NextResponse.json({
      success: false,
      error: 'Wedding Architect plan generation is available to couples and entitled planners.',
    }, { status: 403 }),
  }
}
