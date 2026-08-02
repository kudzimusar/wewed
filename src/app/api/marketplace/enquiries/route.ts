import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  MarketplaceAccessError,
  marketplaceAudit,
  marketplaceId,
  requireCoupleMarketplace,
  requireMarketplaceUser,
  requirePlannerMarketplace,
  stringList,
  text,
} from '@/lib/marketplace-access'
import { marketplaceErrorResponse } from '@/lib/marketplace-response'

const BUDGET_BANDS = new Set(['not_sure', 'under_10k', '10k_25k', '25k_50k', '50k_100k', 'over_100k'])

export async function GET(request: NextRequest) {
  try {
    const base = await requireMarketplaceUser(request, ['couple', 'planner'])
    if (base.session.role === 'planner') {
      const context = await requirePlannerMarketplace(request)
      const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT e.*, p."displayName" AS "plannerDisplayName", p.slug AS "plannerSlug",
                w.title AS "weddingTitle", w.slug AS "weddingSlug"
         FROM public."PlannerEnquiry" e
         JOIN public."PlannerProfile" p ON p.id = e."plannerProfileId"
         JOIN public."Wedding" w ON w.id = e."weddingId"
         WHERE e."plannerBusinessAccountId" = $1
         ORDER BY e."createdAt" DESC`,
        context.business.businessAccountId,
      )
      return NextResponse.json({ success: true, scope: 'planner', enquiries: rows })
    }

    const context = await requireCoupleMarketplace(request)
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT e.*, p."displayName" AS "plannerDisplayName", p.slug AS "plannerSlug"
       FROM public."PlannerEnquiry" e
       JOIN public."PlannerProfile" p ON p.id = e."plannerProfileId"
       WHERE e."weddingId" = $1 AND e."createdByUserId" = $2
       ORDER BY e."createdAt" DESC`,
      context.weddingId,
      context.user.id,
    )
    return NextResponse.json({ success: true, scope: 'couple', enquiries: rows })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireCoupleMarketplace(request)
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) throw new MarketplaceAccessError('Invalid enquiry request.', 400)

    const plannerProfileId = text(body.plannerProfileId, 160)
    if (!plannerProfileId) throw new MarketplaceAccessError('Planner profile is required.', 400)

    const profileRows = await db.$queryRawUnsafe<
      Array<{ id: string; businessAccountId: string; displayName: string; availabilityStatus: string }>
    >(
      `SELECT id, "businessAccountId", "displayName", "availabilityStatus"
       FROM public."PlannerProfile"
       WHERE id = $1 AND status = 'published'
       LIMIT 1`,
      plannerProfileId,
    )
    const profile = profileRows[0]
    if (!profile) throw new MarketplaceAccessError('The planner profile is not available.', 404)
    if (profile.availabilityStatus === 'unavailable') {
      throw new MarketplaceAccessError('This planner is not currently accepting enquiries.', 409)
    }

    const recentRows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count
       FROM public."PlannerEnquiry"
       WHERE "createdByUserId" = $1 AND "createdAt" > CURRENT_TIMESTAMP - INTERVAL '1 hour'`,
      context.user.id,
    )
    if (Number(recentRows[0]?.count ?? 0) >= 5) {
      throw new MarketplaceAccessError('Too many enquiries were submitted recently. Try again later.', 429)
    }

    const weddingRows = await db.$queryRawUnsafe<
      Array<{ date: Date; venue: string; venueCity: string; venueCountry: string }>
    >(
      `SELECT date, venue, "venueCity", "venueCountry" FROM public."Wedding" WHERE id = $1 LIMIT 1`,
      context.weddingId,
    )
    const wedding = weddingRows[0]
    if (!wedding) throw new MarketplaceAccessError('Active wedding not found.', 404)

    const guestCountMin = body.guestCountMin === null || body.guestCountMin === '' ? null : Number(body.guestCountMin)
    const guestCountMax = body.guestCountMax === null || body.guestCountMax === '' ? null : Number(body.guestCountMax)
    if (
      (guestCountMin !== null && (!Number.isInteger(guestCountMin) || guestCountMin < 0)) ||
      (guestCountMax !== null && (!Number.isInteger(guestCountMax) || guestCountMax < 0)) ||
      (guestCountMin !== null && guestCountMax !== null && guestCountMin > guestCountMax)
    ) {
      throw new MarketplaceAccessError('Guest range is invalid.', 400)
    }

    const location = text(body.location, 240) ?? [wedding.venueCity, wedding.venueCountry].filter(Boolean).join(', ')
    const budgetBand = typeof body.budgetBand === 'string' && BUDGET_BANDS.has(body.budgetBand)
      ? body.budgetBand
      : 'not_sure'
    const services = stringList(body.services, 20)
    const weddingStyles = stringList(body.weddingStyles, 20)
    if (services.length === 0) throw new MarketplaceAccessError('Select at least one requested service.', 400)

    const id = marketplaceId('planner-enquiry')
    const sharedSummary = {
      weddingTitle: context.weddingTitle,
      weddingDate: wedding.date.toISOString(),
      location,
      guestCountMin,
      guestCountMax,
      budgetBand,
      services,
      weddingStyles,
    }

    const inserted = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO wewed_admin."PlannerEnquiry" (
         id, "weddingId", "coupleBusinessAccountId", "plannerBusinessAccountId",
         "plannerProfileId", "createdByUserId", status, "weddingDate", location,
         "guestCountMin", "guestCountMax", "budgetBand", "weddingStyles", services,
         message, "sharedSummary"
       ) VALUES (
         $1, $2, $3, $4, $5, $6, 'submitted', $7, $8, $9, $10, $11,
         $12::jsonb, $13::jsonb, $14, $15::jsonb
       )
       ON CONFLICT DO NOTHING
       RETURNING id`,
      id,
      context.weddingId,
      context.coupleBusinessAccountId,
      profile.businessAccountId,
      profile.id,
      context.user.id,
      wedding.date,
      location,
      guestCountMin,
      guestCountMax,
      budgetBand,
      JSON.stringify(weddingStyles),
      JSON.stringify(services),
      text(body.message, 3000),
      JSON.stringify(sharedSummary),
    )
    if (!inserted[0]) {
      throw new MarketplaceAccessError(
        'An open enquiry already exists for this planner and wedding.',
        409,
      )
    }

    await marketplaceAudit({
      actorUserId: context.user.id,
      businessAccountId: context.coupleBusinessAccountId,
      action: 'planner_enquiry.submitted',
      resourceType: 'planner_enquiry',
      resourceId: inserted[0].id,
      details: { weddingId: context.weddingId, plannerBusinessAccountId: profile.businessAccountId },
    })

    return NextResponse.json({ success: true, enquiryId: inserted[0].id, status: 'submitted' }, { status: 201 })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}

export const dynamic = 'force-dynamic'
