import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  MarketplaceAccessError,
  marketplaceAudit,
  requireCoupleMarketplace,
  requireMarketplaceUser,
  requirePlannerMarketplace,
  text,
} from '@/lib/marketplace-access'
import { marketplaceErrorResponse } from '@/lib/marketplace-response'

const PLANNER_TRANSITIONS = new Set(['responded', 'consultation_requested', 'accepted_interest', 'declined'])
const PLANNER_ACTIONABLE_STATUSES = new Set(['submitted', 'viewed', 'responded', 'consultation_requested'])
const PLANNER_DECISION_STATUSES = new Set(['accepted_interest', 'declined'])

export async function PATCH(
  request: NextRequest,
  contextParams: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await contextParams.params
    const base = await requireMarketplaceUser(request, ['couple', 'planner'])
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) throw new MarketplaceAccessError('Invalid enquiry update.', 400)

    if (base.session.role === 'planner') {
      const context = await requirePlannerMarketplace(request)
      const nextStatus = typeof body.status === 'string' ? body.status : ''
      if (!PLANNER_TRANSITIONS.has(nextStatus)) {
        throw new MarketplaceAccessError('Unsupported planner enquiry transition.', 400)
      }

      const existing = await db.$queryRawUnsafe<Array<{ status: string }>>(
        `SELECT status
         FROM wewed_admin."PlannerEnquiry"
         WHERE id = $1
           AND "plannerBusinessAccountId" = $2
         LIMIT 1`,
        id,
        context.business.businessAccountId,
      )
      const currentStatus = existing[0]?.status
      if (!currentStatus) {
        throw new MarketplaceAccessError('Enquiry was not found.', 404)
      }

      // Exact retries of a completed planner decision are intentionally idempotent.
      // This protects mobile double taps / network retries without reopening the enquiry.
      if (PLANNER_DECISION_STATUSES.has(currentStatus)) {
        if (currentStatus === nextStatus) {
          return NextResponse.json({ success: true, status: currentStatus, idempotent: true })
        }
        throw new MarketplaceAccessError('This enquiry decision is already closed.', 409)
      }

      if (!PLANNER_ACTIONABLE_STATUSES.has(currentStatus)) {
        throw new MarketplaceAccessError('Enquiry is no longer actionable.', 409)
      }

      const rows = await db.$queryRawUnsafe<Array<{ status: string; coupleBusinessAccountId: string }>>(
        `UPDATE wewed_admin."PlannerEnquiry"
         SET status = $3,
             "plannerResponse" = $4,
             "respondedByUserId" = $2,
             "respondedAt" = CURRENT_TIMESTAMP,
             version = version + 1,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1
           AND "plannerBusinessAccountId" = $5
           AND status = $6
         RETURNING status, "coupleBusinessAccountId"`,
        id,
        context.user.id,
        nextStatus,
        text(body.response, 3000),
        context.business.businessAccountId,
        currentStatus,
      )
      if (!rows[0]) {
        throw new MarketplaceAccessError('Enquiry changed while this action was being saved. Refresh and try again.', 409)
      }
      await marketplaceAudit({
        actorUserId: context.user.id,
        businessAccountId: context.business.businessAccountId,
        action: `planner_enquiry.${nextStatus}`,
        resourceType: 'planner_enquiry',
        resourceId: id,
      })
      return NextResponse.json({ success: true, status: nextStatus })
    }

    const context = await requireCoupleMarketplace(request)
    if (body.status !== 'withdrawn') throw new MarketplaceAccessError('Couples may only withdraw an enquiry.', 400)
    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `UPDATE wewed_admin."PlannerEnquiry"
       SET status = 'withdrawn', "withdrawnAt" = CURRENT_TIMESTAMP,
           version = version + 1, "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1 AND "weddingId" = $2 AND "createdByUserId" = $3
         AND status NOT IN ('appointed','withdrawn','closed')
       RETURNING id`,
      id,
      context.weddingId,
      context.user.id,
    )
    if (!rows[0]) throw new MarketplaceAccessError('Enquiry was not found or cannot be withdrawn.', 409)
    await marketplaceAudit({
      actorUserId: context.user.id,
      businessAccountId: context.coupleBusinessAccountId,
      action: 'planner_enquiry.withdrawn',
      resourceType: 'planner_enquiry',
      resourceId: id,
    })
    return NextResponse.json({ success: true, status: 'withdrawn' })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}
