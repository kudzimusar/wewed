import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  MarketplaceAccessError,
  marketplaceAudit,
  requirePlannerMarketplace,
  stringList,
} from '@/lib/marketplace-access'
import { marketplaceErrorResponse } from '@/lib/marketplace-response'

export async function POST(request: NextRequest) {
  try {
    const context = await requirePlannerMarketplace(request)
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM public."PlannerProfile" WHERE "businessAccountId" = $1 LIMIT 1`,
      context.business.businessAccountId,
    )
    const profile = rows[0]
    if (!profile) throw new MarketplaceAccessError('Create the planner profile before submitting it.', 409)
    if (!['draft', 'changes_requested', 'rejected'].includes(String(profile.status))) {
      throw new MarketplaceAccessError('This profile cannot be submitted from its current state.', 409)
    }
    if (
      !String(profile.displayName ?? '').trim() ||
      !String(profile.bio ?? '').trim() ||
      stringList(profile.serviceAreas).length === 0 ||
      stringList(profile.services).length === 0
    ) {
      throw new MarketplaceAccessError(
        'Display name, biography, service area and at least one service are required.',
        400,
      )
    }

    await db.$executeRawUnsafe(
      `UPDATE wewed_admin."PlannerProfile"
       SET status = 'submitted', "submittedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1`,
      profile.id,
    )
    await marketplaceAudit({
      actorUserId: context.user.id,
      businessAccountId: context.business.businessAccountId,
      action: 'planner_profile.submitted',
      resourceType: 'planner_profile',
      resourceId: String(profile.id),
    })
    return NextResponse.json({ success: true, status: 'submitted' })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}
