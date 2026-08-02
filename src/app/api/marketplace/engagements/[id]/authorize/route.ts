import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  AUTHORITY_BUNDLES,
  MarketplaceAccessError,
  isAuthorityBundle,
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
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || !isAuthorityBundle(body.authorityBundle)) {
      throw new MarketplaceAccessError('Choose a valid authority bundle.', 400)
    }
    const bundle = AUTHORITY_BUNDLES[body.authorityBundle]
    const membershipId = marketplaceId('wedding-membership')
    const linkId = marketplaceId('planner-wedding')
    const auditId = marketplaceId('audit')

    const result = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<
        Array<{
          id: string
          status: string
          weddingId: string
          coupleBusinessAccountId: string
          plannerBusinessAccountId: string
          plannerUserId: string | null
        }>
      >(
        `SELECT id, status, "weddingId", "coupleBusinessAccountId", "plannerBusinessAccountId", "plannerUserId"
         FROM wewed_admin."PlannerEngagement"
         WHERE id = $1 FOR UPDATE`,
        id,
      )
      const engagement = rows[0]
      if (
        !engagement ||
        engagement.weddingId !== context.weddingId ||
        engagement.coupleBusinessAccountId !== context.coupleBusinessAccountId
      ) {
        throw new MarketplaceAccessError('Appointment was not found for the active wedding.', 404)
      }
      if (engagement.status !== 'planner_accepted' || !engagement.plannerUserId) {
        throw new MarketplaceAccessError('Planner acceptance is required before authority can be granted.', 409)
      }

      const memberRows = await tx.$queryRawUnsafe<Array<{ allowed: boolean }>>(
        `SELECT EXISTS (
           SELECT 1 FROM wewed_admin."BusinessAccountMember" bam
           JOIN wewed_admin."BusinessAccount" ba ON ba.id = bam."businessAccountId"
           WHERE bam."businessAccountId" = $1 AND bam."userId" = $2
             AND bam.status = 'active' AND ba.status = 'active'
             AND ba.type = 'planning_company' AND ba."onboardingStatus" = 'complete'
         ) AS allowed`,
        engagement.plannerBusinessAccountId,
        engagement.plannerUserId,
      )
      if (!memberRows[0]?.allowed) {
        throw new MarketplaceAccessError('The accepting planner is no longer an active business member.', 409)
      }

      const memberships = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `INSERT INTO public."WeddingMembership" (
           id, "userId", "weddingId", role, status, permissions,
           "invitedById", "acceptedAt", "revokedAt", "createdAt", "updatedAt"
         ) VALUES ($1, $2, $3, $4, 'active', $5, $6, CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT ("userId", "weddingId") DO UPDATE SET
           role = EXCLUDED.role,
           status = 'active',
           permissions = EXCLUDED.permissions,
           "invitedById" = EXCLUDED."invitedById",
           "acceptedAt" = CURRENT_TIMESTAMP,
           "revokedAt" = NULL,
           "updatedAt" = CURRENT_TIMESTAMP
         RETURNING id`,
        membershipId,
        engagement.plannerUserId,
        engagement.weddingId,
        bundle.role,
        JSON.stringify(bundle.permissions),
        context.user.id,
      )
      const effectiveMembershipId = memberships[0]?.id
      if (!effectiveMembershipId) throw new MarketplaceAccessError('Planner access could not be activated.', 409)

      await tx.$executeRawUnsafe(
        `INSERT INTO wewed_admin."BusinessAccountLink" (id, "businessAccountId", "entityType", "entityId", relationship)
         VALUES ($1, $2, 'wedding', $3, 'manages')
         ON CONFLICT ("businessAccountId", "entityType", "entityId")
         DO UPDATE SET relationship = 'manages'`,
        linkId,
        engagement.plannerBusinessAccountId,
        engagement.weddingId,
      )

      await tx.$executeRawUnsafe(
        `UPDATE wewed_admin."PlannerEngagement"
         SET status = 'active', "authorityBundle" = $2, permissions = $3::jsonb,
             "membershipId" = $4, "authorizedByUserId" = $5,
             "authorizedAt" = CURRENT_TIMESTAMP, version = version + 1,
             "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1`,
        id,
        body.authorityBundle,
        JSON.stringify(bundle.permissions),
        effectiveMembershipId,
        context.user.id,
      )
      await tx.$executeRawUnsafe(
        `INSERT INTO wewed_admin."BusinessAuditLog"
          (id, "actorUserId", "businessAccountId", action, "resourceType", "resourceId", details)
         VALUES ($1, $2, $3, 'planner_engagement.authorized', 'planner_engagement', $4, $5::jsonb)`,
        auditId,
        context.user.id,
        context.coupleBusinessAccountId,
        id,
        JSON.stringify({
          weddingId: engagement.weddingId,
          plannerUserId: engagement.plannerUserId,
          authorityBundle: body.authorityBundle,
          permissions: bundle.permissions,
          membershipId: effectiveMembershipId,
        }),
      )
      return effectiveMembershipId
    })

    return NextResponse.json({ success: true, status: 'active', membershipId: result })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}
