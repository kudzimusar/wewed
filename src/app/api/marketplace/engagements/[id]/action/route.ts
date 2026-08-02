import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  AUTHORITY_BUNDLES,
  MarketplaceAccessError,
  isAuthorityBundle,
  marketplaceId,
  requireCoupleMarketplace,
  text,
} from '@/lib/marketplace-access'
import { marketplaceErrorResponse } from '@/lib/marketplace-response'

const ACTIONS = new Set(['pause', 'resume', 'complete', 'revoke'])

export async function POST(
  request: NextRequest,
  contextParams: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await contextParams.params
    const context = await requireCoupleMarketplace(request)
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const action = typeof body?.action === 'string' ? body.action : ''
    if (!ACTIONS.has(action)) throw new MarketplaceAccessError('Unsupported engagement action.', 400)
    const auditId = marketplaceId('audit')

    const status = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<
        Array<{
          status: string
          weddingId: string
          coupleBusinessAccountId: string
          plannerBusinessAccountId: string
          plannerUserId: string | null
          authorityBundle: string | null
          permissions: unknown
        }>
      >(
        `SELECT status, "weddingId", "coupleBusinessAccountId", "plannerBusinessAccountId",
                "plannerUserId", "authorityBundle", permissions
         FROM wewed_admin."PlannerEngagement" WHERE id = $1 FOR UPDATE`,
        id,
      )
      const engagement = rows[0]
      if (
        !engagement ||
        engagement.weddingId !== context.weddingId ||
        engagement.coupleBusinessAccountId !== context.coupleBusinessAccountId
      ) {
        throw new MarketplaceAccessError('Engagement was not found for the active wedding.', 404)
      }

      if (action === 'pause') {
        if (engagement.status !== 'active') throw new MarketplaceAccessError('Only active authority can be paused.', 409)
        await tx.$executeRawUnsafe(
          `UPDATE public."WeddingMembership"
           SET status = 'revoked', "revokedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
           WHERE "userId" = $1 AND "weddingId" = $2 AND status = 'active'`,
          engagement.plannerUserId,
          engagement.weddingId,
        )
        await tx.$executeRawUnsafe(
          `UPDATE wewed_admin."PlannerEngagement"
           SET status = 'paused', "pausedAt" = CURRENT_TIMESTAMP, "endedByUserId" = $2,
               "endReason" = $3, version = version + 1, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1`,
          id,
          context.user.id,
          text(body.reason, 500),
        )
        return 'paused'
      }

      if (action === 'resume') {
        if (engagement.status !== 'paused' || !engagement.plannerUserId || !isAuthorityBundle(engagement.authorityBundle)) {
          throw new MarketplaceAccessError('Only a paused, valid authority can be resumed.', 409)
        }
        const activePlanner = await tx.$queryRawUnsafe<Array<{ allowed: boolean }>>(
          `SELECT EXISTS (
             SELECT 1
             FROM wewed_admin."BusinessAccountMember" bam
             JOIN wewed_admin."BusinessAccount" ba ON ba.id = bam."businessAccountId"
             WHERE bam."businessAccountId" = $1
               AND bam."userId" = $2
               AND bam.status = 'active'
               AND ba.type = 'planning_company'
               AND ba.status = 'active'
               AND ba."onboardingStatus" = 'complete'
           ) AS allowed`,
          engagement.plannerBusinessAccountId,
          engagement.plannerUserId,
        )
        if (!activePlanner[0]?.allowed) {
          throw new MarketplaceAccessError(
            'The planner business is no longer active, so authority cannot be resumed.',
            409,
          )
        }

        const bundle = AUTHORITY_BUNDLES[engagement.authorityBundle]
        const resumed = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `UPDATE public."WeddingMembership"
           SET role = $3, status = 'active', permissions = $4,
               "acceptedAt" = CURRENT_TIMESTAMP, "revokedAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP
           WHERE "userId" = $1 AND "weddingId" = $2
           RETURNING id`,
          engagement.plannerUserId,
          engagement.weddingId,
          bundle.role,
          JSON.stringify(bundle.permissions),
        )
        if (!resumed[0]) {
          throw new MarketplaceAccessError('The planner membership no longer exists.', 409)
        }
        await tx.$executeRawUnsafe(
          `UPDATE wewed_admin."PlannerEngagement"
           SET status = 'active', "pausedAt" = NULL, "endedByUserId" = NULL,
               "endReason" = NULL, version = version + 1, "updatedAt" = CURRENT_TIMESTAMP
           WHERE id = $1`,
          id,
        )
        return 'active'
      }

      if (!['active', 'paused', 'planner_accepted', 'requested'].includes(engagement.status)) {
        throw new MarketplaceAccessError('This engagement is already closed.', 409)
      }
      if (engagement.plannerUserId) {
        await tx.$executeRawUnsafe(
          `UPDATE public."WeddingMembership"
           SET status = 'revoked', "revokedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
           WHERE "userId" = $1 AND "weddingId" = $2 AND status <> 'revoked'`,
          engagement.plannerUserId,
          engagement.weddingId,
        )
      }
      const nextStatus = action === 'complete' ? 'completed' : 'revoked'
      const dateColumn = action === 'complete' ? 'completedAt' : 'revokedAt'
      await tx.$executeRawUnsafe(
        `UPDATE wewed_admin."PlannerEngagement"
         SET status = $2, "${dateColumn}" = CURRENT_TIMESTAMP, "endedByUserId" = $3,
             "endReason" = $4, version = version + 1, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        id,
        nextStatus,
        context.user.id,
        text(body.reason, 500),
      )
      return nextStatus
    })

    await db.$executeRawUnsafe(
      `INSERT INTO wewed_admin."BusinessAuditLog"
        (id, "actorUserId", "businessAccountId", action, "resourceType", "resourceId", details)
       VALUES ($1, $2, $3, $4, 'planner_engagement', $5, $6::jsonb)`,
      auditId,
      context.user.id,
      context.coupleBusinessAccountId,
      `planner_engagement.${action}`,
      id,
      JSON.stringify({ status, weddingId: context.weddingId }),
    )

    return NextResponse.json({ success: true, status })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}
