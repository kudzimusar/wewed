import { NextRequest, NextResponse } from 'next/server'
import { consumeAiRateLimit } from '@/lib/ai/rate-limit'
import { runWewedAi, WewedAiPolicyError, WewedAiUnavailableError } from '@/lib/ai/core'
import { marketplaceAiPricingFacts } from '@/lib/ai/core/marketplace-public-facts'
import { db } from '@/lib/db'

const MAX_REQUESTS = 8
const WINDOW_MS = 60_000
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const OUTCOMES = new Set([
  'understand_service',
  'compare_options',
  'structure_need',
  'prepare_enquiry',
])

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').slice(0, 30)
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 30) : []
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 30)
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

export async function POST(request: NextRequest) {
  let limit
  try {
    limit = await consumeAiRateLimit({
      scope: 'ai-marketplace-concierge',
      identity: clientKey(request),
      maxRequests: MAX_REQUESTS,
      windowMs: WINDOW_MS,
    })
  } catch (error) {
    console.error('[AI MARKETPLACE] Rate limiter unavailable:', error)
    return NextResponse.json({ success: false, error: 'AI request controls are temporarily unavailable.' }, { status: 503 })
  }

  if (!limit.ok) {
    return NextResponse.json(
      { success: false, error: 'Please wait a moment before asking Wewed again.', retryAfterMs: limit.retryAfterMs },
      { status: 429, headers: limit.retryAfterMs ? { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1_000)) } : undefined },
    )
  }

  let body: { providerSlug?: unknown; input?: unknown; outcome?: unknown }
  try { body = await request.json() as typeof body }
  catch { return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 }) }

  const providerSlug = typeof body.providerSlug === 'string' ? body.providerSlug.trim().toLowerCase() : ''
  const input = typeof body.input === 'string' ? body.input.trim() : ''
  const rawOutcome = typeof body.outcome === 'string' ? body.outcome.trim() : ''
  if (rawOutcome && !OUTCOMES.has(rawOutcome)) {
    return NextResponse.json({ success: false, error: 'Unsupported Marketplace Concierge outcome.' }, { status: 400 })
  }
  const outcome = rawOutcome || 'structure_need'
  if (!SLUG.test(providerSlug)) return NextResponse.json({ success: false, error: 'A valid provider is required.' }, { status: 400 })
  if (!input || input.length > 4_000) return NextResponse.json({ success: false, error: 'Ask Wewed a question up to 4,000 characters.' }, { status: 400 })

  try {
    const profiles = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT p.id, p.slug, p."displayName", p.headline, p.description, p.country, p.city,
              p."serviceAreas", p.languages, p."yearsOperating", p."responseTime",
              p."minimumBookingNotice", p."depositPolicy", p."cancellationPolicy",
              p."travelPolicy", p."accessibilitySupport", p."culturalExperience",
              p."verificationBadges", p."listingStatus", p."acceptingEnquiries",
              ba.id AS "businessAccountId"
       FROM public."ProviderProfile" p
       JOIN public."BusinessAccount" ba
         ON ba.id = p."businessAccountId"
        AND ba.type IN ('venue', 'vendor')
        AND ba.status = 'active'
        AND (ba."onboardingStatus" = 'complete' OR p."listingStatus" IN ('unclaimed', 'claim_pending'))
       WHERE p.slug = $1 AND p.visibility = 'published' AND p."listingStatus" NOT IN ('suspended', 'removed')
       LIMIT 1`,
      providerSlug,
    )
    const profile = profiles[0]
    if (!profile) return NextResponse.json({ success: false, error: 'Published provider profile not found.' }, { status: 404 })

    const acceptingEnquiries = profile.acceptingEnquiries !== false
    if (outcome === 'prepare_enquiry' && !acceptingEnquiries) {
      return NextResponse.json(
        { success: false, error: 'This provider is not currently accepting enquiries. Wewed can still help you understand or compare the published services.' },
        { status: 409 },
      )
    }

    const offerings = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, category, "displayName", description, "startingPriceCents", "maximumPriceCents",
              currency, "pricingModel", "pricingVisibility", "minimumCapacity", "maximumCapacity",
              "bookingLeadTime", "serviceAreas", inclusions, details
       FROM public."ProviderServiceOffering"
       WHERE "businessAccountId" = $1 AND status = 'published'
       ORDER BY "createdAt", category
       LIMIT 30`,
      profile.businessAccountId,
    )

    const facts = {
      provider: {
        id: String(profile.id),
        slug: String(profile.slug),
        displayName: String(profile.displayName),
        headline: typeof profile.headline === 'string' ? profile.headline : null,
        description: typeof profile.description === 'string' ? profile.description : null,
        country: typeof profile.country === 'string' ? profile.country : null,
        city: typeof profile.city === 'string' ? profile.city : null,
        serviceAreas: list(profile.serviceAreas),
        languages: list(profile.languages),
        yearsOperating: typeof profile.yearsOperating === 'number' ? profile.yearsOperating : null,
        responseTime: typeof profile.responseTime === 'string' ? profile.responseTime : null,
        minimumBookingNotice: typeof profile.minimumBookingNotice === 'string' ? profile.minimumBookingNotice : null,
        depositPolicy: typeof profile.depositPolicy === 'string' ? profile.depositPolicy : null,
        cancellationPolicy: typeof profile.cancellationPolicy === 'string' ? profile.cancellationPolicy : null,
        travelPolicy: typeof profile.travelPolicy === 'string' ? profile.travelPolicy : null,
        accessibilitySupport: typeof profile.accessibilitySupport === 'string' ? profile.accessibilitySupport : null,
        culturalExperience: typeof profile.culturalExperience === 'string' ? profile.culturalExperience : null,
        verificationBadges: list(profile.verificationBadges),
        listingStatus: String(profile.listingStatus || 'claimed'),
        acceptingEnquiries,
      },
      offerings: offerings.map((offering) => ({
        id: String(offering.id),
        category: String(offering.category),
        displayName: String(offering.displayName),
        description: typeof offering.description === 'string' ? offering.description : null,
        ...marketplaceAiPricingFacts(offering),
        currency: String(offering.currency || 'USD'),
        pricingModel: typeof offering.pricingModel === 'string' ? offering.pricingModel : null,
        minimumCapacity: typeof offering.minimumCapacity === 'number' ? offering.minimumCapacity : null,
        maximumCapacity: typeof offering.maximumCapacity === 'number' ? offering.maximumCapacity : null,
        bookingLeadTime: typeof offering.bookingLeadTime === 'string' ? offering.bookingLeadTime : null,
        serviceAreas: list(offering.serviceAreas),
        inclusions: list(offering.inclusions),
        details: objectValue(offering.details),
      })),
    }

    const authority = outcome === 'prepare_enquiry' ? 'prepare' : outcome === 'structure_need' ? 'suggest' : 'explain'
    const result = await runWewedAi({
      skill: 'marketplace_concierge',
      outcome,
      authority,
      input,
      context: {
        actor: { role: 'public', permissions: ['marketplace.public.read'] },
        surface: { route: `/vendors/${providerSlug}`, entityType: 'provider', entityId: String(profile.id), intent: outcome },
        dataProfile: 'public',
        facts,
        allowedTools: ['marketplace.read'],
        actionBoundary: acceptingEnquiries ? 'prepare' : 'suggest',
      },
    })

    const { modelReleaseId, promptReleaseId, skillVersion, generatedAt } = result.provenance
    return NextResponse.json({
      success: true,
      result: {
        traceId: result.traceId,
        summary: result.summary,
        facts: result.facts,
        recommendations: result.recommendations,
        missingInformation: result.missingInformation,
        proposedActions: result.proposedActions,
        warnings: result.warnings,
        provenance: { modelReleaseId, promptReleaseId, skillVersion, generatedAt },
      },
    })
  } catch (error) {
    if (error instanceof WewedAiPolicyError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: 400 })
    }
    if (error instanceof WewedAiUnavailableError) {
      console.error('[AI MARKETPLACE] Core unavailable:', error)
      return NextResponse.json({ success: false, error: 'Wewed AI is temporarily unavailable. You can still browse services and send a normal enquiry.' }, { status: 503 })
    }
    console.error('[AI MARKETPLACE] Request failed:', error)
    return NextResponse.json({ success: false, error: 'Marketplace guidance is temporarily unavailable.' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    service: 'Wewed Marketplace Concierge',
    core: true,
    authority: ['explain', 'suggest', 'prepare'],
    deterministicBoundaries: ['price', 'availability', 'booking', 'payment', 'contribution', 'contract-consent'],
  })
}
