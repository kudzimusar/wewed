import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createServerClient } from '@/lib/supabase/server'
import { marketplaceAudit, stringList, text } from '@/lib/marketplace-access'

const PROVIDER_CATEGORIES = new Set([
  'venue',
  'photography',
  'florals',
  'catering',
  'entertainment',
  'decor-rentals',
  'beauty',
  'transport',
  'stationery',
  'other',
])
const VISIBILITY = new Set(['draft', 'published'])

type ProviderBusiness = {
  businessAccountId: string
  businessName: string
  businessSlug: string
  businessType: 'venue' | 'vendor'
  metadata: Record<string, unknown> | null
  userId: string
}

function errorResponse(message: string, status: 400 | 401 | 403 | 404 | 409 | 500) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function httpsUrl(value: unknown, label: string): string | null {
  const normalized = text(value, 500)
  if (!normalized) return null
  try {
    const url = new URL(normalized)
    if (url.protocol !== 'https:') throw new Error('not https')
    return url.toString()
  } catch {
    throw new Error(`${label} must be a valid HTTPS URL.`)
  }
}

async function providerContext(): Promise<ProviderBusiness | null | 'signed-out'> {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user?.email) return 'signed-out'

  const rows = await db.$queryRawUnsafe<ProviderBusiness[]>(
    `SELECT
       ba.id AS "businessAccountId",
       ba.name AS "businessName",
       ba.slug AS "businessSlug",
       ba.type AS "businessType",
       ba.metadata,
       u.id AS "userId"
     FROM public."User" u
     JOIN public."BusinessAccountMember" bam
       ON bam."userId" = u.id
      AND bam.status = 'active'
     JOIN public."BusinessAccount" ba
       ON ba.id = bam."businessAccountId"
      AND ba.type IN ('venue', 'vendor')
      AND ba.status = 'active'
      AND ba."onboardingStatus" = 'complete'
     WHERE lower(u.email) = lower($1)
       AND u."isActive" = true
     ORDER BY CASE bam.role WHEN 'business_owner' THEN 0 ELSE 1 END, ba."createdAt"
     LIMIT 1`,
    user.email,
  )

  return rows[0] ?? null
}

function profileFrom(context: ProviderBusiness) {
  const metadata = context.metadata && typeof context.metadata === 'object' ? context.metadata : {}
  const stored = metadata.publicProfile && typeof metadata.publicProfile === 'object'
    ? metadata.publicProfile as Record<string, unknown>
    : {}

  return {
    displayName: typeof stored.displayName === 'string' ? stored.displayName : context.businessName,
    headline: typeof stored.headline === 'string' ? stored.headline : '',
    description: typeof stored.description === 'string' ? stored.description : '',
    category: typeof stored.category === 'string'
      ? stored.category
      : context.businessType === 'venue' ? 'venue' : 'other',
    serviceAreas: stringList(stored.serviceAreas, 30),
    services: stringList(stored.services, 30),
    website: typeof stored.website === 'string' ? stored.website : '',
    phone: typeof stored.phone === 'string' ? stored.phone : '',
    imageUrl: typeof stored.imageUrl === 'string' ? stored.imageUrl : '',
    visibility: stored.visibility === 'published' ? 'published' : 'draft',
  }
}

export async function GET() {
  try {
    const context = await providerContext()
    if (context === 'signed-out') return errorResponse('Sign in with your approved provider account.', 401)
    if (!context) return errorResponse('No active venue or vendor business is connected to this account.', 403)

    return NextResponse.json({
      success: true,
      business: {
        id: context.businessAccountId,
        name: context.businessName,
        slug: context.businessSlug,
        type: context.businessType,
      },
      profile: profileFrom(context),
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

    const displayName = text(body.displayName, 160) ?? context.businessName
    const category = typeof body.category === 'string' && PROVIDER_CATEGORIES.has(body.category)
      ? body.category
      : context.businessType === 'venue' ? 'venue' : 'other'
    const visibility = typeof body.visibility === 'string' && VISIBILITY.has(body.visibility)
      ? body.visibility
      : 'draft'

    let website: string | null
    let imageUrl: string | null
    try {
      website = httpsUrl(body.website, 'Website')
      imageUrl = httpsUrl(body.imageUrl, 'Image URL')
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : 'Profile URL is invalid.', 400)
    }

    const profile = {
      displayName,
      headline: text(body.headline, 180),
      description: text(body.description, 4000),
      category,
      serviceAreas: stringList(body.serviceAreas, 30),
      services: stringList(body.services, 30),
      website,
      phone: text(body.phone, 80),
      imageUrl,
      visibility,
      updatedAt: new Date().toISOString(),
    }

    await db.$executeRawUnsafe(
      `UPDATE public."BusinessAccount"
       SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{publicProfile}', $2::jsonb, true),
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE id = $1`,
      context.businessAccountId,
      JSON.stringify(profile),
    )

    await marketplaceAudit({
      actorUserId: context.userId,
      businessAccountId: context.businessAccountId,
      action: 'provider_profile.updated',
      resourceType: 'provider_profile',
      resourceId: context.businessAccountId,
      details: { category, visibility },
    })

    return NextResponse.json({ success: true, profile })
  } catch (error) {
    console.error('[providers/profile] PUT error:', error)
    return errorResponse('Unable to save the provider profile.', 500)
  }
}

export const dynamic = 'force-dynamic'
