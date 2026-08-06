import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PROVIDER_CATEGORY_VALUES } from '@/lib/provider-catalog'

function stringList(value: unknown, limit = 50): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string').slice(0, limit)
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string').slice(0, limit) : []
  } catch {
    return value.split(',').map((entry) => entry.trim()).filter(Boolean).slice(0, limit)
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function publicProvider(row: Record<string, unknown>) {
  return {
    id: String(row.profileId),
    slug: String(row.slug),
    accountType: String(row.accountType),
    displayName: String(row.displayName),
    headline: typeof row.headline === 'string' ? row.headline : null,
    description: typeof row.description === 'string' ? row.description : null,
    country: typeof row.country === 'string' ? row.country : null,
    city: typeof row.city === 'string' ? row.city : null,
    serviceAreas: stringList(row.profileServiceAreas),
    languages: stringList(row.languages),
    phone: typeof row.phone === 'string' ? row.phone : null,
    website: typeof row.website === 'string' ? row.website : null,
    coverImageUrl: typeof row.coverImageUrl === 'string' ? row.coverImageUrl : null,
    yearsOperating: typeof row.yearsOperating === 'number' ? row.yearsOperating : null,
    teamSize: typeof row.teamSize === 'number' ? row.teamSize : null,
    responseTime: typeof row.responseTime === 'string' ? row.responseTime : null,
    minimumBookingNotice: typeof row.minimumBookingNotice === 'string' ? row.minimumBookingNotice : null,
    verificationBadges: stringList(row.verificationBadges),
    listingStatus: typeof row.listingStatus === 'string' ? row.listingStatus : 'claimed',
    isClaimable: row.isClaimable === true,
    acceptingEnquiries: row.acceptingEnquiries !== false,
    sourceSummary: typeof row.sourceSummary === 'string' ? row.sourceSummary : null,
    lastSourceCheckAt: row.lastSourceCheckAt ?? null,
    claimNotice: typeof row.claimNotice === 'string' ? row.claimNotice : null,
    offering: {
      id: String(row.offeringId),
      category: String(row.category),
      displayName: String(row.offeringName),
      description: typeof row.offeringDescription === 'string' ? row.offeringDescription : null,
      startingPriceCents: typeof row.startingPriceCents === 'number' ? row.startingPriceCents : null,
      maximumPriceCents: typeof row.maximumPriceCents === 'number' ? row.maximumPriceCents : null,
      currency: String(row.currency || 'USD'),
      pricingModel: typeof row.pricingModel === 'string' ? row.pricingModel : null,
      minimumCapacity: typeof row.minimumCapacity === 'number' ? row.minimumCapacity : null,
      maximumCapacity: typeof row.maximumCapacity === 'number' ? row.maximumCapacity : null,
      bookingLeadTime: typeof row.bookingLeadTime === 'string' ? row.bookingLeadTime : null,
      serviceAreas: stringList(row.offeringServiceAreas),
      inclusions: stringList(row.inclusions),
      details: objectValue(row.details),
    },
  }
}

export async function GET(request: NextRequest) {
  const requestedCategory = request.nextUrl.searchParams.get('category')?.trim() || ''
  const category = PROVIDER_CATEGORY_VALUES.has(requestedCategory) ? requestedCategory : null
  const query = request.nextUrl.searchParams.get('q')?.trim().slice(0, 100) || null
  const area = request.nextUrl.searchParams.get('area')?.trim().slice(0, 120) || null
  const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(60, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('pageSize') || '24', 10) || 24))
  const offset = (page - 1) * pageSize

  try {
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT
         COUNT(*) OVER()::int AS "totalCount",
         p.id AS "profileId",
         p.slug,
         ba.type AS "accountType",
         p."displayName",
         p.headline,
         p.description,
         p.country,
         p.city,
         p."serviceAreas" AS "profileServiceAreas",
         p.languages,
         p.phone,
         p.website,
         p."coverImageUrl",
         p."yearsOperating",
         p."teamSize",
         p."responseTime",
         p."minimumBookingNotice",
         p."verificationBadges",
         p."listingStatus",
         p."isClaimable",
         p."acceptingEnquiries",
         p."sourceSummary",
         p."lastSourceCheckAt",
         p."claimNotice",
         o.id AS "offeringId",
         o.category,
         o."displayName" AS "offeringName",
         o.description AS "offeringDescription",
         o."startingPriceCents",
         o."maximumPriceCents",
         o.currency,
         o."pricingModel",
         o."minimumCapacity",
         o."maximumCapacity",
         o."bookingLeadTime",
         o."serviceAreas" AS "offeringServiceAreas",
         o.inclusions,
         o.details
       FROM public."ProviderProfile" p
       JOIN public."BusinessAccount" ba
         ON ba.id = p."businessAccountId"
        AND ba.type IN ('venue', 'vendor')
        AND ba.status = 'active'
        AND (
          ba."onboardingStatus" = 'complete' OR
          p."listingStatus" IN ('unclaimed', 'claim_pending')
        )
       JOIN public."ProviderServiceOffering" o
         ON o."businessAccountId" = p."businessAccountId"
        AND o.status = 'published'
       WHERE p.visibility = 'published'
         AND p."listingStatus" NOT IN ('suspended', 'removed')
         AND ($1::text IS NULL OR o.category = $1)
         AND ($2::text IS NULL OR
              p."displayName" ILIKE '%' || $2 || '%' OR
              COALESCE(p.headline, '') ILIKE '%' || $2 || '%' OR
              COALESCE(p.description, '') ILIKE '%' || $2 || '%' OR
              o."displayName" ILIKE '%' || $2 || '%' OR
              COALESCE(o.description, '') ILIKE '%' || $2 || '%')
         AND ($3::text IS NULL OR
              p.city ILIKE $3 OR
              p.country ILIKE $3 OR
              p."serviceAreas" @> jsonb_build_array($3) OR
              o."serviceAreas" @> jsonb_build_array($3))
       ORDER BY
         CASE p."listingStatus"
           WHEN 'verified' THEN 0
           WHEN 'claimed' THEN 1
           WHEN 'claim_pending' THEN 2
           ELSE 3
         END,
         p."displayName",
         o.category
       LIMIT $4 OFFSET $5`,
      category,
      query,
      area,
      pageSize,
      offset,
    )

    const total = rows.length > 0 && typeof rows[0].totalCount === 'number' ? rows[0].totalCount : 0
    return NextResponse.json({
      success: true,
      category,
      query,
      area,
      providers: rows.map(publicProvider),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        hasMore: offset + rows.length < total,
      },
    })
  } catch (error) {
    console.error('[providers] Error:', error)
    return NextResponse.json({ success: false, providers: [], error: 'Provider profiles are temporarily unavailable.' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
