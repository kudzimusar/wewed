import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  MarketplaceAccessError,
  marketplaceId,
  requireCoupleMarketplace,
} from '@/lib/marketplace-access'
import { marketplaceErrorResponse } from '@/lib/marketplace-response'

export async function POST(
  request: NextRequest,
  contextParams: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await contextParams.params
    const context = await requireCoupleMarketplace(request)
    const engagementId = marketplaceId('planner-engagement')
    const auditId = marketplaceId('audit')

    const result = await db.$transaction(async (tx) => {
      const enquiries = await tx.$queryRawUnsafe<
        Array<{
          id: string
          weddingId: string
          coupleBusinessAccountId: string
          plannerBusinessAccountId: string
          status: string
        }>
      >(
        `SELECT id, "weddingId", "coupleBusinessAccountId", "plannerBusinessAccountId", status
         FROM wewed_admin."PlannerEnquiry"
         WHERE id = $1 FOR UPDATE`,
        id,
      )
      const enquiry = enquiries[0]
      if (!enquiry || enquiry.weddingId !== context.weddingId || enquiry.coupleBusinessAccountId !== context.coupleBusinessAccountId) {
        throw new MarketplaceAccessError('Enquiry not found for the active wedding.', 404)
      }
      if (enquiry.status !== 'accepted_interest') {
        throw new MarketplaceAccessError('The planner must accept interest before appointment.', 409)
      }

      const inserted = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `INSERT INTO wewed_admin."PlannerEngagement" (
           id, "enquiryId", "weddingId", "coupleBusinessAccountId",
           "plannerBusinessAccountId", status, "requestedByUserId"
         ) VALUES ($1, $2, $3, $4, $5, 'requested', $6)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        engagementId,
        enquiry.id,
        enquiry.weddingId,
        enquiry.coupleBusinessAccountId,
        enquiry.plannerBusinessAccountId,
        context.user.id,
      )
      if (!inserted[0]) {
        throw new MarketplaceAccessError(
          'This wedding already has a current planner appointment or this enquiry was already appointed.',
          409,
        )
      }

      await tx.$executeRawUnsafe(
        `UPDATE wewed_admin."PlannerEnquiry"
         SET status = 'appointed', version = version + 1, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        enquiry.id,
      )
      await tx.$executeRawUnsafe(
        `INSERT INTO wewed_admin."BusinessAuditLog"
          (id, "actorUserId", "businessAccountId", action, "resourceType", "resourceId", details)
         VALUES ($1, $2, $3, 'planner_engagement.requested', 'planner_engagement', $4, $5::jsonb)`,
        auditId,
        context.user.id,
        context.coupleBusinessAccountId,
        inserted[0].id,
        JSON.stringify({ enquiryId: enquiry.id, weddingId: context.weddingId }),
      )
      return inserted[0].id
    })

    return NextResponse.json({ success: true, engagementId: result, status: 'requested' }, { status: 201 })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}
