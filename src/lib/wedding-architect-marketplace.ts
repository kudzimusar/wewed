import 'server-only'

import { db } from '@/lib/db'
import { calculateCommercialReadiness } from '@/lib/provider-commercial'
import { priceComponentsUseApprovedAutomaticBindings } from '@/lib/wedding-architect-binding-policy'
import { priceWeddingArchitectCandidate } from '@/lib/wedding-architect-candidate-pricing'
import {
  WEDDING_ARCHITECT_PROVIDER_ENTITLEMENT,
  resolveWeddingArchitectEntitlement,
  type WeddingArchitectBillingOffer,
  type WeddingArchitectBillingProfile,
} from '@/lib/wedding-architect-entitlement'
import { evaluateWeddingArchitectEligibility } from '@/lib/wedding-architect-eligibility'
import { scoreWeddingArchitectFit } from '@/lib/wedding-architect-fit'
import { optimizeWeddingArchitectPlan, type WeddingArchitectCategoryPool, type WeddingArchitectPricedCandidate } from '@/lib/wedding-architect-optimizer'
import type { PriceQuantityContext } from '@/lib/provider-price-bindings'
import type { WeddingPlanStrategy, WeddingRequirementPriority } from '@/lib/wedding-requirement-catalog'
import type { PriceComponentType } from '@/lib/provider-commercial'

interface RequirementProfileRow {
  totalBudgetCents: string | null
  currency: string
  contingencyBasisPoints: number | null
  guestCount: number | null
  adultCount: number | null
  childCount: number | null
  country: string | null
  city: string | null
  locationRadiusKm: number | null
  strategy: WeddingPlanStrategy
  completionScore: number
  confirmedAt: Date | null
}

interface CategoryRequirementRow {
  category: string
  priority: WeddingRequirementPriority
  requirements: unknown
  notes: string | null
  confirmedAt: Date | null
}

interface OfferingRow {
  providerId: string
  businessAccountId: string
  providerName: string
  providerSlug: string
  listingStatus: string
  profileCompletionScore: number
  businessType: string
  businessStatus: string
  offeringId: string
  category: string
  offeringName: string
  offeringStatus: string
  pricingVisibility: string
  pricingModel: string | null
  startingPriceCents: number | null
  maximumPriceCents: number | null
  currency: string
  minimumCapacity: number | null
  maximumCapacity: number | null
  serviceAreas: unknown
  details: unknown
  commercialTerms: unknown
  priceComponents: unknown
  priceValidUntil: Date | null
  ownerConfirmedCommercialAt: Date | null
  storedAiReadinessScore: number
  storedAiReadinessStatus: string
  billingAccountType: string | null
  billingOfferCode: string | null
  billingProfileStatus: string | null
  billingPeriodEndsAt: Date | null
  offerAccountType: string | null
  offerBillingModel: string | null
  offerStatus: string | null
  offerEntitlements: unknown
}

interface PackageRow {
  id: string
  offeringId: string
  name: string
  priceCents: number
  currency: string
  isActive: boolean
  minimumQuantity: number | null
  maximumQuantity: number | null
  includedQuantity: number | null
  additionalUnitPriceCents: number | null
  commercialTerms: unknown
  priceComponents: unknown
  priceValidUntil: Date | null
  completionScore: number
  quantityType: PriceComponentType | null
  quantityKey: string | null
  multiplierKey: string | null
}

export type WeddingArchitectMarketplaceDiagnostics = {
  scannedOfferings: number
  entitledOfferings: number
  calculationReadyVariants: number
  rejectedByCategory: Record<string, Record<string, number>>
}

export type WeddingArchitectMarketplacePlan = {
  weddingId: string
  briefConfirmedAt: string
  briefCompletionScore: number
  plan: ReturnType<typeof optimizeWeddingArchitectPlan>
  diagnostics: WeddingArchitectMarketplaceDiagnostics
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function countReason(target: WeddingArchitectMarketplaceDiagnostics, category: string, reason: string) {
  target.rejectedByCategory[category] ??= {}
  target.rejectedByCategory[category][reason] = (target.rejectedByCategory[category][reason] ?? 0) + 1
}

function billingProfile(row: OfferingRow): WeddingArchitectBillingProfile | null {
  if (!row.billingAccountType || !row.billingOfferCode || !row.billingProfileStatus) return null
  return {
    accountType: row.billingAccountType,
    offerCode: row.billingOfferCode,
    status: row.billingProfileStatus,
    currentPeriodEndsAt: row.billingPeriodEndsAt,
  }
}

function billingOffer(row: OfferingRow): WeddingArchitectBillingOffer | null {
  if (!row.offerAccountType || !row.billingOfferCode || !row.offerBillingModel || !row.offerStatus) return null
  return {
    offerCode: row.billingOfferCode,
    accountType: row.offerAccountType,
    billingModel: row.offerBillingModel,
    status: row.offerStatus,
    entitlements: row.offerEntitlements,
  }
}

const HARD_FIT_MISMATCHES = new Set([
  'Seated capacity', 'On-site accommodation', 'External catering', 'Accessibility',
  'Planning service', 'Photography coverage', 'Album', 'Engagement session',
  'Video coverage', 'Livestream', 'Full ceremony film', 'Dietary support',
  'Catering minimum guests', 'Catering maximum guests', 'Cake minimum servings',
  'Cake maximum servings', 'Cake dietary options',
])

function runtimeReadiness(row: OfferingRow, packages: PackageRow[], now: Date) {
  const allComponents = [
    ...(Array.isArray(row.priceComponents) ? row.priceComponents : []),
    ...packages.flatMap((pkg) => Array.isArray(pkg.priceComponents) ? pkg.priceComponents : []),
  ]
  return calculateCommercialReadiness({
    status: row.offeringStatus,
    serviceAreas: row.serviceAreas,
    pricingVisibility: row.pricingVisibility,
    pricingModel: row.pricingModel,
    startingPriceCents: row.startingPriceCents,
    maximumPriceCents: row.maximumPriceCents,
    packages: packages.map((pkg) => ({ priceCents: pkg.priceCents })),
    priceValidUntil: row.priceValidUntil,
    commercialTerms: row.commercialTerms,
    priceComponents: allComponents,
    ownerConfirmedCommercialAt: row.ownerConfirmedCommercialAt,
    automaticQuantityBindingsApproved: priceComponentsUseApprovedAutomaticBindings(row.category, allComponents),
  }, now)
}

async function readBrief(weddingId: string) {
  const [profiles, categories, wedding] = await Promise.all([
    db.$queryRawUnsafe<RequirementProfileRow[]>(
      `SELECT "totalBudgetCents"::text AS "totalBudgetCents", currency, "contingencyBasisPoints",
              "guestCount", "adultCount", "childCount", country, city, "locationRadiusKm",
              strategy, "completionScore", "confirmedAt"
       FROM wewed_admin."WeddingRequirementProfile"
       WHERE "weddingId"=$1 LIMIT 1`, weddingId),
    db.$queryRawUnsafe<CategoryRequirementRow[]>(
      `SELECT category, priority, requirements, notes, "confirmedAt"
       FROM wewed_admin."WeddingCategoryRequirement"
       WHERE "weddingId"=$1 ORDER BY category`, weddingId),
    db.wedding.findUnique({ where: { id: weddingId }, select: { date: true, venueCity: true, venueCountry: true } }),
  ])
  return { profile: profiles[0] ?? null, categories, wedding }
}

async function readOfferings(categories: string[]): Promise<OfferingRow[]> {
  if (!categories.length) return []
  return db.$queryRawUnsafe<OfferingRow[]>(
    `SELECT
       pp.id AS "providerId", pp."businessAccountId", pp."displayName" AS "providerName",
       pp.slug AS "providerSlug", pp."listingStatus", pp."completionScore" AS "profileCompletionScore",
       ba.type AS "businessType", ba.status AS "businessStatus",
       o.id AS "offeringId", o.category, o."displayName" AS "offeringName", o.status AS "offeringStatus",
       o."pricingVisibility", o."pricingModel", o."startingPriceCents", o."maximumPriceCents", o.currency,
       o."minimumCapacity", o."maximumCapacity", o."serviceAreas", o.details,
       o."commercialTerms", o."priceComponents", o."priceValidUntil", o."ownerConfirmedCommercialAt",
       o."aiReadinessScore" AS "storedAiReadinessScore", o."aiReadinessStatus" AS "storedAiReadinessStatus",
       bp."accountType" AS "billingAccountType", bp."offerCode" AS "billingOfferCode",
       bp.status AS "billingProfileStatus", bp."currentPeriodEndsAt" AS "billingPeriodEndsAt",
       bo."accountType" AS "offerAccountType", bo."billingModel" AS "offerBillingModel",
       bo.status AS "offerStatus", bo.entitlements AS "offerEntitlements"
     FROM wewed_admin."ProviderServiceOffering" o
     JOIN wewed_admin."ProviderProfile" pp ON pp."businessAccountId" = o."businessAccountId"
     JOIN wewed_admin."BusinessAccount" ba ON ba.id = o."businessAccountId"
     LEFT JOIN wewed_admin."BusinessAccountBillingProfile" bp ON bp."businessAccountId" = ba.id
     LEFT JOIN wewed_admin."BillingOffer" bo ON bo."offerCode" = bp."offerCode" AND bo."accountType" = bp."accountType"
     WHERE o.category = ANY($1::text[])
       AND pp.visibility = 'published'
       AND o.status = 'published'
     ORDER BY o.category, pp."displayName", o."displayName"`,
    categories,
  )
}

async function readPackages(offeringIds: string[]): Promise<PackageRow[]> {
  if (!offeringIds.length) return []
  return db.$queryRawUnsafe<PackageRow[]>(
    `SELECT id, "offeringId", name, "priceCents", currency, "isActive",
            "minimumQuantity", "maximumQuantity", "includedQuantity", "additionalUnitPriceCents",
            "commercialTerms", "priceComponents", "priceValidUntil", "completionScore",
            "quantityType", "quantityKey", "multiplierKey"
     FROM wewed_admin."ProviderPackage"
     WHERE "offeringId" = ANY($1::text[]) AND "isActive" = true
     ORDER BY "offeringId", "sortOrder", name`,
    offeringIds,
  )
}

function quantityContext(profile: RequirementProfileRow, category: CategoryRequirementRow): PriceQuantityContext {
  return {
    guestCount: profile.guestCount,
    adultCount: profile.adultCount,
    childCount: profile.childCount,
    travelKm: 0,
    categoryRequirements: jsonObject(category.requirements),
  }
}

export async function buildWeddingArchitectMarketplacePlan(input: {
  weddingId: string
  now?: Date
}): Promise<WeddingArchitectMarketplacePlan> {
  const now = input.now ?? new Date()
  const { profile, categories, wedding } = await readBrief(input.weddingId)
  if (!wedding) throw new Error('Active wedding was not found.')
  if (!profile || !profile.confirmedAt) throw new Error('Confirm the Wedding Brief before generating an AI wedding plan.')
  const budget = profile.totalBudgetCents === null ? null : Number(profile.totalBudgetCents)
  if (!Number.isSafeInteger(budget) || (budget ?? 0) <= 0) throw new Error('A positive total wedding budget is required.')
  if (!profile.country || !profile.city) throw new Error('Wedding country and city are required for marketplace matching.')

  const activeCategories = categories.filter((category) => category.priority !== 'not_required')
  const offerings = await readOfferings(activeCategories.map((category) => category.category))
  const packages = await readPackages(offerings.map((row) => row.offeringId))
  const packagesByOffering = new Map<string, PackageRow[]>()
  for (const pkg of packages) packagesByOffering.set(pkg.offeringId, [...(packagesByOffering.get(pkg.offeringId) ?? []), pkg])

  const diagnostics: WeddingArchitectMarketplaceDiagnostics = {
    scannedOfferings: offerings.length,
    entitledOfferings: 0,
    calculationReadyVariants: 0,
    rejectedByCategory: {},
  }
  const pools = new Map<string, WeddingArchitectPricedCandidate[]>()
  for (const category of activeCategories) pools.set(category.category, [])

  for (const row of offerings) {
    const categoryRequirement = activeCategories.find((entry) => entry.category === row.category)
    if (!categoryRequirement) continue
    const entitlement = resolveWeddingArchitectEntitlement({
      accountType: row.businessType,
      accountStatus: row.businessStatus,
      billingProfile: billingProfile(row),
      billingOffer: billingOffer(row),
      entitlement: WEDDING_ARCHITECT_PROVIDER_ENTITLEMENT,
      requirePaid: true,
      now,
    })
    if (!entitlement.entitled) {
      for (const reason of entitlement.reasons) countReason(diagnostics, row.category, reason)
      continue
    }
    diagnostics.entitledOfferings += 1

    const offeringPackages = packagesByOffering.get(row.offeringId) ?? []
    const readiness = runtimeReadiness(row, offeringPackages, now)
    const eligibility = evaluateWeddingArchitectEligibility({
      providerId: row.providerId,
      offeringId: row.offeringId,
      category: row.category,
      businessActive: row.businessStatus === 'active',
      subscriptionEntitled: true,
      listingStatus: row.listingStatus,
      offeringStatus: row.offeringStatus,
      aiReadinessStatus: readiness.status,
      pricingVisibility: row.pricingVisibility,
      currency: row.currency,
      serviceAreas: stringList(row.serviceAreas),
      minimumCapacity: row.minimumCapacity,
      maximumCapacity: row.maximumCapacity,
      priceValidUntil: row.priceValidUntil?.toISOString() ?? null,
      availability: 'unknown',
    }, {
      category: row.category,
      country: profile.country,
      city: profile.city,
      guestCount: profile.guestCount,
      currency: profile.currency,
      now,
      requireConfirmedAvailability: false,
    })
    if (eligibility.status === 'ineligible') {
      for (const reason of eligibility.reasons) countReason(diagnostics, row.category, reason)
      continue
    }

    const fit = scoreWeddingArchitectFit({ category: row.category, requirements: categoryRequirement.requirements, providerDetails: row.details })
    const hardMismatches = fit.mismatched.filter((label) => HARD_FIT_MISMATCHES.has(label))
    if (hardMismatches.length) {
      for (const mismatch of hardMismatches) countReason(diagnostics, row.category, `Hard requirement mismatch: ${mismatch}`)
      continue
    }

    const variants = [
      { package: null as PackageRow | null },
      ...offeringPackages.map((pkg) => ({ package: pkg })),
    ]
    for (const { package: pkg } of variants) {
      const price = priceWeddingArchitectCandidate({
        weddingBudgetCents: budget!,
        quantityContext: quantityContext(profile, categoryRequirement),
        calculatedAt: now,
        variant: {
          providerId: row.providerId,
          businessAccountId: row.businessAccountId,
          offeringId: row.offeringId,
          packageId: pkg?.id ?? null,
          category: row.category,
          currency: pkg?.currency ?? row.currency,
          pricingVisibility: row.pricingVisibility,
          startingPriceCents: row.startingPriceCents,
          offeringCommercialTerms: row.commercialTerms,
          offeringPriceComponents: row.priceComponents,
          offeringPriceValidUntil: row.priceValidUntil,
          packageName: pkg?.name ?? null,
          packagePriceCents: pkg?.priceCents ?? null,
          packageCommercialTerms: pkg?.commercialTerms,
          packagePriceComponents: pkg?.priceComponents,
          packagePriceValidUntil: pkg?.priceValidUntil,
          packageIncludedQuantity: pkg?.includedQuantity,
          packageAdditionalUnitPriceCents: pkg?.additionalUnitPriceCents,
          packageMinimumQuantity: pkg?.minimumQuantity,
          packageMaximumQuantity: pkg?.maximumQuantity,
          packageQuantityType: pkg?.quantityType,
          packageQuantityKey: pkg?.quantityKey,
          packageMultiplierKey: pkg?.multiplierKey,
        },
      })
      if (!price.ok) {
        for (const reason of price.reasons) countReason(diagnostics, row.category, reason)
        continue
      }
      diagnostics.calculationReadyVariants += 1
      const fitScore = Math.max(0, Math.min(100, Math.round(fit.score * 0.8 + readiness.score * 0.15 + (row.listingStatus === 'verified' ? 5 : 0))))
      pools.get(row.category)?.push({
        candidateId: `${row.offeringId}:${pkg?.id ?? 'offering'}`,
        providerId: row.providerId,
        businessAccountId: row.businessAccountId,
        offeringId: row.offeringId,
        packageId: pkg?.id ?? null,
        category: row.category,
        providerName: row.providerName,
        providerSlug: row.providerSlug,
        offeringName: row.offeringName,
        packageName: pkg?.name ?? null,
        fitScore,
        pricing: price.calculation,
        warnings: [...eligibility.warnings, ...fit.unknown.map((label) => `${label} is not confirmed in the provider catalogue.`)],
        why: [
          'Provider has an active Wedding Architect commercial entitlement.',
          'Commercial pricing passed deterministic readiness checks.',
          ...fit.matched.map((label) => `Matches ${label.toLowerCase()}.`),
        ],
      })
    }
  }

  const categoryPools: WeddingArchitectCategoryPool[] = activeCategories.map((category) => ({
    category: category.category,
    priority: category.priority,
    candidates: pools.get(category.category) ?? [],
  }))

  return {
    weddingId: input.weddingId,
    briefConfirmedAt: profile.confirmedAt.toISOString(),
    briefCompletionScore: profile.completionScore,
    plan: optimizeWeddingArchitectPlan({
      totalBudgetCents: budget!,
      contingencyBasisPoints: profile.contingencyBasisPoints,
      strategy: profile.strategy,
      pools: categoryPools,
    }),
    diagnostics,
  }
}
