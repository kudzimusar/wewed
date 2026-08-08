import { db } from '@/lib/db'
import {
  FLAGSHIP_WEDDING_SLUG,
  asPrivacyLevel,
  asSubscriptionTier,
  isCanonSealed,
  type PrivacyLevel,
  type SubscriptionTier,
} from '@/lib/privacy'
import { NextResponse } from 'next/server'

/**
 * Legacy read-only privacy snapshot.
 *
 * Privacy mutations previously accepted a client-controlled admin nonce. That
 * cookie was not server-verifiable authority and therefore must never gate a
 * production write. Current privacy changes are wedding-scoped and authorized
 * through /api/couple/wedding-privacy; release and billing state stay in their
 * separately governed flows.
 */
interface PrivacySnapshotResponse {
  success: true
  data: {
    weddingId: string | null
    slug: string | null
    privacy: PrivacyLevel
    canonSealed: boolean
    canonSealedAt: string | null
    subscriptionTier: SubscriptionTier
    isCanonSealed: boolean
    label: string
    description: string
  }
}

function buildSnapshot(row: {
  id: string
  slug: string
  privacy: string | null
  canonSealed: boolean | null
  canonSealedAt: Date | null
  subscriptionTier: string | null
} | null): PrivacySnapshotResponse['data'] {
  const privacy = asPrivacyLevel(row?.privacy ?? null)
  const tier = asSubscriptionTier(row?.subscriptionTier ?? null)
  const sealed = isCanonSealed(row?.canonSealed ?? null)
  return {
    weddingId: row?.id ?? null,
    slug: row?.slug ?? null,
    privacy,
    canonSealed: sealed,
    canonSealedAt: row?.canonSealedAt ? row.canonSealedAt.toISOString() : null,
    subscriptionTier: tier,
    isCanonSealed: sealed,
    label: privacy,
    description: privacy,
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const wedding = await db.wedding.findFirst({
      where: { slug: FLAGSHIP_WEDDING_SLUG },
      select: {
        id: true,
        slug: true,
        privacy: true,
        canonSealed: true,
        canonSealedAt: true,
        subscriptionTier: true,
      },
    })

    const body: PrivacySnapshotResponse = { success: true, data: buildSnapshot(wedding) }
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    console.error('[PRIVACY GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch privacy settings' },
      { status: 500 },
    )
  }
}

export async function PATCH(): Promise<NextResponse> {
  return NextResponse.json(
    {
      success: false,
      code: 'LEGACY_PRIVACY_MUTATION_RETIRED',
      error: 'This legacy mutation endpoint is retired. Use the authorized wedding privacy flow.',
      replacement: '/api/couple/wedding-privacy',
    },
    {
      status: 410,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    },
  )
}
