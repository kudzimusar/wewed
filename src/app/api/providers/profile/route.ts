import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createServerClient } from '@/lib/supabase/server'
import { marketplaceAudit, stringList, text } from '@/lib/marketplace-access'
import { PROVIDER_CATEGORY_VALUES, providerServiceFields } from '@/lib/provider-catalog'
import {
  AVAILABILITY_MODE_OPTIONS,
  CHARGE_TYPE_OPTIONS,
  DEPOSIT_TYPE_OPTIONS,
  PRICE_COMPONENT_TYPES,
  PRICING_VISIBILITY_OPTIONS,
  calculateCommercialReadiness,
  calculatePackageCompletion,
} from '@/lib/provider-commercial'

const VISIBILITY = new Set(['draft', 'published'])
const OFFERING_STATUS = new Set(['draft', 'published'])
const CURRENCIES = new Set(['USD', 'ZAR', 'GBP', 'EUR', 'BWP', 'ZMW', 'MZN'])
const PRICING_VISIBILITY = new Set<string>(PRICING_VISIBILITY_OPTIONS)
const AVAILABILITY_MODES = new Set<string>(AVAILABILITY_MODE_OPTIONS)
const CHARGE_TYPES = new Set<string>(CHARGE_TYPE_OPTIONS)
const DEPOSIT_TYPES = new Set<string>(DEPOSIT_TYPE_OPTIONS)
const PRICE_COMPONENT_TYPE_SET = new Set<string>(PRICE_COMPONENT_TYPES)

type ProviderBusiness = {
  businessAccountId: string
  businessName: string
  businessSlug: string
  businessType: 'venue' | 'vendor'
  metadata: Record<string, unknown> | null
  userId: string
}

type ProviderProfileInput = Record<string, unknown>
type OfferingInput = Record<string, unknown>

function errorResponse(message: string, status: 400 | 401 | 403 | 404 | 409 | 500) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function nullableInteger(value: unknown, label: string, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${label} must be between ${min} and ${max}.`)
  return number
}

function moneyCents(value: unknown, label: string): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > 100000000) throw new Error(`${label} is invalid.`)
  return Math.round(number * 100)
}

function httpsUrl(value: unknown, label: string): string | null {
  const normalized = text(value, 1000)
  if (!normalized) return null
  try {
    const url = new URL(normalized)
    if (url.protocol !== 'https:') throw new Error('not https')
    return url.toString()
  } catch {
    throw new Error(`${label} must be a valid HTTPS URL.`)
  }
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function decimalText(value: unknown, label: string, maxWholeDigits = 9): string | null {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).trim()
  const pattern = new RegExp('^\\d{1,' + maxWholeDigits + '}(?:\\.\\d{1,2})?$')
  if (!pattern.test(normalized)) {
    throw new Error(`${label} must be a non-negative amount with at most two decimal places.`)
  }
  return normalized
}

function dateValue(value: unknown, label: string): Date | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = new Date(String(value))
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${label} is invalid.`)
  return parsed
}

function normalizeCommercialTerms(value: unknown): Record<string, unknown> {
  const source = jsonObject(value)
  const taxIncluded = source.taxIncluded === true || source.taxIncluded === 'true'
    ? true
    : source.taxIncluded === false || source.taxIncluded === 'false'
      ? false
      : null
  const serviceChargeType = typeof source.serviceChargeType === 'string' && CHARGE_TYPES.has(source.serviceChargeType)
    ? source.serviceChargeType
    : 'none'
  const depositType = typeof source.depositType === 'string' && DEPOSIT_TYPES.has(source.depositType)
    ? source.depositType
    : 'none'
  const availabilityMode = typeof source.availabilityMode === 'string' && AVAILABILITY_MODES.has(source.availabilityMode)
    ? source.availabilityMode
    : 'request'
  return {
    minimumSpend: decimalText(source.minimumSpend, 'Minimum spend'),
    includedQuantity: nullableInteger(source.includedQuantity, 'Included quantity', 0, 1000000),
    incrementalUnitPrice: decimalText(source.incrementalUnitPrice, 'Incremental unit price'),
    minimumBillableQuantity: nullableInteger(source.minimumBillableQuantity, 'Minimum billable quantity', 0, 1000000),
    billingIncrement: nullableInteger(source.billingIncrement, 'Billing increment', 1, 1000000),
    setupFee: decimalText(source.setupFee, 'Setup fee'),
    deliveryFee: decimalText(source.deliveryFee, 'Delivery fee'),
    includedTravelKm: nullableInteger(source.includedTravelKm, 'Included travel', 0, 50000),
    travelFeePerKm: decimalText(source.travelFeePerKm, 'Travel fee per kilometre'),
    overtimeRate: decimalText(source.overtimeRate, 'Overtime rate'),
    overtimeUnit: text(source.overtimeUnit, 80),
    taxIncluded,
    taxPercentage: decimalText(source.taxPercentage, 'Tax percentage', 3),
    serviceChargeType,
    serviceChargeValue: decimalText(source.serviceChargeValue, 'Service charge value'),
    depositType,
    depositValue: decimalText(source.depositValue, 'Deposit value'),
    balanceDueRule: text(source.balanceDueRule, 500),
    availabilityMode,
  }
}

function normalizePriceComponents(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.slice(0, 60).map((entry, index) => {
    const row = jsonObject(entry)
    const type = typeof row.type === 'string' && PRICE_COMPONENT_TYPE_SET.has(row.type) ? row.type : 'fixed'
    return {
      id: text(row.id, 160) || `component-${index + 1}`,
      label: text(row.label, 160) || `Price component ${index + 1}`,
      type,
      amount: decimalText(row.amount, 'Price component amount'),
      unit: text(row.unit, 80),
      condition: text(row.condition, 500),
      minimumQuantity: nullableInteger(row.minimumQuantity, 'Price component minimum quantity', 0, 1000000),
      maximumQuantity: nullableInteger(row.maximumQuantity, 'Price component maximum quantity', 0, 1000000),
    }
  }).filter((entry) => entry.amount !== null)
}

function normalizeFaq(value: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value)) return []
  return value.slice(0, 20).map((entry) => {
    const row = jsonObject(entry)
    return { question: text(row.question, 240) ?? '', answer: text(row.answer, 2000) ?? '' }
  }).filter((entry) => entry.question && entry.answer)
}

function normalizeSocialLinks(value: unknown): Record<string, string> {
  const source = jsonObject(value)
  const output: Record<string, string> = {}
  for (const key of ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'primary']) {
    if (!source[key]) continue
    const url = httpsUrl(source[key], `${key} link`)
    if (url) output[key] = url
  }
  return output
}

function normalizeDetails(category: string, value: unknown): Record<string, unknown> {
  const source = jsonObject(value)
  const output: Record<string, unknown> = {}
  for (const field of providerServiceFields(category)) {
    const raw = source[field.key]
    if (field.type === 'checkboxes' || field.type === 'multiselect') {
      output[field.key] = stringList(raw, 50)
      continue
    }
    if (field.type === 'number') {
      output[field.key] = nullableInteger(raw, field.label, field.min ?? 0, field.max ?? 1000000)
      continue
    }
    if (field.type === 'boolean') {
      output[field.key] = raw === true || raw === 'true'
      continue
    }
    output[field.key] = text(raw, field.type === 'textarea' ? 4000 : 300)
  }
  return output
}

function profileCompletion(profile: ProviderProfileInput): number {
  const checks = [
    text(profile.displayName, 160),
    text(profile.headline, 180),
    text(profile.description, 4000),
    text(profile.country, 120),
    text(profile.city, 120),
    stringList(profile.serviceAreas, 50).length > 0,
    stringList(profile.languages, 30).length > 0,
    text(profile.phone, 80) || text(profile.publicEmail, 180),
    profile.coverImageUrl,
    profile.yearsOperating !== null && profile.yearsOperating !== '' && profile.yearsOperating !== undefined,
    profile.responseTime,
    profile.minimumBookingNotice,
    stringList(profile.paymentMethods, 20).length > 0,
    profile.depositPolicy,
    profile.cancellationPolicy,
  ]
  return Math.round(checks.filter(Boolean).length / checks.length * 100)
}

function offeringCompletion(category: string, offering: OfferingInput, details: Record<string, unknown>): number {
  const common = [
    text(offering.displayName, 160),
    text(offering.description, 3000),
    offering.startingPrice !== null && offering.startingPrice !== '' && offering.startingPrice !== undefined,
    text(offering.pricingModel, 120),
    text(offering.bookingLeadTime, 160),
    stringList(offering.serviceAreas, 50).length > 0,
    stringList(offering.inclusions, 50).length > 0,
  ]
  const requiredFields = providerServiceFields(category).filter((field) => field.required)
  const requiredChecks = requiredFields.map((field) => {
    const value = details[field.key]
    return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== ''
  })
  const checks = [...common, ...requiredChecks]
  return Math.round(checks.filter(Boolean).length / Math.max(checks.length, 1) * 100)
}

async function providerContext(): Promise<ProviderBusiness | null | 'signed-out'> {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user?.email) return 'signed-out'

  const rows = await db.$queryRawUnsafe<ProviderBusiness[]>(
    `SELECT ba.id AS "businessAccountId", ba.name AS "businessName", ba.slug AS "businessSlug", ba.type AS "businessType", ba.metadata, u.id AS "userId"
     FROM public."User" u
     JOIN public."BusinessAccountMember" bam ON bam."userId" = u.id AND bam.status = 'active'
     JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId" AND ba.type IN ('venue', 'vendor') AND ba.status = 'active' AND ba."onboardingStatus" = 'complete'
     WHERE lower(u.email) = lower($1) AND u."isActive" = true
     ORDER BY CASE bam.role WHEN 'business_owner' THEN 0 ELSE 1 END, ba."createdAt"
     LIMIT 1`,
    user.email,
  )
  return rows[0] ?? null
}

function legacyProfile(context: ProviderBusiness) {
  const metadata = context.metadata && typeof context.metadata === 'object' ? context.metadata : {}
  const stored = metadata.publicProfile && typeof metadata.publicProfile === 'object' ? metadata.publicProfile as Record<string, unknown> : {}
  const category = typeof stored.category === 'string' && PROVIDER_CATEGORY_VALUES.has(stored.category)
    ? stored.category
    : context.businessType === 'venue' ? 'venue' : 'other'
  return {
    id: null,
    businessAccountId: context.businessAccountId,
    slug: context.businessSlug,
    displayName: typeof stored.displayName === 'string' ? stored.displayName : context.businessName,
    headline: typeof stored.headline === 'string' ? stored.headline : '',
    description: typeof stored.description === 'string' ? stored.description : '',
    country: '', city: '', serviceAreas: stringList(stored.serviceAreas, 50), languages: [], publicEmail: '',
    phone: typeof stored.phone === 'string' ? stored.phone : '', website: typeof stored.website === 'string' ? stored.website : '',
    socialLinks: {}, yearsOperating: null, teamSize: null, responseTime: '', minimumBookingNotice: '', travelRadiusKm: null,
    paymentMethods: [], depositPolicy: '', cancellationPolicy: '', refundPolicy: '', travelPolicy: '', accessibilitySupport: '', culturalExperience: '',
    coverImageUrl: typeof stored.imageUrl === 'string' ? stored.imageUrl : '', faq: [], verificationBadges: [],
    visibility: stored.visibility === 'published' ? 'published' : 'draft', completionScore: 0, lastProfileUpdate: null,
    legacyCategory: category,
  }
}

export async function GET() {
  try {
    const context = await providerContext()
    if (context === 'signed-out') return errorResponse('Sign in with your approved provider account.', 401)
    if (!context) return errorResponse('No active venue or vendor business is connected to this account.', 403)

    const profiles = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM public."ProviderProfile" WHERE "businessAccountId" = $1 LIMIT 1`, context.businessAccountId,
    )
    const verification = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "legalName", "registrationNumber", "taxNumber", "representativeName", "physicalAddress", "secondaryContact", "identityStatus", "businessStatus", "insuranceStatus", "permitStatus", "reviewedAt"
       FROM wewed_admin."ProviderVerification" WHERE "businessAccountId" = $1 LIMIT 1`, context.businessAccountId,
    )
    const offerings = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM public."ProviderServiceOffering" WHERE "businessAccountId" = $1 ORDER BY "createdAt", category`, context.businessAccountId,
    )
    const packages = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT pp.* FROM public."ProviderPackage" pp JOIN public."ProviderServiceOffering" o ON o.id = pp."offeringId" WHERE o."businessAccountId" = $1 ORDER BY pp."offeringId", pp."sortOrder"`, context.businessAccountId,
    )
    const portfolio = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT pi.* FROM public."ProviderPortfolioItem" pi JOIN public."ProviderServiceOffering" o ON o.id = pi."offeringId" WHERE o."businessAccountId" = $1 ORDER BY pi."offeringId", pi."sortOrder"`, context.businessAccountId,
    )
    const enquiries = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT e.*, o.category, o."displayName" AS "offeringName", w.title AS "weddingTitle"
       FROM public."ProviderEnquiry" e
       JOIN public."ProviderServiceOffering" o ON o.id = e."offeringId"
       JOIN public."Wedding" w ON w.id = e."weddingId"
       WHERE e."providerBusinessAccountId" = $1 ORDER BY e."createdAt" DESC LIMIT 100`, context.businessAccountId,
    )

    const normalizedProfile = profiles[0] ?? legacyProfile(context)
    const normalizedOfferings = offerings.length > 0 ? offerings : [{
      id: null,
      businessAccountId: context.businessAccountId,
      category: (normalizedProfile as Record<string, unknown>).legacyCategory ?? (context.businessType === 'venue' ? 'venue' : 'other'),
      displayName: normalizedProfile.displayName,
      description: normalizedProfile.description,
      status: normalizedProfile.visibility,
      startingPriceCents: null,
      maximumPriceCents: null,
      currency: 'USD',
      pricingModel: '',
      minimumCapacity: null,
      maximumCapacity: null,
      bookingLeadTime: '',
      serviceAreas: normalizedProfile.serviceAreas,
      inclusions: [],
      details: {},
      completionScore: 0,
    }]

    return NextResponse.json({
      success: true,
      business: { id: context.businessAccountId, name: context.businessName, slug: context.businessSlug, type: context.businessType },
      profile: normalizedProfile,
      verification: verification[0] ?? null,
      offerings: normalizedOfferings.map((offering) => ({
        ...offering,
        packages: packages.filter((entry) => entry.offeringId === offering.id),
        portfolio: portfolio.filter((entry) => entry.offeringId === offering.id),
      })),
      enquiries,
    })
  } catch (error) {
    console.error('[providers/profile] GET error:', error)
    return errorResponse('Unable to load the provider profile.', 500)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await providerContext()
    if (context === 'signed-out') return errorResponse('Sign in with your approved provider account.', 401)
    if (!context) return errorResponse('No active venue or vendor business is connected to this account.', 403)

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return errorResponse('Invalid provider profile request.', 400)
    const profileInput = jsonObject(body.profile && typeof body.profile === 'object' ? body.profile : body)
    const verificationInput = jsonObject(body.verification)
    const offeringInputs = Array.isArray(body.offerings) ? body.offerings.map(jsonObject).slice(0, 12) : []

    const displayName = text(profileInput.displayName, 160) ?? context.businessName
    const slug = (text(profileInput.slug, 100) ?? context.businessSlug).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70)
    if (!slug) return errorResponse('A valid public profile URL is required.', 400)
    const slugOwner = await db.$queryRawUnsafe<Array<{ businessAccountId: string }>>(`SELECT "businessAccountId" FROM public."ProviderProfile" WHERE slug = $1 LIMIT 1`, slug)
    if (slugOwner[0] && slugOwner[0].businessAccountId !== context.businessAccountId) return errorResponse('That provider profile URL is already in use.', 409)

    let profile: Record<string, unknown>
    try {
      const visibility = typeof profileInput.visibility === 'string' && VISIBILITY.has(profileInput.visibility) ? profileInput.visibility : 'draft'
      profile = {
        displayName,
        slug,
        headline: text(profileInput.headline, 180),
        description: text(profileInput.description, 4000),
        country: text(profileInput.country, 120),
        city: text(profileInput.city, 120),
        serviceAreas: stringList(profileInput.serviceAreas, 50),
        languages: stringList(profileInput.languages, 30),
        publicEmail: text(profileInput.publicEmail, 180),
        phone: text(profileInput.phone, 80),
        website: httpsUrl(profileInput.website, 'Website'),
        socialLinks: normalizeSocialLinks(profileInput.socialLinks),
        yearsOperating: nullableInteger(profileInput.yearsOperating, 'Years operating', 0, 300),
        teamSize: nullableInteger(profileInput.teamSize, 'Team size', 1, 10000),
        responseTime: text(profileInput.responseTime, 160),
        minimumBookingNotice: text(profileInput.minimumBookingNotice, 160),
        travelRadiusKm: nullableInteger(profileInput.travelRadiusKm, 'Travel radius', 0, 50000),
        paymentMethods: stringList(profileInput.paymentMethods, 20),
        depositPolicy: text(profileInput.depositPolicy, 2000),
        cancellationPolicy: text(profileInput.cancellationPolicy, 3000),
        refundPolicy: text(profileInput.refundPolicy, 3000),
        travelPolicy: text(profileInput.travelPolicy, 3000),
        accessibilitySupport: text(profileInput.accessibilitySupport, 2000),
        culturalExperience: text(profileInput.culturalExperience, 2000),
        coverImageUrl: httpsUrl(profileInput.coverImageUrl, 'Cover image'),
        faq: normalizeFaq(profileInput.faq),
        visibility,
      }
      profile.completionScore = profileCompletion(profile)
      if (visibility === 'published' && Number(profile.completionScore) < 60) return errorResponse('Complete at least 60% of the company profile before publishing.', 400)
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Provider profile is invalid.', 400)
    }

    const normalizedOfferings: Array<Record<string, unknown>> = []
    try {
      for (const input of offeringInputs) {
        const category = typeof input.category === 'string' && PROVIDER_CATEGORY_VALUES.has(input.category) ? input.category : null
        if (!category) throw new Error('Every service offering must use a valid category.')
        if (context.businessType === 'venue' && category !== 'venue') throw new Error('A venue account may publish only the venue category.')
        if (normalizedOfferings.some((offering) => offering.category === category)) throw new Error('Each service category may appear only once.')
        const details = normalizeDetails(category, input.details)
        const startingPriceCents = moneyCents(input.startingPrice, 'Starting price')
        const maximumPriceCents = moneyCents(input.maximumPrice, 'Maximum price')
        if (startingPriceCents !== null && maximumPriceCents !== null && startingPriceCents > maximumPriceCents) throw new Error('Starting price cannot exceed maximum price.')
        const minimumCapacity = nullableInteger(input.minimumCapacity, 'Minimum capacity', 0, 100000)
        const maximumCapacity = nullableInteger(input.maximumCapacity, 'Maximum capacity', 0, 100000)
        if (minimumCapacity !== null && maximumCapacity !== null && minimumCapacity > maximumCapacity) throw new Error('Minimum capacity cannot exceed maximum capacity.')
        const status = typeof input.status === 'string' && OFFERING_STATUS.has(input.status) ? input.status : 'draft'
        const pricingVisibility = typeof input.pricingVisibility === 'string' && PRICING_VISIBILITY.has(input.pricingVisibility) ? input.pricingVisibility : 'quote_only'
        const commercialTerms = normalizeCommercialTerms(input.commercialTerms)
        const priceComponents = normalizePriceComponents(input.priceComponents)
        const priceValidFrom = dateValue(input.priceValidFrom, 'Price valid from')
        const priceValidUntil = dateValue(input.priceValidUntil, 'Price valid until')
        if (priceValidFrom && priceValidUntil && priceValidFrom > priceValidUntil) throw new Error('Price valid from cannot be after price valid until.')
        const commercialConfirmed = input.confirmCommercialPricing === true || Boolean(input.ownerConfirmedCommercialAt)
        const offering = {
          id: text(input.id, 160) || `provider-offering-${randomUUID()}`,
          category,
          displayName: text(input.displayName, 160) ?? `${displayName} — ${category}`,
          description: text(input.description, 3000),
          status,
          startingPriceCents,
          maximumPriceCents,
          currency: typeof input.currency === 'string' && CURRENCIES.has(input.currency) ? input.currency : 'USD',
          pricingModel: text(input.pricingModel, 120),
          pricingVisibility,
          commercialTerms,
          priceComponents,
          priceValidFrom,
          priceValidUntil,
          confirmCommercialPricing: input.confirmCommercialPricing === true,
          ownerConfirmedCommercialAt: text(input.ownerConfirmedCommercialAt, 100),
          minimumCapacity,
          maximumCapacity,
          bookingLeadTime: text(input.bookingLeadTime, 160),
          serviceAreas: stringList(input.serviceAreas, 50),
          inclusions: stringList(input.inclusions, 50),
          details,
          packages: Array.isArray(input.packages) ? input.packages.slice(0, 20).map(jsonObject) : [],
          portfolio: Array.isArray(input.portfolio) ? input.portfolio.slice(0, 30).map(jsonObject) : [],
        }
        offering.completionScore = offeringCompletion(category, input, details)
        const readiness = calculateCommercialReadiness({
          ...offering,
          serviceAreas: offering.serviceAreas,
          packages: offering.packages,
          commercialConfirmed,
        })
        Object.assign(offering, {
          aiReadinessScore: readiness.score,
          aiReadinessStatus: readiness.status,
          aiReadinessMissing: readiness.missing,
        })
        if (status === 'published' && Number(offering.completionScore) < 60) throw new Error(`Complete at least 60% of the ${category} offering before publishing.`)
        normalizedOfferings.push(offering)
      }
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Service offering is invalid.', 400)
    }

    if (normalizedOfferings.length === 0) return errorResponse('Add at least one service offering.', 400)

    const existingProfile = await db.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM public."ProviderProfile" WHERE "businessAccountId" = $1 LIMIT 1`, context.businessAccountId)
    const profileId = existingProfile[0]?.id ?? `provider-profile-${randomUUID()}`

    await db.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        `INSERT INTO wewed_admin."ProviderProfile" (
          id, "businessAccountId", slug, "displayName", headline, description, country, city, "serviceAreas", languages,
          "publicEmail", phone, website, "socialLinks", "yearsOperating", "teamSize", "responseTime", "minimumBookingNotice", "travelRadiusKm",
          "paymentMethods", "depositPolicy", "cancellationPolicy", "refundPolicy", "travelPolicy", "accessibilitySupport", "culturalExperience",
          "coverImageUrl", faq, "visibility", "completionScore", "publishedAt", "lastProfileUpdate", "updatedAt"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20::jsonb,$21,$22,$23,$24,$25,$26,$27,$28::jsonb,$29,$30,CASE WHEN $29='published' THEN CURRENT_TIMESTAMP ELSE NULL END,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        ON CONFLICT ("businessAccountId") DO UPDATE SET
          slug=EXCLUDED.slug,"displayName"=EXCLUDED."displayName",headline=EXCLUDED.headline,description=EXCLUDED.description,country=EXCLUDED.country,city=EXCLUDED.city,
          "serviceAreas"=EXCLUDED."serviceAreas",languages=EXCLUDED.languages,"publicEmail"=EXCLUDED."publicEmail",phone=EXCLUDED.phone,website=EXCLUDED.website,"socialLinks"=EXCLUDED."socialLinks",
          "yearsOperating"=EXCLUDED."yearsOperating","teamSize"=EXCLUDED."teamSize","responseTime"=EXCLUDED."responseTime","minimumBookingNotice"=EXCLUDED."minimumBookingNotice","travelRadiusKm"=EXCLUDED."travelRadiusKm",
          "paymentMethods"=EXCLUDED."paymentMethods","depositPolicy"=EXCLUDED."depositPolicy","cancellationPolicy"=EXCLUDED."cancellationPolicy","refundPolicy"=EXCLUDED."refundPolicy","travelPolicy"=EXCLUDED."travelPolicy",
          "accessibilitySupport"=EXCLUDED."accessibilitySupport","culturalExperience"=EXCLUDED."culturalExperience","coverImageUrl"=EXCLUDED."coverImageUrl",faq=EXCLUDED.faq,
          "visibility"=EXCLUDED."visibility","completionScore"=EXCLUDED."completionScore","publishedAt"=CASE WHEN EXCLUDED."visibility"='published' THEN COALESCE(wewed_admin."ProviderProfile"."publishedAt",CURRENT_TIMESTAMP) ELSE NULL END,
          "lastProfileUpdate"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP`,
        profileId, context.businessAccountId, profile.slug, profile.displayName, profile.headline, profile.description, profile.country, profile.city,
        JSON.stringify(profile.serviceAreas), JSON.stringify(profile.languages), profile.publicEmail, profile.phone, profile.website, JSON.stringify(profile.socialLinks),
        profile.yearsOperating, profile.teamSize, profile.responseTime, profile.minimumBookingNotice, profile.travelRadiusKm, JSON.stringify(profile.paymentMethods),
        profile.depositPolicy, profile.cancellationPolicy, profile.refundPolicy, profile.travelPolicy, profile.accessibilitySupport, profile.culturalExperience,
        profile.coverImageUrl, JSON.stringify(profile.faq), profile.visibility, profile.completionScore,
      )

      await transaction.$executeRawUnsafe(
        `INSERT INTO wewed_admin."ProviderVerification" (id,"businessAccountId","legalName","registrationNumber","taxNumber","representativeName","physicalAddress","secondaryContact","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP)
         ON CONFLICT ("businessAccountId") DO UPDATE SET "legalName"=EXCLUDED."legalName","registrationNumber"=EXCLUDED."registrationNumber","taxNumber"=EXCLUDED."taxNumber","representativeName"=EXCLUDED."representativeName","physicalAddress"=EXCLUDED."physicalAddress","secondaryContact"=EXCLUDED."secondaryContact","updatedAt"=CURRENT_TIMESTAMP`,
        `provider-verification-${randomUUID()}`, context.businessAccountId, text(verificationInput.legalName, 200), text(verificationInput.registrationNumber, 160),
        text(verificationInput.taxNumber, 160), text(verificationInput.representativeName, 160), text(verificationInput.physicalAddress, 1000), text(verificationInput.secondaryContact, 240),
      )

      for (const offering of normalizedOfferings) {
        const owned = await transaction.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM wewed_admin."ProviderServiceOffering" WHERE id=$1 AND "businessAccountId"=$2 LIMIT 1`, offering.id, context.businessAccountId,
        )
        const offeringId = owned[0]?.id ?? String(offering.id)
        await transaction.$executeRawUnsafe(
          `INSERT INTO wewed_admin."ProviderServiceOffering" (id,"businessAccountId",category,"displayName",description,status,"startingPriceCents","maximumPriceCents",currency,"pricingModel","minimumCapacity","maximumCapacity","bookingLeadTime","serviceAreas",inclusions,details,"completionScore","pricingVisibility","commercialTerms","priceComponents","priceValidFrom","priceValidUntil","ownerConfirmedCommercialAt","aiReadinessScore","aiReadinessStatus","aiReadinessMissing","publishedAt","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::jsonb,$17,$18,$19::jsonb,$20::jsonb,$21,$22,CASE WHEN $23 THEN CURRENT_TIMESTAMP ELSE NULL END,$24,$25,$26::jsonb,CASE WHEN $6='published' THEN CURRENT_TIMESTAMP ELSE NULL END,CURRENT_TIMESTAMP)
           ON CONFLICT ("businessAccountId",category) DO UPDATE SET "displayName"=EXCLUDED."displayName",description=EXCLUDED.description,status=EXCLUDED.status,"startingPriceCents"=EXCLUDED."startingPriceCents","maximumPriceCents"=EXCLUDED."maximumPriceCents",currency=EXCLUDED.currency,"pricingModel"=EXCLUDED."pricingModel","minimumCapacity"=EXCLUDED."minimumCapacity","maximumCapacity"=EXCLUDED."maximumCapacity","bookingLeadTime"=EXCLUDED."bookingLeadTime","serviceAreas"=EXCLUDED."serviceAreas",inclusions=EXCLUDED.inclusions,details=EXCLUDED.details,"completionScore"=EXCLUDED."completionScore","pricingVisibility"=EXCLUDED."pricingVisibility","commercialTerms"=EXCLUDED."commercialTerms","priceComponents"=EXCLUDED."priceComponents","priceValidFrom"=EXCLUDED."priceValidFrom","priceValidUntil"=EXCLUDED."priceValidUntil","ownerConfirmedCommercialAt"=CASE WHEN $23 THEN CURRENT_TIMESTAMP ELSE wewed_admin."ProviderServiceOffering"."ownerConfirmedCommercialAt" END,"aiReadinessScore"=EXCLUDED."aiReadinessScore","aiReadinessStatus"=EXCLUDED."aiReadinessStatus","aiReadinessMissing"=EXCLUDED."aiReadinessMissing","publishedAt"=CASE WHEN EXCLUDED.status='published' THEN COALESCE(wewed_admin."ProviderServiceOffering"."publishedAt",CURRENT_TIMESTAMP) ELSE NULL END,"updatedAt"=CURRENT_TIMESTAMP`,
          offeringId, context.businessAccountId, offering.category, offering.displayName, offering.description, offering.status, offering.startingPriceCents, offering.maximumPriceCents,
          offering.currency, offering.pricingModel, offering.minimumCapacity, offering.maximumCapacity, offering.bookingLeadTime, JSON.stringify(offering.serviceAreas), JSON.stringify(offering.inclusions), JSON.stringify(offering.details), offering.completionScore,
          offering.pricingVisibility, JSON.stringify(offering.commercialTerms), JSON.stringify(offering.priceComponents), offering.priceValidFrom, offering.priceValidUntil, offering.confirmCommercialPricing, offering.aiReadinessScore, offering.aiReadinessStatus, JSON.stringify(offering.aiReadinessMissing),
        )
        const savedOffering = await transaction.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM wewed_admin."ProviderServiceOffering" WHERE "businessAccountId"=$1 AND category=$2 LIMIT 1`, context.businessAccountId, offering.category)
        const savedOfferingId = savedOffering[0]?.id
        if (!savedOfferingId) throw new Error('Unable to save service offering.')

        await transaction.$executeRawUnsafe(`DELETE FROM wewed_admin."ProviderPackage" WHERE "offeringId"=$1`, savedOfferingId)
        for (const [index, packageInput] of (offering.packages as OfferingInput[]).entries()) {
          const packageName = text(packageInput.name, 160)
          if (!packageName) continue
          const packageCommercialTerms = normalizeCommercialTerms(packageInput.commercialTerms)
          const packagePriceComponents = normalizePriceComponents(packageInput.priceComponents)
          const packagePriceValidFrom = dateValue(packageInput.priceValidFrom, 'Package price valid from')
          const packagePriceValidUntil = dateValue(packageInput.priceValidUntil, 'Package price valid until')
          if (packagePriceValidFrom && packagePriceValidUntil && packagePriceValidFrom > packagePriceValidUntil) throw new Error('Package price valid from cannot be after package price valid until.')
          const packageCompletion = calculatePackageCompletion({
            ...packageInput,
            commercialTerms: packageCommercialTerms,
            priceComponents: packagePriceComponents,
          })
          await transaction.$executeRawUnsafe(
            `INSERT INTO wewed_admin."ProviderPackage" (id,"offeringId",name,description,"priceCents",currency,"pricingUnit",inclusions,"sortOrder","isActive","minimumQuantity","maximumQuantity","includedQuantity","additionalUnitPriceCents",exclusions,"requiredAddOns","optionalAddOns","commercialTerms","priceComponents","priceValidFrom","priceValidUntil","completionScore") VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,true,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19,$20,$21)`,
            `provider-package-${randomUUID()}`, savedOfferingId, packageName, text(packageInput.description, 2000), moneyCents(packageInput.price, 'Package price'),
            typeof packageInput.currency === 'string' && CURRENCIES.has(packageInput.currency) ? packageInput.currency : offering.currency,
            text(packageInput.pricingUnit, 120), JSON.stringify(stringList(packageInput.inclusions, 50)), index,
            nullableInteger(packageInput.minimumQuantity, 'Package minimum quantity', 0, 1000000), nullableInteger(packageInput.maximumQuantity, 'Package maximum quantity', 0, 1000000),
            nullableInteger(packageInput.includedQuantity, 'Package included quantity', 0, 1000000), moneyCents(packageInput.additionalUnitPrice, 'Package additional unit price'),
            JSON.stringify(stringList(packageInput.exclusions, 50)), JSON.stringify(stringList(packageInput.requiredAddOns, 50)), JSON.stringify(stringList(packageInput.optionalAddOns, 50)),
            JSON.stringify(packageCommercialTerms), JSON.stringify(packagePriceComponents), packagePriceValidFrom, packagePriceValidUntil, packageCompletion,
          )
        }

        await transaction.$executeRawUnsafe(`DELETE FROM wewed_admin."ProviderPortfolioItem" WHERE "offeringId"=$1`, savedOfferingId)
        for (const [index, itemInput] of (offering.portfolio as OfferingInput[]).entries()) {
          const url = httpsUrl(itemInput.url, 'Portfolio item')
          if (!url) continue
          const type = ['image', 'video', 'link'].includes(String(itemInput.type)) ? String(itemInput.type) : 'image'
          await transaction.$executeRawUnsafe(
            `INSERT INTO wewed_admin."ProviderPortfolioItem" (id,"offeringId",type,url,"thumbnailUrl","altText",caption,"sortOrder","isPublished") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
            `provider-portfolio-${randomUUID()}`, savedOfferingId, type, url, httpsUrl(itemInput.thumbnailUrl, 'Portfolio thumbnail'), text(itemInput.altText, 300), text(itemInput.caption, 1000), index,
          )
        }
      }

      const primary = normalizedOfferings.find((offering) => offering.status === 'published') ?? normalizedOfferings[0]
      const legacy = {
        displayName: profile.displayName,
        headline: profile.headline,
        description: profile.description,
        category: primary.category,
        serviceAreas: profile.serviceAreas,
        services: primary.inclusions,
        website: profile.website,
        phone: profile.phone,
        imageUrl: profile.coverImageUrl,
        visibility: profile.visibility,
        updatedAt: new Date().toISOString(),
      }
      await transaction.$executeRawUnsafe(
        `UPDATE wewed_admin."BusinessAccount" SET metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{publicProfile}',$2::jsonb,true),"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`,
        context.businessAccountId, JSON.stringify(legacy),
      )
    })

    await marketplaceAudit({
      actorUserId: context.userId,
      businessAccountId: context.businessAccountId,
      action: 'provider_profile.normalized_updated',
      resourceType: 'provider_profile',
      resourceId: profileId,
      details: {
        visibility: profile.visibility,
        categories: normalizedOfferings.map((offering) => offering.category),
        completionScore: profile.completionScore,
        aiReadyCategories: normalizedOfferings.filter((offering) => offering.aiReadinessStatus === 'ready').map((offering) => offering.category),
      },
    })

    return NextResponse.json({
      success: true,
      profileId,
      completionScore: profile.completionScore,
      offeringReadiness: normalizedOfferings.map((offering) => ({
        category: offering.category,
        score: offering.aiReadinessScore,
        status: offering.aiReadinessStatus,
        missing: offering.aiReadinessMissing,
      })),
    })
  } catch (error) {
    console.error('[providers/profile] PUT error:', error)
    return errorResponse(error instanceof Error ? error.message : 'Unable to save the provider profile.', 500)
  }
}

export const dynamic = 'force-dynamic'
)
  if (!pattern.test(normalized)) throw new Error(`${label} must be a non-negative amount with at most two decimal places.`)
  return normalized
}

function dateValue(value: unknown, label: string): Date | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = new Date(String(value))
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${label} is invalid.`)
  return parsed
}

function normalizeCommercialTerms(value: unknown): Record<string, unknown> {
  const source = jsonObject(value)
  const taxIncluded = source.taxIncluded === true || source.taxIncluded === 'true'
    ? true
    : source.taxIncluded === false || source.taxIncluded === 'false'
      ? false
      : null
  const serviceChargeType = typeof source.serviceChargeType === 'string' && CHARGE_TYPES.has(source.serviceChargeType)
    ? source.serviceChargeType
    : 'none'
  const depositType = typeof source.depositType === 'string' && DEPOSIT_TYPES.has(source.depositType)
    ? source.depositType
    : 'none'
  const availabilityMode = typeof source.availabilityMode === 'string' && AVAILABILITY_MODES.has(source.availabilityMode)
    ? source.availabilityMode
    : 'request'
  return {
    minimumSpend: decimalText(source.minimumSpend, 'Minimum spend'),
    includedQuantity: nullableInteger(source.includedQuantity, 'Included quantity', 0, 1000000),
    incrementalUnitPrice: decimalText(source.incrementalUnitPrice, 'Incremental unit price'),
    minimumBillableQuantity: nullableInteger(source.minimumBillableQuantity, 'Minimum billable quantity', 0, 1000000),
    billingIncrement: nullableInteger(source.billingIncrement, 'Billing increment', 1, 1000000),
    setupFee: decimalText(source.setupFee, 'Setup fee'),
    deliveryFee: decimalText(source.deliveryFee, 'Delivery fee'),
    includedTravelKm: nullableInteger(source.includedTravelKm, 'Included travel', 0, 50000),
    travelFeePerKm: decimalText(source.travelFeePerKm, 'Travel fee per kilometre'),
    overtimeRate: decimalText(source.overtimeRate, 'Overtime rate'),
    overtimeUnit: text(source.overtimeUnit, 80),
    taxIncluded,
    taxPercentage: decimalText(source.taxPercentage, 'Tax percentage', 3),
    serviceChargeType,
    serviceChargeValue: decimalText(source.serviceChargeValue, 'Service charge value'),
    depositType,
    depositValue: decimalText(source.depositValue, 'Deposit value'),
    balanceDueRule: text(source.balanceDueRule, 500),
    availabilityMode,
  }
}

function normalizePriceComponents(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.slice(0, 60).map((entry, index) => {
    const row = jsonObject(entry)
    const type = typeof row.type === 'string' && PRICE_COMPONENT_TYPE_SET.has(row.type) ? row.type : 'fixed'
    return {
      id: text(row.id, 160) || `component-${index + 1}`,
      label: text(row.label, 160) || `Price component ${index + 1}`,
      type,
      amount: decimalText(row.amount, 'Price component amount'),
      unit: text(row.unit, 80),
      condition: text(row.condition, 500),
      minimumQuantity: nullableInteger(row.minimumQuantity, 'Price component minimum quantity', 0, 1000000),
      maximumQuantity: nullableInteger(row.maximumQuantity, 'Price component maximum quantity', 0, 1000000),
    }
  }).filter((entry) => entry.amount !== null)
}

function normalizeFaq(value: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value)) return []
  return value.slice(0, 20).map((entry) => {
    const row = jsonObject(entry)
    return { question: text(row.question, 240) ?? '', answer: text(row.answer, 2000) ?? '' }
  }).filter((entry) => entry.question && entry.answer)
}

function normalizeSocialLinks(value: unknown): Record<string, string> {
  const source = jsonObject(value)
  const output: Record<string, string> = {}
  for (const key of ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'primary']) {
    if (!source[key]) continue
    const url = httpsUrl(source[key], `${key} link`)
    if (url) output[key] = url
  }
  return output
}

function normalizeDetails(category: string, value: unknown): Record<string, unknown> {
  const source = jsonObject(value)
  const output: Record<string, unknown> = {}
  for (const field of providerServiceFields(category)) {
    const raw = source[field.key]
    if (field.type === 'checkboxes' || field.type === 'multiselect') {
      output[field.key] = stringList(raw, 50)
      continue
    }
    if (field.type === 'number') {
      output[field.key] = nullableInteger(raw, field.label, field.min ?? 0, field.max ?? 1000000)
      continue
    }
    if (field.type === 'boolean') {
      output[field.key] = raw === true || raw === 'true'
      continue
    }
    output[field.key] = text(raw, field.type === 'textarea' ? 4000 : 300)
  }
  return output
}

function profileCompletion(profile: ProviderProfileInput): number {
  const checks = [
    text(profile.displayName, 160),
    text(profile.headline, 180),
    text(profile.description, 4000),
    text(profile.country, 120),
    text(profile.city, 120),
    stringList(profile.serviceAreas, 50).length > 0,
    stringList(profile.languages, 30).length > 0,
    text(profile.phone, 80) || text(profile.publicEmail, 180),
    profile.coverImageUrl,
    profile.yearsOperating !== null && profile.yearsOperating !== '' && profile.yearsOperating !== undefined,
    profile.responseTime,
    profile.minimumBookingNotice,
    stringList(profile.paymentMethods, 20).length > 0,
    profile.depositPolicy,
    profile.cancellationPolicy,
  ]
  return Math.round(checks.filter(Boolean).length / checks.length * 100)
}

function offeringCompletion(category: string, offering: OfferingInput, details: Record<string, unknown>): number {
  const common = [
    text(offering.displayName, 160),
    text(offering.description, 3000),
    offering.startingPrice !== null && offering.startingPrice !== '' && offering.startingPrice !== undefined,
    text(offering.pricingModel, 120),
    text(offering.bookingLeadTime, 160),
    stringList(offering.serviceAreas, 50).length > 0,
    stringList(offering.inclusions, 50).length > 0,
  ]
  const requiredFields = providerServiceFields(category).filter((field) => field.required)
  const requiredChecks = requiredFields.map((field) => {
    const value = details[field.key]
    return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== ''
  })
  const checks = [...common, ...requiredChecks]
  return Math.round(checks.filter(Boolean).length / Math.max(checks.length, 1) * 100)
}

async function providerContext(): Promise<ProviderBusiness | null | 'signed-out'> {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user?.email) return 'signed-out'

  const rows = await db.$queryRawUnsafe<ProviderBusiness[]>(
    `SELECT ba.id AS "businessAccountId", ba.name AS "businessName", ba.slug AS "businessSlug", ba.type AS "businessType", ba.metadata, u.id AS "userId"
     FROM public."User" u
     JOIN public."BusinessAccountMember" bam ON bam."userId" = u.id AND bam.status = 'active'
     JOIN public."BusinessAccount" ba ON ba.id = bam."businessAccountId" AND ba.type IN ('venue', 'vendor') AND ba.status = 'active' AND ba."onboardingStatus" = 'complete'
     WHERE lower(u.email) = lower($1) AND u."isActive" = true
     ORDER BY CASE bam.role WHEN 'business_owner' THEN 0 ELSE 1 END, ba."createdAt"
     LIMIT 1`,
    user.email,
  )
  return rows[0] ?? null
}

function legacyProfile(context: ProviderBusiness) {
  const metadata = context.metadata && typeof context.metadata === 'object' ? context.metadata : {}
  const stored = metadata.publicProfile && typeof metadata.publicProfile === 'object' ? metadata.publicProfile as Record<string, unknown> : {}
  const category = typeof stored.category === 'string' && PROVIDER_CATEGORY_VALUES.has(stored.category)
    ? stored.category
    : context.businessType === 'venue' ? 'venue' : 'other'
  return {
    id: null,
    businessAccountId: context.businessAccountId,
    slug: context.businessSlug,
    displayName: typeof stored.displayName === 'string' ? stored.displayName : context.businessName,
    headline: typeof stored.headline === 'string' ? stored.headline : '',
    description: typeof stored.description === 'string' ? stored.description : '',
    country: '', city: '', serviceAreas: stringList(stored.serviceAreas, 50), languages: [], publicEmail: '',
    phone: typeof stored.phone === 'string' ? stored.phone : '', website: typeof stored.website === 'string' ? stored.website : '',
    socialLinks: {}, yearsOperating: null, teamSize: null, responseTime: '', minimumBookingNotice: '', travelRadiusKm: null,
    paymentMethods: [], depositPolicy: '', cancellationPolicy: '', refundPolicy: '', travelPolicy: '', accessibilitySupport: '', culturalExperience: '',
    coverImageUrl: typeof stored.imageUrl === 'string' ? stored.imageUrl : '', faq: [], verificationBadges: [],
    visibility: stored.visibility === 'published' ? 'published' : 'draft', completionScore: 0, lastProfileUpdate: null,
    legacyCategory: category,
  }
}

export async function GET() {
  try {
    const context = await providerContext()
    if (context === 'signed-out') return errorResponse('Sign in with your approved provider account.', 401)
    if (!context) return errorResponse('No active venue or vendor business is connected to this account.', 403)

    const profiles = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM public."ProviderProfile" WHERE "businessAccountId" = $1 LIMIT 1`, context.businessAccountId,
    )
    const verification = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "legalName", "registrationNumber", "taxNumber", "representativeName", "physicalAddress", "secondaryContact", "identityStatus", "businessStatus", "insuranceStatus", "permitStatus", "reviewedAt"
       FROM wewed_admin."ProviderVerification" WHERE "businessAccountId" = $1 LIMIT 1`, context.businessAccountId,
    )
    const offerings = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM public."ProviderServiceOffering" WHERE "businessAccountId" = $1 ORDER BY "createdAt", category`, context.businessAccountId,
    )
    const packages = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT pp.* FROM public."ProviderPackage" pp JOIN public."ProviderServiceOffering" o ON o.id = pp."offeringId" WHERE o."businessAccountId" = $1 ORDER BY pp."offeringId", pp."sortOrder"`, context.businessAccountId,
    )
    const portfolio = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT pi.* FROM public."ProviderPortfolioItem" pi JOIN public."ProviderServiceOffering" o ON o.id = pi."offeringId" WHERE o."businessAccountId" = $1 ORDER BY pi."offeringId", pi."sortOrder"`, context.businessAccountId,
    )
    const enquiries = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT e.*, o.category, o."displayName" AS "offeringName", w.title AS "weddingTitle"
       FROM public."ProviderEnquiry" e
       JOIN public."ProviderServiceOffering" o ON o.id = e."offeringId"
       JOIN public."Wedding" w ON w.id = e."weddingId"
       WHERE e."providerBusinessAccountId" = $1 ORDER BY e."createdAt" DESC LIMIT 100`, context.businessAccountId,
    )

    const normalizedProfile = profiles[0] ?? legacyProfile(context)
    const normalizedOfferings = offerings.length > 0 ? offerings : [{
      id: null,
      businessAccountId: context.businessAccountId,
      category: (normalizedProfile as Record<string, unknown>).legacyCategory ?? (context.businessType === 'venue' ? 'venue' : 'other'),
      displayName: normalizedProfile.displayName,
      description: normalizedProfile.description,
      status: normalizedProfile.visibility,
      startingPriceCents: null,
      maximumPriceCents: null,
      currency: 'USD',
      pricingModel: '',
      minimumCapacity: null,
      maximumCapacity: null,
      bookingLeadTime: '',
      serviceAreas: normalizedProfile.serviceAreas,
      inclusions: [],
      details: {},
      completionScore: 0,
    }]

    return NextResponse.json({
      success: true,
      business: { id: context.businessAccountId, name: context.businessName, slug: context.businessSlug, type: context.businessType },
      profile: normalizedProfile,
      verification: verification[0] ?? null,
      offerings: normalizedOfferings.map((offering) => ({
        ...offering,
        packages: packages.filter((entry) => entry.offeringId === offering.id),
        portfolio: portfolio.filter((entry) => entry.offeringId === offering.id),
      })),
      enquiries,
    })
  } catch (error) {
    console.error('[providers/profile] GET error:', error)
    return errorResponse('Unable to load the provider profile.', 500)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await providerContext()
    if (context === 'signed-out') return errorResponse('Sign in with your approved provider account.', 401)
    if (!context) return errorResponse('No active venue or vendor business is connected to this account.', 403)

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return errorResponse('Invalid provider profile request.', 400)
    const profileInput = jsonObject(body.profile && typeof body.profile === 'object' ? body.profile : body)
    const verificationInput = jsonObject(body.verification)
    const offeringInputs = Array.isArray(body.offerings) ? body.offerings.map(jsonObject).slice(0, 12) : []

    const displayName = text(profileInput.displayName, 160) ?? context.businessName
    const slug = (text(profileInput.slug, 100) ?? context.businessSlug).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70)
    if (!slug) return errorResponse('A valid public profile URL is required.', 400)
    const slugOwner = await db.$queryRawUnsafe<Array<{ businessAccountId: string }>>(`SELECT "businessAccountId" FROM public."ProviderProfile" WHERE slug = $1 LIMIT 1`, slug)
    if (slugOwner[0] && slugOwner[0].businessAccountId !== context.businessAccountId) return errorResponse('That provider profile URL is already in use.', 409)

    let profile: Record<string, unknown>
    try {
      const visibility = typeof profileInput.visibility === 'string' && VISIBILITY.has(profileInput.visibility) ? profileInput.visibility : 'draft'
      profile = {
        displayName,
        slug,
        headline: text(profileInput.headline, 180),
        description: text(profileInput.description, 4000),
        country: text(profileInput.country, 120),
        city: text(profileInput.city, 120),
        serviceAreas: stringList(profileInput.serviceAreas, 50),
        languages: stringList(profileInput.languages, 30),
        publicEmail: text(profileInput.publicEmail, 180),
        phone: text(profileInput.phone, 80),
        website: httpsUrl(profileInput.website, 'Website'),
        socialLinks: normalizeSocialLinks(profileInput.socialLinks),
        yearsOperating: nullableInteger(profileInput.yearsOperating, 'Years operating', 0, 300),
        teamSize: nullableInteger(profileInput.teamSize, 'Team size', 1, 10000),
        responseTime: text(profileInput.responseTime, 160),
        minimumBookingNotice: text(profileInput.minimumBookingNotice, 160),
        travelRadiusKm: nullableInteger(profileInput.travelRadiusKm, 'Travel radius', 0, 50000),
        paymentMethods: stringList(profileInput.paymentMethods, 20),
        depositPolicy: text(profileInput.depositPolicy, 2000),
        cancellationPolicy: text(profileInput.cancellationPolicy, 3000),
        refundPolicy: text(profileInput.refundPolicy, 3000),
        travelPolicy: text(profileInput.travelPolicy, 3000),
        accessibilitySupport: text(profileInput.accessibilitySupport, 2000),
        culturalExperience: text(profileInput.culturalExperience, 2000),
        coverImageUrl: httpsUrl(profileInput.coverImageUrl, 'Cover image'),
        faq: normalizeFaq(profileInput.faq),
        visibility,
      }
      profile.completionScore = profileCompletion(profile)
      if (visibility === 'published' && Number(profile.completionScore) < 60) return errorResponse('Complete at least 60% of the company profile before publishing.', 400)
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Provider profile is invalid.', 400)
    }

    const normalizedOfferings: Array<Record<string, unknown>> = []
    try {
      for (const input of offeringInputs) {
        const category = typeof input.category === 'string' && PROVIDER_CATEGORY_VALUES.has(input.category) ? input.category : null
        if (!category) throw new Error('Every service offering must use a valid category.')
        if (context.businessType === 'venue' && category !== 'venue') throw new Error('A venue account may publish only the venue category.')
        if (normalizedOfferings.some((offering) => offering.category === category)) throw new Error('Each service category may appear only once.')
        const details = normalizeDetails(category, input.details)
        const startingPriceCents = moneyCents(input.startingPrice, 'Starting price')
        const maximumPriceCents = moneyCents(input.maximumPrice, 'Maximum price')
        if (startingPriceCents !== null && maximumPriceCents !== null && startingPriceCents > maximumPriceCents) throw new Error('Starting price cannot exceed maximum price.')
        const minimumCapacity = nullableInteger(input.minimumCapacity, 'Minimum capacity', 0, 100000)
        const maximumCapacity = nullableInteger(input.maximumCapacity, 'Maximum capacity', 0, 100000)
        if (minimumCapacity !== null && maximumCapacity !== null && minimumCapacity > maximumCapacity) throw new Error('Minimum capacity cannot exceed maximum capacity.')
        const status = typeof input.status === 'string' && OFFERING_STATUS.has(input.status) ? input.status : 'draft'
        const offering = {
          id: text(input.id, 160) || `provider-offering-${randomUUID()}`,
          category,
          displayName: text(input.displayName, 160) ?? `${displayName} — ${category}`,
          description: text(input.description, 3000),
          status,
          startingPriceCents,
          maximumPriceCents,
          currency: typeof input.currency === 'string' && CURRENCIES.has(input.currency) ? input.currency : 'USD',
          pricingModel: text(input.pricingModel, 120),
          minimumCapacity,
          maximumCapacity,
          bookingLeadTime: text(input.bookingLeadTime, 160),
          serviceAreas: stringList(input.serviceAreas, 50),
          inclusions: stringList(input.inclusions, 50),
          details,
          packages: Array.isArray(input.packages) ? input.packages.slice(0, 20).map(jsonObject) : [],
          portfolio: Array.isArray(input.portfolio) ? input.portfolio.slice(0, 30).map(jsonObject) : [],
        }
        offering.completionScore = offeringCompletion(category, input, details)
        if (status === 'published' && Number(offering.completionScore) < 60) throw new Error(`Complete at least 60% of the ${category} offering before publishing.`)
        normalizedOfferings.push(offering)
      }
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Service offering is invalid.', 400)
    }

    if (normalizedOfferings.length === 0) return errorResponse('Add at least one service offering.', 400)

    const existingProfile = await db.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM public."ProviderProfile" WHERE "businessAccountId" = $1 LIMIT 1`, context.businessAccountId)
    const profileId = existingProfile[0]?.id ?? `provider-profile-${randomUUID()}`

    await db.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        `INSERT INTO wewed_admin."ProviderProfile" (
          id, "businessAccountId", slug, "displayName", headline, description, country, city, "serviceAreas", languages,
          "publicEmail", phone, website, "socialLinks", "yearsOperating", "teamSize", "responseTime", "minimumBookingNotice", "travelRadiusKm",
          "paymentMethods", "depositPolicy", "cancellationPolicy", "refundPolicy", "travelPolicy", "accessibilitySupport", "culturalExperience",
          "coverImageUrl", faq, "visibility", "completionScore", "publishedAt", "lastProfileUpdate", "updatedAt"
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20::jsonb,$21,$22,$23,$24,$25,$26,$27,$28::jsonb,$29,$30,CASE WHEN $29='published' THEN CURRENT_TIMESTAMP ELSE NULL END,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        ON CONFLICT ("businessAccountId") DO UPDATE SET
          slug=EXCLUDED.slug,"displayName"=EXCLUDED."displayName",headline=EXCLUDED.headline,description=EXCLUDED.description,country=EXCLUDED.country,city=EXCLUDED.city,
          "serviceAreas"=EXCLUDED."serviceAreas",languages=EXCLUDED.languages,"publicEmail"=EXCLUDED."publicEmail",phone=EXCLUDED.phone,website=EXCLUDED.website,"socialLinks"=EXCLUDED."socialLinks",
          "yearsOperating"=EXCLUDED."yearsOperating","teamSize"=EXCLUDED."teamSize","responseTime"=EXCLUDED."responseTime","minimumBookingNotice"=EXCLUDED."minimumBookingNotice","travelRadiusKm"=EXCLUDED."travelRadiusKm",
          "paymentMethods"=EXCLUDED."paymentMethods","depositPolicy"=EXCLUDED."depositPolicy","cancellationPolicy"=EXCLUDED."cancellationPolicy","refundPolicy"=EXCLUDED."refundPolicy","travelPolicy"=EXCLUDED."travelPolicy",
          "accessibilitySupport"=EXCLUDED."accessibilitySupport","culturalExperience"=EXCLUDED."culturalExperience","coverImageUrl"=EXCLUDED."coverImageUrl",faq=EXCLUDED.faq,
          "visibility"=EXCLUDED."visibility","completionScore"=EXCLUDED."completionScore","publishedAt"=CASE WHEN EXCLUDED."visibility"='published' THEN COALESCE(wewed_admin."ProviderProfile"."publishedAt",CURRENT_TIMESTAMP) ELSE NULL END,
          "lastProfileUpdate"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP`,
        profileId, context.businessAccountId, profile.slug, profile.displayName, profile.headline, profile.description, profile.country, profile.city,
        JSON.stringify(profile.serviceAreas), JSON.stringify(profile.languages), profile.publicEmail, profile.phone, profile.website, JSON.stringify(profile.socialLinks),
        profile.yearsOperating, profile.teamSize, profile.responseTime, profile.minimumBookingNotice, profile.travelRadiusKm, JSON.stringify(profile.paymentMethods),
        profile.depositPolicy, profile.cancellationPolicy, profile.refundPolicy, profile.travelPolicy, profile.accessibilitySupport, profile.culturalExperience,
        profile.coverImageUrl, JSON.stringify(profile.faq), profile.visibility, profile.completionScore,
      )

      await transaction.$executeRawUnsafe(
        `INSERT INTO wewed_admin."ProviderVerification" (id,"businessAccountId","legalName","registrationNumber","taxNumber","representativeName","physicalAddress","secondaryContact","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP)
         ON CONFLICT ("businessAccountId") DO UPDATE SET "legalName"=EXCLUDED."legalName","registrationNumber"=EXCLUDED."registrationNumber","taxNumber"=EXCLUDED."taxNumber","representativeName"=EXCLUDED."representativeName","physicalAddress"=EXCLUDED."physicalAddress","secondaryContact"=EXCLUDED."secondaryContact","updatedAt"=CURRENT_TIMESTAMP`,
        `provider-verification-${randomUUID()}`, context.businessAccountId, text(verificationInput.legalName, 200), text(verificationInput.registrationNumber, 160),
        text(verificationInput.taxNumber, 160), text(verificationInput.representativeName, 160), text(verificationInput.physicalAddress, 1000), text(verificationInput.secondaryContact, 240),
      )

      for (const offering of normalizedOfferings) {
        const owned = await transaction.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM wewed_admin."ProviderServiceOffering" WHERE id=$1 AND "businessAccountId"=$2 LIMIT 1`, offering.id, context.businessAccountId,
        )
        const offeringId = owned[0]?.id ?? String(offering.id)
        await transaction.$executeRawUnsafe(
          `INSERT INTO wewed_admin."ProviderServiceOffering" (id,"businessAccountId",category,"displayName",description,status,"startingPriceCents","maximumPriceCents",currency,"pricingModel","minimumCapacity","maximumCapacity","bookingLeadTime","serviceAreas",inclusions,details,"completionScore","publishedAt","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::jsonb,$17,CASE WHEN $6='published' THEN CURRENT_TIMESTAMP ELSE NULL END,CURRENT_TIMESTAMP)
           ON CONFLICT ("businessAccountId",category) DO UPDATE SET "displayName"=EXCLUDED."displayName",description=EXCLUDED.description,status=EXCLUDED.status,"startingPriceCents"=EXCLUDED."startingPriceCents","maximumPriceCents"=EXCLUDED."maximumPriceCents",currency=EXCLUDED.currency,"pricingModel"=EXCLUDED."pricingModel","minimumCapacity"=EXCLUDED."minimumCapacity","maximumCapacity"=EXCLUDED."maximumCapacity","bookingLeadTime"=EXCLUDED."bookingLeadTime","serviceAreas"=EXCLUDED."serviceAreas",inclusions=EXCLUDED.inclusions,details=EXCLUDED.details,"completionScore"=EXCLUDED."completionScore","publishedAt"=CASE WHEN EXCLUDED.status='published' THEN COALESCE(wewed_admin."ProviderServiceOffering"."publishedAt",CURRENT_TIMESTAMP) ELSE NULL END,"updatedAt"=CURRENT_TIMESTAMP`,
          offeringId, context.businessAccountId, offering.category, offering.displayName, offering.description, offering.status, offering.startingPriceCents, offering.maximumPriceCents,
          offering.currency, offering.pricingModel, offering.minimumCapacity, offering.maximumCapacity, offering.bookingLeadTime, JSON.stringify(offering.serviceAreas), JSON.stringify(offering.inclusions), JSON.stringify(offering.details), offering.completionScore,
        )
        const savedOffering = await transaction.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM wewed_admin."ProviderServiceOffering" WHERE "businessAccountId"=$1 AND category=$2 LIMIT 1`, context.businessAccountId, offering.category)
        const savedOfferingId = savedOffering[0]?.id
        if (!savedOfferingId) throw new Error('Unable to save service offering.')

        await transaction.$executeRawUnsafe(`DELETE FROM wewed_admin."ProviderPackage" WHERE "offeringId"=$1`, savedOfferingId)
        for (const [index, packageInput] of (offering.packages as OfferingInput[]).entries()) {
          const packageName = text(packageInput.name, 160)
          if (!packageName) continue
          await transaction.$executeRawUnsafe(
            `INSERT INTO wewed_admin."ProviderPackage" (id,"offeringId",name,description,"priceCents",currency,"pricingUnit",inclusions,"sortOrder","isActive") VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,true)`,
            `provider-package-${randomUUID()}`, savedOfferingId, packageName, text(packageInput.description, 2000), moneyCents(packageInput.price, 'Package price'),
            typeof packageInput.currency === 'string' && CURRENCIES.has(packageInput.currency) ? packageInput.currency : offering.currency,
            text(packageInput.pricingUnit, 120), JSON.stringify(stringList(packageInput.inclusions, 50)), index,
          )
        }

        await transaction.$executeRawUnsafe(`DELETE FROM wewed_admin."ProviderPortfolioItem" WHERE "offeringId"=$1`, savedOfferingId)
        for (const [index, itemInput] of (offering.portfolio as OfferingInput[]).entries()) {
          const url = httpsUrl(itemInput.url, 'Portfolio item')
          if (!url) continue
          const type = ['image', 'video', 'link'].includes(String(itemInput.type)) ? String(itemInput.type) : 'image'
          await transaction.$executeRawUnsafe(
            `INSERT INTO wewed_admin."ProviderPortfolioItem" (id,"offeringId",type,url,"thumbnailUrl","altText",caption,"sortOrder","isPublished") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
            `provider-portfolio-${randomUUID()}`, savedOfferingId, type, url, httpsUrl(itemInput.thumbnailUrl, 'Portfolio thumbnail'), text(itemInput.altText, 300), text(itemInput.caption, 1000), index,
          )
        }
      }

      const primary = normalizedOfferings.find((offering) => offering.status === 'published') ?? normalizedOfferings[0]
      const legacy = {
        displayName: profile.displayName,
        headline: profile.headline,
        description: profile.description,
        category: primary.category,
        serviceAreas: profile.serviceAreas,
        services: primary.inclusions,
        website: profile.website,
        phone: profile.phone,
        imageUrl: profile.coverImageUrl,
        visibility: profile.visibility,
        updatedAt: new Date().toISOString(),
      }
      await transaction.$executeRawUnsafe(
        `UPDATE wewed_admin."BusinessAccount" SET metadata=jsonb_set(COALESCE(metadata,'{}'::jsonb),'{publicProfile}',$2::jsonb,true),"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1`,
        context.businessAccountId, JSON.stringify(legacy),
      )
    })

    await marketplaceAudit({
      actorUserId: context.userId,
      businessAccountId: context.businessAccountId,
      action: 'provider_profile.normalized_updated',
      resourceType: 'provider_profile',
      resourceId: profileId,
      details: { visibility: profile.visibility, categories: normalizedOfferings.map((offering) => offering.category), completionScore: profile.completionScore },
    })

    return NextResponse.json({ success: true, profileId, completionScore: profile.completionScore })
  } catch (error) {
    console.error('[providers/profile] PUT error:', error)
    return errorResponse(error instanceof Error ? error.message : 'Unable to save the provider profile.', 500)
  }
}

export const dynamic = 'force-dynamic'
