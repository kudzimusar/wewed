import { describe, expect, test } from 'bun:test'
import { db } from '@/lib/db'

const requiredProviderEntitlement = 'ai_wedding_architect_opportunities'
const requiredPlannerEntitlement = 'ai_wedding_architect_planning'

describe('Wedding Architect migrated database contract', () => {
  test('adds the commercial entitlements only to the intended offers', async () => {
    const rows = await db.$queryRawUnsafe<Array<{ offerCode: string; billingModel: string; entitlements: unknown }>>(
      `SELECT "offerCode", "billingModel", entitlements
       FROM wewed_admin."BillingOffer"
       WHERE "offerCode" IN ('vendor_profile','vendor_growth','venue_profile','venue_portfolio','planner_free','planner_professional')
       ORDER BY "offerCode"`,
    )
    const byCode = new Map(rows.map((row) => [row.offerCode, row]))
    const entitlements = (code: string) => Array.isArray(byCode.get(code)?.entitlements) ? byCode.get(code)!.entitlements as string[] : []
    expect(entitlements('vendor_growth')).toContain(requiredProviderEntitlement)
    expect(entitlements('venue_portfolio')).toContain(requiredProviderEntitlement)
    expect(entitlements('planner_professional')).toContain(requiredPlannerEntitlement)
    expect(entitlements('vendor_profile')).not.toContain(requiredProviderEntitlement)
    expect(entitlements('venue_profile')).not.toContain(requiredProviderEntitlement)
    expect(entitlements('planner_free')).not.toContain(requiredPlannerEntitlement)
  })

  test('executes the canonical provider/billing marketplace join on the migrated schema', async () => {
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
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
         AND o.status = 'published'`,
      ['venue'],
    )
    expect(Array.isArray(rows)).toBe(true)
  })

  test('executes package and planner entitlement joins with Phase C columns', async () => {
    const packages = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, "offeringId", name, "priceCents", currency, "isActive",
              "minimumQuantity", "maximumQuantity", "includedQuantity", "additionalUnitPriceCents",
              "commercialTerms", "priceComponents", "priceValidUntil", "completionScore",
              "quantityType", "quantityKey", "multiplierKey"
       FROM wewed_admin."ProviderPackage"
       WHERE "offeringId" = ANY($1::text[]) AND "isActive" = true`,
      ['missing-offering'],
    )
    expect(packages).toEqual([])

    const plannerRows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ba.type AS "accountType", ba.status AS "accountStatus",
              bp."offerCode", bp.status AS "profileStatus", bp."currentPeriodEndsAt",
              bo."billingModel", bo.status AS "offerStatus", bo.entitlements
       FROM wewed_admin."BusinessAccountMember" bam
       JOIN wewed_admin."BusinessAccount" ba ON ba.id=bam."businessAccountId"
       LEFT JOIN wewed_admin."BusinessAccountBillingProfile" bp ON bp."businessAccountId"=ba.id
       LEFT JOIN wewed_admin."BillingOffer" bo ON bo."offerCode"=bp."offerCode" AND bo."accountType"=bp."accountType"
       WHERE bam."userId"=$1 AND bam.status='active' AND ba.type='planning_company'
         AND ba.status='active' AND ba."onboardingStatus"='complete'
       LIMIT 1`,
      'missing-user',
    )
    expect(plannerRows).toEqual([])
  })

  test('keeps Phase C package fields in the governed public view without browser grants', async () => {
    const columns = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='ProviderPackage'
         AND column_name IN ('quantityType','quantityKey','multiplierKey')
       ORDER BY column_name`,
    )
    expect(columns.map((row) => row.column_name).sort()).toEqual(['multiplierKey', 'quantityKey', 'quantityType'])

    const grants = await db.$queryRawUnsafe<Array<{ grantee: string; privilege_type: string }>>(
      `SELECT grantee, privilege_type FROM information_schema.role_table_grants
       WHERE table_schema='public' AND table_name='ProviderPackage'
         AND grantee IN ('anon','authenticated')`,
    )
    expect(grants).toEqual([])
  })
})
