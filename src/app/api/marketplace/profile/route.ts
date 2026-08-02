import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  MarketplaceAccessError,
  marketplaceAudit,
  marketplaceId,
  requirePlannerMarketplace,
  slugify,
  stringList,
  text,
} from '@/lib/marketplace-access'
import { marketplaceErrorResponse } from '@/lib/marketplace-response'

const PRICE_BANDS = new Set(['contact', 'budget', 'standard', 'premium', 'luxury'])
const AVAILABILITY = new Set(['accepting', 'limited', 'unavailable'])

function httpsPortfolio(value: unknown): string[] {
  const entries = stringList(value, 12)
  for (const entry of entries) {
    try {
      if (new URL(entry).protocol !== 'https:') {
        throw new MarketplaceAccessError('Portfolio links must use HTTPS.', 400)
      }
    } catch (error) {
      if (error instanceof MarketplaceAccessError) throw error
      throw new MarketplaceAccessError('Portfolio links must be valid HTTPS URLs.', 400)
    }
  }
  return entries
}

export async function GET(request: NextRequest) {
  try {
    const context = await requirePlannerMarketplace(request)
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM public."PlannerProfile" WHERE "businessAccountId" = $1 LIMIT 1`,
      context.business.businessAccountId,
    )
    return NextResponse.json({
      success: true,
      business: context.business,
      profile: rows[0] ?? null,
    })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await requirePlannerMarketplace(request)
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) throw new MarketplaceAccessError('Invalid profile request.', 400)

    const displayName = text(body.displayName, 120) ?? context.business.businessName
    const requestedSlug = slugify(text(body.slug, 100) ?? displayName)
    if (!requestedSlug) throw new MarketplaceAccessError('A valid profile name or slug is required.', 400)

    const yearsExperience = body.yearsExperience === null || body.yearsExperience === ''
      ? null
      : Number(body.yearsExperience)
    if (yearsExperience !== null && (!Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 80)) {
      throw new MarketplaceAccessError('Years of experience must be between 0 and 80.', 400)
    }

    const minimumGuestCount = body.minimumGuestCount === null || body.minimumGuestCount === ''
      ? null
      : Number(body.minimumGuestCount)
    const maximumGuestCount = body.maximumGuestCount === null || body.maximumGuestCount === ''
      ? null
      : Number(body.maximumGuestCount)
    if (
      (minimumGuestCount !== null && (!Number.isInteger(minimumGuestCount) || minimumGuestCount < 0)) ||
      (maximumGuestCount !== null && (!Number.isInteger(maximumGuestCount) || maximumGuestCount < 0)) ||
      (minimumGuestCount !== null && maximumGuestCount !== null && minimumGuestCount > maximumGuestCount)
    ) {
      throw new MarketplaceAccessError('Guest range is invalid.', 400)
    }

    const priceBand = typeof body.priceBand === 'string' && PRICE_BANDS.has(body.priceBand)
      ? body.priceBand
      : 'contact'
    const availabilityStatus = typeof body.availabilityStatus === 'string' && AVAILABILITY.has(body.availabilityStatus)
      ? body.availabilityStatus
      : 'accepting'
    const portfolio = httpsPortfolio(body.portfolio)

    const existing = await db.$queryRawUnsafe<Array<{ id: string; status: string; slug: string }>>(
      `SELECT id, status, slug FROM public."PlannerProfile" WHERE "businessAccountId" = $1 LIMIT 1`,
      context.business.businessAccountId,
    )
    const slugOwner = await db.$queryRawUnsafe<Array<{ businessAccountId: string }>>(
      `SELECT "businessAccountId" FROM public."PlannerProfile" WHERE slug = $1 LIMIT 1`,
      requestedSlug,
    )
    if (slugOwner[0] && slugOwner[0].businessAccountId !== context.business.businessAccountId) {
      throw new MarketplaceAccessError('That public planner URL is already in use.', 409)
    }

    const profileId = existing[0]?.id ?? marketplaceId('planner-profile')
    const status = existing[0]?.status === 'suspended' ? 'suspended' : 'draft'
    if (status === 'suspended') {
      throw new MarketplaceAccessError('This planner profile is suspended and cannot be edited.', 403)
    }

    await db.$executeRawUnsafe(
      `INSERT INTO wewed_admin."PlannerProfile" (
         id, "businessAccountId", slug, "displayName", headline, bio,
         "yearsExperience", "serviceAreas", services, "weddingStyles", languages,
         "priceBand", "minimumGuestCount", "maximumGuestCount", "availabilityStatus",
         portfolio, status, "reviewNotes", "publishedAt", "updatedAt"
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb,
         $12, $13, $14, $15, $16::jsonb, $17, NULL, NULL, CURRENT_TIMESTAMP
       )
       ON CONFLICT ("businessAccountId") DO UPDATE SET
         slug = EXCLUDED.slug,
         "displayName" = EXCLUDED."displayName",
         headline = EXCLUDED.headline,
         bio = EXCLUDED.bio,
         "yearsExperience" = EXCLUDED."yearsExperience",
         "serviceAreas" = EXCLUDED."serviceAreas",
         services = EXCLUDED.services,
         "weddingStyles" = EXCLUDED."weddingStyles",
         languages = EXCLUDED.languages,
         "priceBand" = EXCLUDED."priceBand",
         "minimumGuestCount" = EXCLUDED."minimumGuestCount",
         "maximumGuestCount" = EXCLUDED."maximumGuestCount",
         "availabilityStatus" = EXCLUDED."availabilityStatus",
         portfolio = EXCLUDED.portfolio,
         status = EXCLUDED.status,
         "reviewNotes" = NULL,
         "publishedAt" = NULL,
         "updatedAt" = CURRENT_TIMESTAMP`,
      profileId,
      context.business.businessAccountId,
      requestedSlug,
      displayName,
      text(body.headline, 180),
      text(body.bio, 4000),
      yearsExperience,
      JSON.stringify(stringList(body.serviceAreas, 30)),
      JSON.stringify(stringList(body.services, 30)),
      JSON.stringify(stringList(body.weddingStyles, 30)),
      JSON.stringify(stringList(body.languages, 20)),
      priceBand,
      minimumGuestCount,
      maximumGuestCount,
      availabilityStatus,
      JSON.stringify(portfolio),
      status,
    )

    await marketplaceAudit({
      actorUserId: context.user.id,
      businessAccountId: context.business.businessAccountId,
      action: existing[0] ? 'planner_profile.updated' : 'planner_profile.created',
      resourceType: 'planner_profile',
      resourceId: profileId,
      details: { previousStatus: existing[0]?.status ?? null, status },
    })

    return NextResponse.json({ success: true, profileId, status })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}

export const dynamic = 'force-dynamic'
