import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  MarketplaceAccessError,
  marketplaceId,
  requirePlannerMarketplace,
  text,
} from '@/lib/marketplace-access'
import { marketplaceErrorResponse } from '@/lib/marketplace-response'

export async function POST(
  request: NextRequest,
  contextParams: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await contextParams.params
    const context = await requirePlannerMarketplace(request)
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const decision = body?.decision === 'decline' ? 'decline' : 'accept'
    const auditId = marketplaceId('audit')

    const status = await db.$transaction(async (tx) => {
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
        throw new MarketplaceAccessError('Appointment is not waiting for a planner decision.', 409)
      }

      if (decision === 'decline') {
        await tx.$executeRawUnsafe(
          `UPDATE wewed_admin."PlannerEngagement"
           SET status = 'cancelled', "endedByUserId" = $2, "endReason" = $3,
               version = version + 1, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1`,
          id,
          context.user.id,
          text(body?.reason, 500) ?? 'Declined by planner',
        )
        await tx.$executeRawUnsafe(
          `INSERT INTO wewed_admin."BusinessAuditLog"
            (id, "actorUserId", "businessAccountId", action, "resourceType", "resourceId", details)
           VALUES ($1, $2, $3, 'planner_engagement.planner_declined', 'planner_engagement', $4, $5::jsonb)`,
          auditId,
          context.user.id,
          context.business.businessAccountId,
          id,
          JSON.stringify({ weddingId: engagement.weddingId }),
        )
        return 'cancelled'
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
      return 'planner_accepted'
    })

    return NextResponse.json({ success: true, status })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}
