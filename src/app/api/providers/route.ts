import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PROVIDER_CATEGORY_VALUES } from '@/lib/provider-catalog'

const FEATURED_BADGE = 'Wewed Featured'
const PROFILE_FILTERS = new Set(['featured', 'approved', 'unclaimed'])
const SORT_VALUES = new Set(['recommended', 'name', 'newest'])

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
  const verificationBadges = stringList(row.verificationBadges)
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
    verificationBadges,
    featured: verificationBadges.includes(FEATURED_BADGE),
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
  const requestedProfile = request.nextUrl.searchParams.get('profile')?.trim() || ''
  const profile = PROFILE_FILTERS.has(requestedProfile) ? requestedProfile : null
  const availability = request.nextUrl.searchParams.get('availability') === 'accepting' ? true : null
  const requestedSort = request.nextUrl.searchParams.get('sort')?.trim() || 'recommended'
  const sort = SORT_VALUES.has(requestedSort) ? requestedSort : 'recommended'
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
       LEFT JOIN wewed_admin."ProviderDiscoveryCandidate" dc
         ON dc.id = ba."sourceId"
       JOIN LATERAL (
         SELECT candidate_offering.*
         FROM public."ProviderServiceOffering" candidate_offering
         WHERE candidate_offering."businessAccountId" = p."businessAccountId"
           AND candidate_offering.status = 'published'
           AND ($1::text IS NULL OR candidate_offering.category = $1)
           AND ($2::text IS NULL OR
                p."displayName" ILIKE '%' || $2 || '%' OR
                COALESCE(p.headline, '') ILIKE '%' || $2 || '%' OR
                COALESCE(p.description, '') ILIKE '%' || $2 || '%' OR
                candidate_offering."displayName" ILIKE '%' || $2 || '%' OR
                COALESCE(candidate_offering.description, '') ILIKE '%' || $2 || '%')
         ORDER BY
           CASE
             WHEN $1::text IS NOT NULL AND candidate_offering.category = $1 THEN 0
             WHEN dc."primaryCategory" IS NOT NULL AND candidate_offering.category = dc."primaryCategory" THEN 0
             ELSE 1
           END,
           candidate_offering."createdAt",
           candidate_offering.category
         LIMIT 1
       ) o ON true
       WHERE p.visibility = 'published'
         AND p."listingStatus" NOT IN ('suspended', 'removed')
         AND ($3::text IS NULL OR
              p.city ILIKE $3 OR
              p.country ILIKE $3 OR
              p."serviceAreas" @> jsonb_build_array($3) OR
              EXISTS (
                SELECT 1
                FROM public."ProviderServiceOffering" area_offering
                WHERE area_offering."businessAccountId" = p."businessAccountId"
                  AND area_offering.status = 'published'
                  AND area_offering."serviceAreas" @> jsonb_build_array($3)
              ))
         AND ($4::text IS NULL OR
              ($4 = 'featured' AND COALESCE(p."verificationBadges", '[]'::jsonb) @> '["Wewed Featured"]'::jsonb) OR
              ($4 = 'approved' AND p."listingStatus" IN ('verified', 'claimed')) OR
              ($4 = 'unclaimed' AND p."listingStatus" IN ('unclaimed', 'claim_pending')))
         AND ($5::boolean IS NULL OR p."acceptingEnquiries" = $5)
       ORDER BY
         CASE WHEN $6::text = 'name' THEN p."displayName" END ASC,
         CASE WHEN $6::text = 'newest' THEN COALESCE(p."publishedAt", p."createdAt") END DESC,
         CASE WHEN $6::text = 'recommended' AND COALESCE(p."verificationBadges", '[]'::jsonb) @> '["Wewed Featured"]'::jsonb THEN 0 ELSE 1 END,
         CASE WHEN $6::text = 'recommended' THEN
           CASE p."listingStatus"
             WHEN 'verified' THEN 0
             WHEN 'claimed' THEN 1
             WHEN 'claim_pending' THEN 2
             ELSE 3
           END
         ELSE 0 END,
         p."displayName"
       LIMIT $7 OFFSET $8`,
      category,
      query,
      area,
      profile,
      availability,
      sort,
      pageSize,
      offset,
    )

    const total = rows.length > 0 && typeof rows[0].totalCount === 'number' ? rows[0].totalCount : 0
    return NextResponse.json({
      success: true,
      category,
      query,
      area,
      profile,
      availability: availability ? 'accepting' : null,
      sort,
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