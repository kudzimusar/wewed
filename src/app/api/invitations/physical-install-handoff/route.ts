import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeInvitationCardStyle } from '@/lib/digital-invitation-card'
import { createPhysicalInvitationInstallHandoff } from '@/lib/physical-invitation-install-handoff'
import {
  verifyWeddingSharedInvitationSessionToken,
  WEDDING_SHARED_INVITATION_COOKIE,
} from '@/lib/wedding-shared-invitation-session'

export const dynamic = 'force-dynamic'

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

export async function POST(request: NextRequest) {
  if (process.env.ANDROID_DEFERRED_INVITATION_HANDOFF !== '1') {
    return json(
      {
        error: 'deferred_install_unavailable',
        message: 'Secure invitation install handoff is temporarily unavailable.',
      },
      503,
    )
  }

  const encoded = request.cookies.get(WEDDING_SHARED_INVITATION_COOKIE)?.value
  const shared = encoded ? verifyWeddingSharedInvitationSessionToken(encoded) : null
  if (!shared) {
    return json(
      {
        error: 'physical_invitation_missing',
        message: 'Please scan or open your original printed invitation again.',
      },
      401,
    )
  }

  const destination = await db.qRDestination.findFirst({
    where: {
      id: shared.destinationId,
      weddingId: shared.weddingId,
      type: 'physical_invitation',
      isActive: true,
    },
    select: {
      id: true,
      weddingId: true,
      wedding: {
        select: { privacy: true, invitationCardStyle: true },
      },
    },
  })

  if (!destination || destination.wedding.privacy === 'private') {
    return json(
      {
        error: 'physical_invitation_unavailable',
        message: 'Please scan or open your original printed invitation again.',
      },
      410,
    )
  }

  const dedicatedUat =
    process.env.VERCEL_ENV === 'preview' &&
    process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID === destination.weddingId
  const card = dedicatedUat
    ? 'ivory-floral-gold'
    : normalizeInvitationCardStyle(destination.wedding.invitationCardStyle)

  try {
    // Physical invitations are shared before the guest identifies themselves.
    // Keep the Play handoff stateless and encrypted: no personal identity exists
    // yet, and redemption always revalidates this active QR destination.
    const handoff = await createPhysicalInvitationInstallHandoff({
      destinationId: destination.id,
      weddingId: destination.weddingId,
      card,
    })
    return json(
      {
        playStoreUrl: handoff.playStoreUrl,
        appResumePath: handoff.appResumePath,
        expiresAt: handoff.expiresAt.toISOString(),
      },
      201,
    )
  } catch (error) {
    console.error('[wewed] Failed to create physical invitation install handoff', {
      weddingId: destination.weddingId,
      destinationId: destination.id,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return json(
      {
        error: 'handoff_failed',
        message: 'We could not prepare the secure invitation handoff. Please try again.',
      },
      500,
    )
  }
}
