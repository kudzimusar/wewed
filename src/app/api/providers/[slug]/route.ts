import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string')
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : []
  } catch {
    return value.split(',').map((entry) => entry.trim()).filter(Boolean)
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

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  try {
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT
         p.*,
         ba.type AS "accountType",
         ba.id AS "businessAccountId"
       FROM public."ProviderProfile" p
       JOIN public."BusinessAccount" ba
         ON ba.id = p."businessAccountId"
        AND ba.type IN ('venue', 'vendor')
        AND ba.status = 'active'
        AND ba."onboardingStatus" = 'complete'
       WHERE p.slug = $1
         AND p.visibility = 'published'
       LIMIT 1`,
      slug,
    )
    const profile = rows[0]
    if (!profile) return NextResponse.json({ success: false, error: 'Provider profile not found.' }, { status: 404 })

    const offerings = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM public."ProviderServiceOffering"
       WHERE "businessAccountId" = $1 AND status = 'published'
       ORDER BY "createdAt", category`,
      profile.businessAccountId,
    )
    if (offerings.length === 0) return NextResponse.json({ success: false, error: 'Provider profile not found.' }, { status: 404 })

    const packages = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT pp.* FROM public."ProviderPackage" pp
       JOIN public."ProviderServiceOffering" o ON o.id = pp."offeringId"
       WHERE o."businessAccountId" = $1 AND o.status = 'published' AND pp."isActive" = true
       ORDER BY pp."offeringId", pp."sortOrder"`,
      profile.businessAccountId,
    )
    const portfolio = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT pi.* FROM public."ProviderPortfolioItem" pi
       JOIN public."ProviderServiceOffering" o ON o.id = pi."offeringId"
       WHERE o."businessAccountId" = $1 AND o.status = 'published' AND pi."isPublished" = true
       ORDER BY pi."offeringId", pi."sortOrder"`,
      profile.businessAccountId,
    )

    return NextResponse.json({
      success: true,
      provider: {
        id: String(profile.id),
        slug: String(profile.slug),
        accountType: String(profile.accountType),
        displayName: String(profile.displayName),
        headline: typeof profile.headline === 'string' ? profile.headline : null,
        description: typeof profile.description === 'string' ? profile.description : null,
        country: typeof profile.country === 'string' ? profile.country : null,
        city: typeof profile.city === 'string' ? profile.city : null,
        serviceAreas: list(profile.serviceAreas),
        languages: list(profile.languages),
        publicEmail: typeof profile.publicEmail === 'string' ? profile.publicEmail : null,
        phone: typeof profile.phone === 'string' ? profile.phone : null,
        website: typeof profile.website === 'string' ? profile.website : null,
        socialLinks: objectValue(profile.socialLinks),
        yearsOperating: typeof profile.yearsOperating === 'number' ? profile.yearsOperating : null,
        teamSize: typeof profile.teamSize === 'number' ? profile.teamSize : null,
        responseTime: typeof profile.responseTime === 'string' ? profile.responseTime : null,
        minimumBookingNotice: typeof profile.minimumBookingNotice === 'string' ? profile.minimumBookingNotice : null,
        travelRadiusKm: typeof profile.travelRadiusKm === 'number' ? profile.travelRadiusKm : null,
        paymentMethods: list(profile.paymentMethods),
        depositPolicy: typeof profile.depositPolicy === 'string' ? profile.depositPolicy : null,
        cancellationPolicy: typeof profile.cancellationPolicy === 'string' ? profile.cancellationPolicy : null,
        refundPolicy: typeof profile.refundPolicy === 'string' ? profile.refundPolicy : null,
        travelPolicy: typeof profile.travelPolicy === 'string' ? profile.travelPolicy : null,
        accessibilitySupport: typeof profile.accessibilitySupport === 'string' ? profile.accessibilitySupport : null,
        culturalExperience: typeof profile.culturalExperience === 'string' ? profile.culturalExperience : null,
        coverImageUrl: typeof profile.coverImageUrl === 'string' ? profile.coverImageUrl : null,
        faq: Array.isArray(profile.faq) ? profile.faq : [],
        verificationBadges: list(profile.verificationBadges),
        lastProfileUpdate: profile.lastProfileUpdate,
        offerings: offerings.map((offering) => ({
          id: String(offering.id),
          category: String(offering.category),
          displayName: String(offering.displayName),
          description: typeof offering.description === 'string' ? offering.description : null,
          startingPriceCents: typeof offering.startingPriceCents === 'number' ? offering.startingPriceCents : null,
          maximumPriceCents: typeof offering.maximumPriceCents === 'number' ? offering.maximumPriceCents : null,
          currency: String(offering.currency || 'USD'),
          pricingModel: typeof offering.pricingModel === 'string' ? offering.pricingModel : null,
          minimumCapacity: typeof offering.minimumCapacity === 'number' ? offering.minimumCapacity : null,
          maximumCapacity: typeof offering.maximumCapacity === 'number' ? offering.maximumCapacity : null,
          bookingLeadTime: typeof offering.bookingLeadTime === 'string' ? offering.bookingLeadTime : null,
          serviceAreas: list(offering.serviceAreas),
          inclusions: list(offering.inclusions),
          details: objectValue(offering.details),
          packages: packages.filter((entry) => entry.offeringId === offering.id).map((entry) => ({
            id: String(entry.id),
            name: String(entry.name),
            description: typeof entry.description === 'string' ? entry.description : null,
            priceCents: typeof entry.priceCents === 'number' ? entry.priceCents : null,
            currency: String(entry.currency || offering.currency || 'USD'),
            pricingUnit: typeof entry.pricingUnit === 'string' ? entry.pricingUnit : null,
            inclusions: list(entry.inclusions),
          })),
          portfolio: portfolio.filter((entry) => entry.offeringId === offering.id).map((entry) => ({
            id: String(entry.id),
            type: String(entry.type),
            url: String(entry.url),
            thumbnailUrl: typeof entry.thumbnailUrl === 'string' ? entry.thumbnailUrl : null,
            altText: typeof entry.altText === 'string' ? entry.altText : '',
            caption: typeof entry.caption === 'string' ? entry.caption : null,
          })),
        })),
      },
    })
  } catch (error) {
    console.error('[providers/slug] Error:', error)
    return NextResponse.json({ success: false, error: 'Provider profile is temporarily unavailable.' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
