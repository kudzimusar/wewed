import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  MarketplaceAccessError,
  marketplaceAudit,
  marketplaceId,
  requireCoupleMarketplace,
  text,
  toPublicProfile,
} from '@/lib/marketplace-access'
import { marketplaceErrorResponse } from '@/lib/marketplace-response'

export async function GET(request: NextRequest) {
  try {
    const context = await requireCoupleMarketplace(request)
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT p.*
       FROM public."PlannerShortlist" s
       JOIN public."PlannerProfile" p ON p.id = s."plannerProfileId"
       WHERE s."weddingId" = $1 AND s."createdByUserId" = $2
       ORDER BY s."createdAt" DESC`,
      context.weddingId,
      context.user.id,
    )
    return NextResponse.json({ success: true, planners: rows.map(toPublicProfile) })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireCoupleMarketplace(request)
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const plannerProfileId = text(body?.plannerProfileId, 160)
    if (!plannerProfileId) throw new MarketplaceAccessError('Planner profile is required.', 400)

    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM public."PlannerProfile" WHERE id = $1 AND status = 'published' LIMIT 1`,
      plannerProfileId,
    )
    if (!rows[0]) throw new MarketplaceAccessError('Planner profile not found.', 404)

    const id = marketplaceId('planner-shortlist')
    await db.$executeRawUnsafe(
      `INSERT INTO wewed_admin."PlannerShortlist" (id, "weddingId", "plannerProfileId", "createdByUserId")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("weddingId", "plannerProfileId") DO NOTHING`,
      id,
      context.weddingId,
      plannerProfileId,
      context.user.id,
    )
    await marketplaceAudit({
      actorUserId: context.user.id,
      businessAccountId: context.coupleBusinessAccountId,
      action: 'planner_shortlist.added',
      resourceType: 'planner_profile',
      resourceId: plannerProfileId,
      details: { weddingId: context.weddingId },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requireCoupleMarketplace(request)
    const plannerProfileId = request.nextUrl.searchParams.get('plannerProfileId')?.trim()
    if (!plannerProfileId) throw new MarketplaceAccessError('Planner profile is required.', 400)
    await db.$executeRawUnsafe(
      `DELETE FROM wewed_admin."PlannerShortlist"
       WHERE "weddingId" = $1 AND "plannerProfileId" = $2 AND "createdByUserId" = $3`,
      context.weddingId,
      plannerProfileId,
      context.user.id,
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}
