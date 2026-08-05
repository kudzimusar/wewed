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
const CURRENCIES = new Set(['USD', 'ZAR', 'GBP', 'EUR', 'BWP', 'ZMW', 'MZN'])

function httpsPortfolio(value: unknown): string[] {
  const entries = stringList(value, 12)
  for (const entry of entries) {
    try {
      if (new URL(entry).protocol !== 'https:') throw new MarketplaceAccessError('Portfolio links must use HTTPS.', 400)
    } catch (error) {
      if (error instanceof MarketplaceAccessError) throw error
      throw new MarketplaceAccessError('Portfolio links must be valid HTTPS URLs.', 400)
    }
  }
  return entries
}

function integer(value: unknown, label: string, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) throw new MarketplaceAccessError(`${label} must be between ${min} and ${max}.`, 400)
  return number
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function profileDetails(value: unknown): Record<string, unknown> {
  const source = objectValue(value)
  return {
    responseTime: text(source.responseTime, 160),
    bookingNotice: text(source.bookingNotice, 160),
    feeModel: text(source.feeModel, 120),
    consultationProcess: text(source.consultationProcess, 3000),
    teamStructure: text(source.teamStructure, 2000),
    supportedBudgets: stringList(source.supportedBudgets, 20),
    accessibilitySupport: text(source.accessibilitySupport, 2000),
    culturalExperience: text(source.culturalExperience, 2000),
    depositPolicy: text(source.depositPolicy, 2000),
    cancellationPolicy: text(source.cancellationPolicy, 3000),
    travelPolicy: text(source.travelPolicy, 3000),
    referencesAvailable: source.referencesAvailable === true || source.referencesAvailable === 'true',
  }
}

function packages(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 20).map((item) => {
    const row = objectValue(item)
    const startingPrice = row.startingPrice === null || row.startingPrice === undefined || row.startingPrice === '' ? null : Number(row.startingPrice)
    if (startingPrice !== null && (!Number.isFinite(startingPrice) || startingPrice < 0 || startingPrice > 100000000)) {
      throw new MarketplaceAccessError('Planner package price is invalid.', 400)
    }
    const currency = typeof row.currency === 'string' && CURRENCIES.has(row.currency) ? row.currency : 'USD'
    return {
      name: text(row.name, 160) ?? '',
      description: text(row.description, 2000),
      startingPrice,
      currency,
      pricingUnit: text(row.pricingUnit, 120),
      inclusions: stringList(row.inclusions, 50),
    }
  }).filter((item) => item.name)
}

function faq(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 20).map((item) => {
    const row = objectValue(item)
    return { question: text(row.question, 240) ?? '', answer: text(row.answer, 2000) ?? '' }
  }).filter((item) => item.question && item.answer)
}

export async function GET(request: NextRequest) {
  try {
    const context = await requirePlannerMarketplace(request)
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM public."PlannerProfile" WHERE "businessAccountId" = $1 LIMIT 1`,
      context.business.businessAccountId,
    )
    return NextResponse.json({ success: true, business: context.business, profile: rows[0] ?? null })
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

    const yearsExperience = integer(body.yearsExperience, 'Years of experience', 0, 80)
    const completedWeddings = integer(body.completedWeddings, 'Completed weddings', 0, 100000)
    const teamSize = integer(body.teamSize, 'Team size', 1, 10000)
    const minimumGuestCount = integer(body.minimumGuestCount, 'Minimum guest count', 0, 100000)
    const maximumGuestCount = integer(body.maximumGuestCount, 'Maximum guest count', 0, 100000)
    if (minimumGuestCount !== null && maximumGuestCount !== null && minimumGuestCount > maximumGuestCount) {
      throw new MarketplaceAccessError('Guest range is invalid.', 400)
    }

    const priceBand = typeof body.priceBand === 'string' && PRICE_BANDS.has(body.priceBand) ? body.priceBand : 'contact'
    const availabilityStatus = typeof body.availabilityStatus === 'string' && AVAILABILITY.has(body.availabilityStatus) ? body.availabilityStatus : 'accepting'
    const portfolio = httpsPortfolio(body.portfolio)
    const details = profileDetails(body.profileDetails)
    const packageRows = packages(body.packages)
    const faqRows = faq(body.faq)

    const existing = await db.$queryRawUnsafe<Array<{ id: string; status: string; slug: string }>>(
      `SELECT id, status, slug FROM public."PlannerProfile" WHERE "businessAccountId" = $1 LIMIT 1`,
      context.business.businessAccountId,
    )
    const slugOwner = await db.$queryRawUnsafe<Array<{ businessAccountId: string }>>(
      `SELECT "businessAccountId" FROM public."PlannerProfile" WHERE slug = $1 LIMIT 1`, requestedSlug,
    )
    if (slugOwner[0] && slugOwner[0].businessAccountId !== context.business.businessAccountId) {
      throw new MarketplaceAccessError('That public planner URL is already in use.', 409)
    }

    const profileId = existing[0]?.id ?? marketplaceId('planner-profile')
    const status = existing[0]?.status === 'suspended' ? 'suspended' : 'draft'
    if (status === 'suspended') throw new MarketplaceAccessError('This planner profile is suspended and cannot be edited.', 403)

    await db.$executeRawUnsafe(
      `INSERT INTO wewed_admin."PlannerProfile" (
         id, "businessAccountId", slug, "displayName", headline, bio,
         "yearsExperience", "completedWeddings", "teamSize", "serviceAreas", services, "weddingStyles", languages,
         "priceBand", "minimumGuestCount", "maximumGuestCount", "availabilityStatus", portfolio,
         "profileDetails", packages, faq, status, "reviewNotes", "publishedAt", "lastProfileUpdate", "updatedAt"
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,
         $14,$15,$16,$17,$18::jsonb,$19::jsonb,$20::jsonb,$21::jsonb,$22,NULL,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
       )
       ON CONFLICT ("businessAccountId") DO UPDATE SET
         slug=EXCLUDED.slug,"displayName"=EXCLUDED."displayName",headline=EXCLUDED.headline,bio=EXCLUDED.bio,
         "yearsExperience"=EXCLUDED."yearsExperience","completedWeddings"=EXCLUDED."completedWeddings","teamSize"=EXCLUDED."teamSize",
         "serviceAreas"=EXCLUDED."serviceAreas",services=EXCLUDED.services,"weddingStyles"=EXCLUDED."weddingStyles",languages=EXCLUDED.languages,
         "priceBand"=EXCLUDED."priceBand","minimumGuestCount"=EXCLUDED."minimumGuestCount","maximumGuestCount"=EXCLUDED."maximumGuestCount",
         "availabilityStatus"=EXCLUDED."availabilityStatus",portfolio=EXCLUDED.portfolio,"profileDetails"=EXCLUDED."profileDetails",
         packages=EXCLUDED.packages,faq=EXCLUDED.faq,status=EXCLUDED.status,"reviewNotes"=NULL,"publishedAt"=NULL,
         "lastProfileUpdate"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP`,
      profileId,
      context.business.businessAccountId,
      requestedSlug,
      displayName,
      text(body.headline, 180),
      text(body.bio, 4000),
      yearsExperience,
      completedWeddings,
      teamSize,
      JSON.stringify(stringList(body.serviceAreas, 30)),
      JSON.stringify(stringList(body.services, 30)),
      JSON.stringify(stringList(body.weddingStyles, 30)),
      JSON.stringify(stringList(body.languages, 20)),
      priceBand,
      minimumGuestCount,
      maximumGuestCount,
      availabilityStatus,
      JSON.stringify(portfolio),
      JSON.stringify(details),
      JSON.stringify(packageRows),
      JSON.stringify(faqRows),
      status,
    )

    await marketplaceAudit({
      actorUserId: context.user.id,
      businessAccountId: context.business.businessAccountId,
      action: existing[0] ? 'planner_profile.updated' : 'planner_profile.created',
      resourceType: 'planner_profile',
      resourceId: profileId,
      details: { previousStatus: existing[0]?.status ?? null, status, packages: packageRows.length, faq: faqRows.length },
    })

    return NextResponse.json({ success: true, profileId, status })
  } catch (error) {
    return marketplaceErrorResponse(error)
  }
}

export const dynamic = 'force-dynamic'
