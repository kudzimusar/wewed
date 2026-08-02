import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  requireCoupleMarketplace,
  requireMarketplaceUser,
  requirePlannerMarketplace,
} from '@/lib/marketplace-access'
import { marketplaceErrorResponse } from '@/lib/marketplace-response'

export async function GET(request: NextRequest) {
  try {
    const base = await requireMarketplaceUser(request, ['couple', 'planner'])
    if (base.session.role === 'planner') {
      const context = await requirePlannerMarketplace(request)
      const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT g.*, e."sharedSummary", e.message, w.title AS "weddingTitle", w.slug AS "weddingSlug"
         FROM public."PlannerEngagement" g
         JOIN public."PlannerEnquiry" e ON e.id = g."enquiryId"
         JOIN public."Wedding" w ON w.id = g."weddingId"
         WHERE g."plannerBusinessAccountId" = $1
         ORDER BY g."createdAt" DESC`,
        context.business.businessAccountId,
      )
      return NextResponse.json({ success: true, scope: 'planner', engagements: rows })
    }

    const context = await requireCoupleMarketplace(request)
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT g.*, p."displayName" AS "plannerDisplayName", p.slug AS "plannerSlug"
       FROM public."PlannerEngagement" g
       JOIN public."PlannerEnquiry" e ON e.id = g."enquiryId"
       JOIN public."PlannerProfile" p ON p.id = e."plannerProfileId"
       WHERE g."weddingId" = $1 AND g."coupleBusinessAccountId" = $2
       ORDER BY g."createdAt" DESC`,
      context.weddingId,
      context.coupleBusinessAccountId,
    )
    return NextResponse.json({ success: true, scope: 'couple', engagements: rows })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}

export const dynamic = 'force-dynamic'
