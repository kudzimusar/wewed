import { createHash, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PROVIDER_CATEGORIES, PROVIDER_CATEGORY_VALUES } from '@/lib/provider-catalog'
import {
  createBusinessId,
  requireWewedAdmin,
  WewedAdminAccessError,
  writeBusinessAudit,
} from '@/lib/wewed-admin'

const SOURCE_TYPES = new Set([
  'official_website',
  'facebook',
  'instagram',
  'x',
  'linkedin',
  'youtube',
  'tiktok',
  'google_business',
  'licensed_directory',
  'company_registry',
  'association',
  'planner_referral',
  'owner_submission',
  'public_search',
  'other',
])
const ACCESS_METHODS = new Set(['official_api', 'licensed_feed', 'public_web', 'manual_research', 'owner_submission'])
const TERMS_STATUSES = new Set(['approved', 'review_required', 'restricted', 'prohibited'])
const ROBOTS_STATUSES = new Set(['allowed', 'disallowed', 'not_applicable', 'unknown'])

interface SourceInput {
  sourceType?: unknown
  sourceUrl?: unknown
  sourceName?: unknown
  accessMethod?: unknown
  termsStatus?: unknown
  robotsStatus?: unknown
  confidence?: unknown
  evidence?: unknown
  collectedAt?: unknown
}

interface CandidateInput {
  displayName?: unknown
  primaryCategory?: unknown
  additionalCategories?: unknown
  country?: unknown
  province?: unknown
  district?: unknown
  city?: unknown
  serviceAreas?: unknown
  website?: unknown
  publicEmail?: unknown
  phone?: unknown
  socialLinks?: unknown
  headline?: unknown
  description?: unknown
  details?: unknown
  fieldConfidence?: unknown
  aggregateConfidence?: unknown
  sources?: unknown
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function nullableText(value: unknown, max: number): string | null {
  return text(value, max) || null
}

function stringList(value: unknown, limit = 50): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean))).slice(0, limit)
    : []
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function confidence(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : 0
}

function httpsUrl(value: unknown): string | null {
  const normalized = text(value, 1000)
  if (!normalized) return null
  try {
    const url = new URL(normalized)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function email(value: unknown): string | null {
  const normalized = text(value, 180).toLowerCase()
  if (!normalized) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(pvt|private|limited|ltd|inc|company|co)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 62)
  return normalized || `business-${randomUUID().slice(0, 8)}`
}

function websiteHost(value: string | null): string {
  if (!value) return ''
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

function phoneKey(value: string | null): string {
  return value ? value.replace(/\D/g, '').slice(-12) : ''
}

function dedupeKey(input: {
  normalizedName: string
  city: string | null
  website: string | null
  phone: string | null
}): string {
  const strongest = websiteHost(input.website) || phoneKey(input.phone)
  const raw = strongest
    ? `strong:${strongest}`
    : `name:${input.normalizedName}|city:${(input.city || '').toLowerCase()}`
  return createHash('sha256').update(raw).digest('hex')
}

function categoryName(category: string): string {
  return PROVIDER_CATEGORIES.find((entry) => entry.value === category)?.singular || 'Wedding service provider'
}

function socialLinks(value: unknown): Record<string, string> {
  const source = objectValue(value)
  const output: Record<string, string> = {}
  for (const key of ['facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok', 'primary']) {
    const url = httpsUrl(source[key])
    if (url) output[key] = url
  }
  return output
}

function normalizeSources(value: unknown): Array<{
  sourceType: string
  sourceUrl: string
  sourceName: string | null
  accessMethod: string
  termsStatus: string
  robotsStatus: string
  confidence: number
  evidence: Record<string, unknown>
  collectedAt: string | null
}> {
  if (!Array.isArray(value)) return []
  return value.slice(0, 20).flatMap((raw) => {
    const source = objectValue(raw) as SourceInput
    const sourceType = text(source.sourceType, 60)
    const sourceUrl = httpsUrl(source.sourceUrl)
    const accessMethod = text(source.accessMethod, 40) || 'manual_research'
    const termsStatus = text(source.termsStatus, 40) || 'review_required'
    const robotsStatus = text(source.robotsStatus, 40) || 'not_applicable'
    if (
      !SOURCE_TYPES.has(sourceType) ||
      !sourceUrl ||
      !ACCESS_METHODS.has(accessMethod) ||
      !TERMS_STATUSES.has(termsStatus) ||
      !ROBOTS_STATUSES.has(robotsStatus)
    ) return []
    return [{
      sourceType,
      sourceUrl,
      sourceName: nullableText(source.sourceName, 200),
      accessMethod,
      termsStatus,
      robotsStatus,
      confidence: confidence(source.confidence),
      evidence: objectValue(source.evidence),
      collectedAt: nullableText(source.collectedAt, 50),
    }]
  })
}

function sourceSummary(sources: ReturnType<typeof normalizeSources>): string {
  const labels: Record<string, string> = {
    official_website: 'official website',
    facebook: 'public Facebook page',
    instagram: 'public Instagram profile',
    x: 'public X profile',
    linkedin: 'public LinkedIn page',
    youtube: 'public YouTube channel',
    tiktok: 'public TikTok profile',
    google_business: 'public business listing',
    licensed_directory: 'licensed business directory',
    company_registry: 'company registry',
    association: 'industry association',
    planner_referral: 'planner referral',
    owner_submission: 'business submission',
    public_search: 'public web search',
    other: 'public source',
  }
  return Array.from(new Set(sources.map((source) => labels[source.sourceType] || 'public source'))).join(', ')
}

async function uniqueSlug(base: string): Promise<string> {
  for (let index = 0; index < 100; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`
    const rows = await db.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS(
         SELECT 1 FROM wewed_admin."BusinessAccount" WHERE slug = $1
         UNION ALL
         SELECT 1 FROM wewed_admin."ProviderProfile" WHERE slug = $1
       ) AS exists`,
      candidate,
    )
    if (!rows[0]?.exists) return candidate
  }
  return `${base}-${randomUUID().slice(0, 8)}`
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireWewedAdmin(request, 'admin.accounts.create')
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || !Array.isArray(body.candidates)) {
      return NextResponse.json({ success: false, error: 'A candidates array is required.' }, { status: 400 })
    }

    const inputs = body.candidates.slice(0, 100) as CandidateInput[]
    if (inputs.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one candidate is required.' }, { status: 400 })
    }

    const publishThreshold = Math.max(60, Math.min(95, confidence(body.publishThreshold) || 75))
    const jobId = createBusinessId('provider-discovery-job')
    const jobName = text(body.jobName, 180) || `Zimbabwe provider import ${new Date().toISOString().slice(0, 10)}`

    await db.$executeRawUnsafe(
      `INSERT INTO wewed_admin."ProviderDiscoveryJob" (
         id, name, status, country, "targetCount", "createdByUserId", notes, metadata,
         "startedAt", "createdAt", "updatedAt"
       ) VALUES ($1,$2,'running','Zimbabwe',$3,$4,$5,$6::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      jobId,
      jobName,
      inputs.length,
      admin.session.userId,
      nullableText(body.notes, 2000),
      JSON.stringify({ publishThreshold, importMode: 'governed_provisional_listing' }),
    )

    const results: Array<Record<string, unknown>> = []
    let importedCount = 0
    let duplicateCount = 0
    let rejectedCount = 0
    let reviewCount = 0
    let errorCount = 0

    for (const raw of inputs) {
      try {
        const displayName = text(raw.displayName, 160)
        const primaryCategory = text(raw.primaryCategory, 80)
        const additionalCategories = stringList(raw.additionalCategories, 8).filter((category) => PROVIDER_CATEGORY_VALUES.has(category) && category !== primaryCategory)
        const country = text(raw.country, 120) || 'Zimbabwe'
        const province = nullableText(raw.province, 120)
        const district = nullableText(raw.district, 120)
        const city = nullableText(raw.city, 120)
        const serviceAreas = stringList(raw.serviceAreas, 50)
        const website = httpsUrl(raw.website)
        const publicEmail = email(raw.publicEmail)
        const phone = nullableText(raw.phone, 80)
        const links = socialLinks(raw.socialLinks)
        const headline = nullableText(raw.headline, 180)
        const description = nullableText(raw.description, 4000)
        const details = objectValue(raw.details)
        const fieldConfidence = objectValue(raw.fieldConfidence)
        const aggregateConfidence = confidence(raw.aggregateConfidence)
        const sources = normalizeSources(raw.sources)
        const normalizedName = normalizeName(displayName)

        if (!displayName || !normalizedName || !PROVIDER_CATEGORY_VALUES.has(primaryCategory)) {
          rejectedCount += 1
          results.push({ displayName: displayName || null, status: 'rejected', error: 'Business name and canonical category are required.' })
          continue
        }
        if (country.toLowerCase() !== 'zimbabwe') {
          rejectedCount += 1
          results.push({ displayName, status: 'rejected', error: 'This import is restricted to Zimbabwe.' })
          continue
        }
        if (sources.length === 0 || sources.some((source) => source.termsStatus === 'prohibited' || source.robotsStatus === 'disallowed')) {
          rejectedCount += 1
          results.push({ displayName, status: 'rejected', error: 'At least one permitted public or licensed source is required.' })
          continue
        }

        const candidateDedupeKey = dedupeKey({ normalizedName, city, website, phone })
        const provenance = sources.map((source) => ({
          sourceType: source.sourceType,
          sourceUrl: source.sourceUrl,
          sourceName: source.sourceName,
          accessMethod: source.accessMethod,
          collectedAt: source.collectedAt || new Date().toISOString(),
          confidence: source.confidence,
        }))
        const candidateId = createBusinessId('provider-candidate')
        const publishable = aggregateConfidence >= publishThreshold

        const duplicates = await db.$queryRawUnsafe<Array<{
          profileId: string
          businessAccountId: string
          listingStatus: string
          ownerConfirmedAt: Date | null
        }>>(
          `SELECT
             p.id AS "profileId",
             p."businessAccountId",
             p."listingStatus",
             p."ownerConfirmedAt"
           FROM wewed_admin."ProviderProfile" p
           WHERE
             ($1::text IS NOT NULL AND p.website IS NOT NULL AND lower(split_part(split_part(regexp_replace(p.website, '^https?://(www\\.)?', ''), '/', 1), ':', 1)) = lower($1)) OR
             ($2::text IS NOT NULL AND p.phone IS NOT NULL AND regexp_replace(p.phone, '\\D', '', 'g') LIKE '%' || $2) OR
             (lower(regexp_replace(p."displayName", '[^a-zA-Z0-9]+', ' ', 'g')) = lower($3) AND COALESCE(lower(p.city), '') = COALESCE(lower($4), ''))
           LIMIT 1`,
          websiteHost(website) || null,
          phoneKey(phone) || null,
          normalizedName,
          city,
        )
        const duplicate = duplicates[0]

        await db.$executeRawUnsafe(
          `INSERT INTO wewed_admin."ProviderDiscoveryCandidate" (
             id, "jobId", "displayName", "normalizedName", "primaryCategory", "additionalCategories",
             country, province, district, city, "serviceAreas", website, "publicEmail", phone,
             "socialLinks", headline, description, details, "dataProvenance", "fieldConfidence",
             "aggregateConfidence", "dedupeKey", status, "rightsStatus", "reviewedByUserId",
             "reviewNotes", "reviewedAt", "createdAt", "updatedAt"
           ) VALUES (
             $1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,
             $15::jsonb,$16,$17,$18::jsonb,$19::jsonb,$20::jsonb,$21,$22,$23,
             'facts_only',$24,$25,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
           )
           ON CONFLICT ("dedupeKey") DO UPDATE SET
             "jobId" = EXCLUDED."jobId",
             "dataProvenance" = EXCLUDED."dataProvenance",
             "fieldConfidence" = EXCLUDED."fieldConfidence",
             "aggregateConfidence" = GREATEST(wewed_admin."ProviderDiscoveryCandidate"."aggregateConfidence", EXCLUDED."aggregateConfidence"),
             "updatedAt" = CURRENT_TIMESTAMP`,
          candidateId,
          jobId,
          displayName,
          normalizedName,
          primaryCategory,
          JSON.stringify(additionalCategories),
          country,
          province,
          district,
          city,
          JSON.stringify(serviceAreas),
          website,
          publicEmail,
          phone,
          JSON.stringify(links),
          headline,
          description,
          JSON.stringify(details),
          JSON.stringify(provenance),
          JSON.stringify(fieldConfidence),
          aggregateConfidence,
          candidateDedupeKey,
          duplicate ? 'duplicate' : publishable ? 'approved' : 'needs_review',
          admin.session.userId,
          duplicate ? `Matched existing provider ${duplicate.profileId}` : publishable ? 'Passed configured publication threshold.' : 'Below configured publication threshold.',
        )

        const candidateRows = await db.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM wewed_admin."ProviderDiscoveryCandidate" WHERE "dedupeKey" = $1 LIMIT 1`,
          candidateDedupeKey,
        )
        const persistedCandidateId = candidateRows[0]?.id || candidateId

        for (const source of sources) {
          await db.$executeRawUnsafe(
            `INSERT INTO wewed_admin."ProviderDiscoverySource" (
               id, "candidateId", "sourceType", "sourceUrl", "sourceName", "accessMethod",
               "termsStatus", "robotsStatus", confidence, evidence, "mediaReuseAllowed",
               "collectedAt", "lastCheckedAt", "createdAt"
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,false,COALESCE($11::timestamp,CURRENT_TIMESTAMP),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
             ON CONFLICT ("candidateId", "sourceUrl") DO UPDATE SET
               "sourceType" = EXCLUDED."sourceType",
               "sourceName" = EXCLUDED."sourceName",
               "accessMethod" = EXCLUDED."accessMethod",
               "termsStatus" = EXCLUDED."termsStatus",
               "robotsStatus" = EXCLUDED."robotsStatus",
               confidence = GREATEST(wewed_admin."ProviderDiscoverySource".confidence, EXCLUDED.confidence),
               evidence = EXCLUDED.evidence,
               "lastCheckedAt" = CURRENT_TIMESTAMP`,
            createBusinessId('provider-source'),
            persistedCandidateId,
            source.sourceType,
            source.sourceUrl,
            source.sourceName,
            source.accessMethod,
            source.termsStatus,
            source.robotsStatus,
            source.confidence,
            JSON.stringify(source.evidence),
            source.collectedAt,
          )
        }

        if (duplicate) {
          duplicateCount += 1
          results.push({ displayName, status: 'duplicate', profileId: duplicate.profileId })
          continue
        }
        if (!publishable) {
          reviewCount += 1
          results.push({ displayName, status: 'needs_review', aggregateConfidence, publishThreshold })
          continue
        }

        const businessAccountId = createBusinessId(primaryCategory === 'venue' ? 'discovered-venue' : 'discovered-vendor')
        const profileId = createBusinessId('provider-profile')
        const profileSlug = await uniqueSlug(slugify(`${displayName}-${city || 'zimbabwe'}`))
        const categories = [primaryCategory, ...additionalCategories]
        const profileCompletion = Math.min(59, [displayName, city, website, phone, headline, description, serviceAreas.length > 0].filter(Boolean).length * 8)
        const summary = sourceSummary(sources)

        await db.$transaction(async (transaction) => {
          await transaction.$executeRawUnsafe(
            `INSERT INTO wewed_admin."BusinessAccount" (
               id, name, slug, type, status, "ownerUserId", "sourceType", "sourceId",
               "onboardingStatus", "subscriptionPlan", "subscriptionStatus", notes, metadata,
               "createdAt", "updatedAt"
             ) VALUES (
               $1,$2,$3,$4,'active',NULL,'marketplace_discovery',$5,
               'in_progress','free','free',$6,$7::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
             )`,
            businessAccountId,
            displayName,
            profileSlug,
            primaryCategory === 'venue' ? 'venue' : 'vendor',
            persistedCandidateId,
            'Provisional marketplace listing. No owner authority has been assigned.',
            JSON.stringify({
              marketplaceListing: {
                status: 'unclaimed',
                candidateId: persistedCandidateId,
                importedByUserId: admin.session.userId,
                mediaPolicy: 'category_placeholder_only_until_owner_authorisation',
              },
            }),
          )

          await transaction.$executeRawUnsafe(
            `INSERT INTO wewed_admin."ProviderProfile" (
               id, "businessAccountId", slug, "displayName", headline, description,
               country, city, "serviceAreas", languages, "publicEmail", phone, website,
               "socialLinks", "coverImageUrl", "verificationBadges", visibility,
               "completionScore", "publishedAt", "lastProfileUpdate", "listingStatus",
               "isClaimable", "acceptingEnquiries", "sourceSummary", "dataProvenance",
               "fieldConfidence", "lastSourceCheckAt", "provisionalPublishedAt", "claimNotice",
               "createdAt", "updatedAt"
             ) VALUES (
               $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'[]'::jsonb,$10,$11,$12,
               $13::jsonb,NULL,'[]'::jsonb,'published',$14,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,
               'unclaimed',true,false,$15,$16::jsonb,$17::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,
               'Own this business? Claim this listing to verify and manage it.',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
             )`,
            profileId,
            businessAccountId,
            profileSlug,
            displayName,
            headline,
            description,
            country,
            city,
            JSON.stringify(serviceAreas.length > 0 ? serviceAreas : city ? [city] : []),
            publicEmail,
            phone,
            website,
            JSON.stringify(links),
            profileCompletion,
            summary,
            JSON.stringify(provenance),
            JSON.stringify(fieldConfidence),
          )

          for (const category of categories) {
            const offeringId = createBusinessId('provider-offering')
            await transaction.$executeRawUnsafe(
              `INSERT INTO wewed_admin."ProviderServiceOffering" (
                 id, "businessAccountId", category, "displayName", description, status,
                 currency, "serviceAreas", inclusions, details, "completionScore", "publishedAt",
                 "sourceConfidence", "dataProvenance", "createdAt", "updatedAt"
               ) VALUES (
                 $1,$2,$3,$4,$5,'published','USD',$6::jsonb,'[]'::jsonb,$7::jsonb,$8,
                 CURRENT_TIMESTAMP,$9,$10::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
               )`,
              offeringId,
              businessAccountId,
              category,
              category === primaryCategory ? displayName : `${displayName} · ${categoryName(category)}`,
              category === primaryCategory ? description : null,
              JSON.stringify(serviceAreas.length > 0 ? serviceAreas : city ? [city] : []),
              JSON.stringify(category === primaryCategory ? details : {}),
              category === primaryCategory ? Math.min(59, profileCompletion) : 16,
              aggregateConfidence,
              JSON.stringify(provenance),
            )
          }

          await transaction.$executeRawUnsafe(
            `UPDATE wewed_admin."ProviderDiscoveryCandidate"
             SET status = 'imported', "importedBusinessAccountId" = $1, "updatedAt" = CURRENT_TIMESTAMP
             WHERE id = $2`,
            businessAccountId,
            persistedCandidateId,
          )
        })

        await writeBusinessAudit({
          actorUserId: admin.session.userId,
          businessAccountId,
          action: 'provider_discovery.provisional_listing_imported',
          resourceType: 'provider_profile',
          resourceId: profileId,
          details: {
            jobId,
            candidateId: persistedCandidateId,
            categories,
            aggregateConfidence,
            sourceCount: sources.length,
            listingStatus: 'unclaimed',
            acceptingEnquiries: false,
            mediaImported: false,
          },
        })

        importedCount += 1
        results.push({ displayName, status: 'imported', businessAccountId, profileId, slug: profileSlug })
      } catch (error) {
        errorCount += 1
        results.push({ displayName: text(raw.displayName, 160) || null, status: 'error', error: error instanceof Error ? error.message : 'Import failed.' })
      }
    }

    await db.$executeRawUnsafe(
      `UPDATE wewed_admin."ProviderDiscoveryJob"
       SET status = 'completed',
           "discoveredCount" = $2,
           "reviewedCount" = $3,
           "importedCount" = $4,
           "duplicateCount" = $5,
           "rejectedCount" = $6,
           "errorCount" = $7,
           "completedAt" = CURRENT_TIMESTAMP,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1`,
      jobId,
      inputs.length,
      inputs.length - errorCount,
      importedCount,
      duplicateCount,
      rejectedCount,
      errorCount,
    )

    return NextResponse.json({
      success: true,
      jobId,
      publishThreshold,
      summary: {
        received: inputs.length,
        imported: importedCount,
        needsReview: reviewCount,
        duplicates: duplicateCount,
        rejected: rejectedCount,
        errors: errorCount,
      },
      results,
    })
  } catch (error) {
    if (error instanceof WewedAdminAccessError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    console.error('[admin/providers/discovery/import] Error:', error)
    return NextResponse.json({ success: false, error: 'Unable to import provider candidates.' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
