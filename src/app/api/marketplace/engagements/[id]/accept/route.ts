import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  MarketplaceAccessError,
  marketplaceId,
  requirePlannerMarketplace,
} from '@/lib/marketplace-access'
import { marketplaceErrorResponse } from '@/lib/marketplace-response'

export async function POST(
  request: NextRequest,
  contextParams: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await contextParams.params
    const context = await requirePlannerMarketplace(request)
    const auditId = marketplaceId('audit')

    await db.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{ id: string; status: string; weddingId: string }>>(
        `SELECT id, status, "weddingId"
         FROM wewed_admin."PlannerEngagement"
         WHERE id = $1 AND "plannerBusinessAccountId" = $2
         FOR UPDATE`,
        id,
        context.business.businessAccountId,
      )
      const engagement = rows[0]
      if (!engagement) throw new MarketplaceAccessError('Appointment request not found.', 404)
      if (engagement.status !== 'requested') {
        throw new MarketplaceAccessError('Appointment is not waiting for planner acceptance.', 409)
      }

      await tx.$executeRawUnsafe(
        `UPDATE wewed_admin."PlannerEngagement"
         SET status = 'planner_accepted', "plannerUserId" = $2,
             "acceptedByUserId" = $2, "acceptedAt" = CURRENT_TIMESTAMP,
             version = version + 1, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        id,
        context.user.id,
      )
      await tx.$executeRawUnsafe(
        `INSERT INTO wewed_admin."BusinessAuditLog"
          (id, "actorUserId", "businessAccountId", action, "resourceType", "resourceId", details)
         VALUES ($1, $2, $3, 'planner_engagement.planner_accepted', 'planner_engagement', $4, $5::jsonb)`,
        auditId,
        context.user.id,
        context.business.businessAccountId,
        id,
        JSON.stringify({ weddingId: engagement.weddingId }),
      )
    })

    return NextResponse.json({ success: true, status: 'planner_accepted' })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}
