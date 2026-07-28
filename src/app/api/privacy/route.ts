import { db } from '@/lib/db'
import {
  FLAGSHIP_WEDDING_SLUG,
  asPrivacyLevel,
  asSubscriptionTier,
  isCanonSealed,
  PRIVACY_LEVELS,
  SUBSCRIPTION_TIERS,
  type PrivacyLevel,
  type SubscriptionTier,
} from '@/lib/privacy'
import { NextRequest, NextResponse } from 'next/server'

/* ============================================================
   /api/privacy
   ------------------------------------------------------------
   • GET    → flagship wedding's privacy settings + canon status
   • PATCH  → update privacy level / canon seal (admin only)

   Admin gate
   ──────────
   The flagship uses a client-side admin auth (see
   src/lib/admin-auth.ts). The cookie `wewed_admin_auth` carries
   a 16-hex-char nonce that signals "the user authenticated
   recently". The cookie is NOT HttpOnly and carries no
   authority on its own — but for the MVP we trust its presence
   + format as a soft server-side gate. NextAuth (Phase 5) will
   replace this with proper server-verified sessions.
   ============================================================ */

const ADMIN_COOKIE_KEY = 'wewed_admin_auth'
const NONCE_PATTERN = /^[a-f0-9]{16}$/

interface AdminGateResult {
  ok: boolean
  reason?: string
}

function isAdminFromRequest(request: NextRequest): AdminGateResult {
  // 1) Cookie nonce check
  try {
    const cookie = request.cookies.get(ADMIN_COOKIE_KEY)?.value
    if (cookie && NONCE_PATTERN.test(cookie)) {
      return { ok: true }
    }
  } catch {
    /* ignore malformed cookies */
  }

  // 2) Localhost dev bypass: allow `?admin=1` to make local testing
  //    painless without exposing anything in production (the query
  //    param is not advertised).
  if (process.env.NODE_ENV !== 'production') {
    const url = new URL(request.url)
    if (url.searchParams.get('admin') === '1') {
      return { ok: true }
    }
  }

  return { ok: false, reason: 'admin auth required' }
}

/** Public response shape for the GET route. */
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

/** Build the public snapshot from a Prisma row (or nulls if missing). */
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

// ─── GET /api/privacy ────────────────────────────────────────
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

    const data = buildSnapshot(wedding)

    const body: PrivacySnapshotResponse = { success: true, data }
    return NextResponse.json(body, {
      headers: {
        // Privacy metadata is dynamic — don't cache at the edge
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('[PRIVACY GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch privacy settings' },
      { status: 500 },
    )
  }
}

// ─── PATCH /api/privacy ──────────────────────────────────────
interface PrivacyPatchPayload {
  privacy?: string
  canonSealed?: boolean
  subscriptionTier?: string
  /** Optional explicit weddingId; defaults to flagship. */
  weddingId?: string
}

export async function PATCH(
  request: NextRequest,
): Promise<NextResponse> {
  // 1) Admin gate
  const gate = isAdminFromRequest(request)
  if (!gate.ok) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', reason: gate.reason },
      { status: 401 },
    )
  }

  try {
    const body = (await request.json()) as PrivacyPatchPayload

    // 2) Validate inputs
    const updates: {
      privacy?: string
      canonSealed?: boolean
      canonSealedAt?: Date | null
      subscriptionTier?: string
    } = {}

    if (body.privacy !== undefined) {
      if (
        typeof body.privacy !== 'string' ||
        !PRIVACY_LEVELS.includes(body.privacy as PrivacyLevel)
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid privacy value. Allowed: ${PRIVACY_LEVELS.join(', ')}`,
          },
          { status: 400 },
        )
      }
      updates.privacy = body.privacy
    }

    if (body.subscriptionTier !== undefined) {
      if (
        typeof body.subscriptionTier !== 'string' ||
        !SUBSCRIPTION_TIERS.includes(body.subscriptionTier as SubscriptionTier)
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid subscriptionTier. Allowed: ${SUBSCRIPTION_TIERS.join(', ')}`,
          },
          { status: 400 },
        )
      }
      updates.subscriptionTier = body.subscriptionTier
    }

    if (body.canonSealed !== undefined) {
      if (typeof body.canonSealed !== 'boolean') {
        return NextResponse.json(
          { success: false, error: 'canonSealed must be a boolean' },
          { status: 400 },
        )
      }
      updates.canonSealed = body.canonSealed
      // Set the seal timestamp when first sealed; clear when unsealed
      updates.canonSealedAt = body.canonSealed ? new Date() : null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No updates provided. Send one of: privacy, canonSealed, subscriptionTier',
        },
        { status: 400 },
      )
    }

    // 3) Resolve the wedding row
    let weddingId = body.weddingId
    if (!weddingId) {
      const flagship = await db.wedding.findFirst({
        where: { slug: FLAGSHIP_WEDDING_SLUG },
        select: { id: true },
      })
      if (!flagship) {
        return NextResponse.json(
          { success: false, error: 'Flagship wedding not found. Seed the database first.' },
          { status: 404 },
        )
      }
      weddingId = flagship.id
    }

    // 4) Apply the update
    const updated = await db.wedding.update({
      where: { id: weddingId },
      data: updates,
      select: {
        id: true,
        slug: true,
        privacy: true,
        canonSealed: true,
        canonSealedAt: true,
        subscriptionTier: true,
      },
    })

    const data = buildSnapshot(updated)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[PRIVACY PATCH] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update privacy settings' },
      { status: 500 },
    )
  }
}
