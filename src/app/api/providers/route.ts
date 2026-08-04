import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

function stringList(value: unknown, limit = 30): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, limit)
}

function publicProfile(row: Record<string, unknown>) {
  const metadata = row.metadata && typeof row.metadata === 'object'
    ? row.metadata as Record<string, unknown>
    : {}
  const profile = metadata.publicProfile && typeof metadata.publicProfile === 'object'
    ? metadata.publicProfile as Record<string, unknown>
    : {}

  return {
    id: String(row.id),
    slug: String(row.slug),
    accountType: String(row.type),
    displayName: typeof profile.displayName === 'string' && profile.displayName.trim()
      ? profile.displayName.trim()
      : String(row.name),
    headline: typeof profile.headline === 'string' ? profile.headline : null,
    description: typeof profile.description === 'string' ? profile.description : null,
    category: typeof profile.category === 'string'
      ? profile.category
      : row.type === 'venue' ? 'venue' : 'other',
    serviceAreas: stringList(profile.serviceAreas),
    services: stringList(profile.services),
    website: typeof profile.website === 'string' ? profile.website : null,
    phone: typeof profile.phone === 'string' ? profile.phone : null,
    imageUrl: typeof profile.imageUrl === 'string' ? profile.imageUrl : null,
  }
}

export async function GET(request: NextRequest) {
  const requestedCategory = request.nextUrl.searchParams.get('category')?.trim() || ''
  const category = PROVIDER_CATEGORIES.has(requestedCategory) ? requestedCategory : null

  try {
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, name, slug, type, metadata
       FROM public."BusinessAccount"
       WHERE type IN ('venue', 'vendor')
         AND status = 'active'
         AND "onboardingStatus" = 'complete'
         AND COALESCE(metadata->'publicProfile'->>'visibility', 'draft') = 'published'
         AND ($1::text IS NULL OR COALESCE(metadata->'publicProfile'->>'category', CASE WHEN type = 'venue' THEN 'venue' ELSE 'other' END) = $1)
       ORDER BY COALESCE(metadata->'publicProfile'->>'displayName', name)
       LIMIT 100`,
      category,
    )

    return NextResponse.json({
      success: true,
      category,
      providers: rows.map(publicProfile),
    })
  } catch (error) {
    console.error('[providers] Error:', error)
    return NextResponse.json(
      { success: false, providers: [], error: 'Provider profiles are temporarily unavailable.' },
      { status: 500 },
    )
  }
}

export const dynamic = 'force-dynamic'
