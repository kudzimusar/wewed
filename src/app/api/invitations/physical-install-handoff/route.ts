import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeInvitationCardStyle } from '@/lib/digital-invitation-card'
import {
  createPhysicalInvitationInstallHandoff,
  PhysicalInvitationHandoffRateLimitError,
} from '@/lib/physical-invitation-install-handoff'
import { previewWriteError } from '@/lib/preview-write-response'
import {
  verifyWeddingSharedInvitationSessionToken,
  WEDDING_SHARED_INVITATION_COOKIE,
} from '@/lib/wedding-shared-invitation-session'

export const dynamic = 'force-dynamic'

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || null
}

function json(body: Record<string, unknown>, status: number, headers?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
      ...headers,
    },
  })
}

export async function POST(request: NextRequest) {
  if (process.env.ANDROID_DEFERRED_INVITATION_HANDOFF !== '1') {
    return json({ error: 'deferred_install_unavailable', message: 'Secure invitation install handoff is temporarily unavailable.' }, 503)
  }

  const encoded = request.cookies.get(WEDDING_SHARED_INVITATION_COOKIE)?.value
  const shared = encoded ? verifyWeddingSharedInvitationSessionToken(encoded) : null
  if (!shared) {
    return json({ error: 'physical_invitation_missing', message: 'Please scan or open your original printed invitation again.' }, 401)
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
      wedding: { select: { privacy: true, invitationCardStyle: true } },
    },
  })
  if (!destination || destination.wedding.privacy === 'private') {
    return json({ error: 'physical_invitation_unavailable', message: 'Please scan or open your original printed invitation again.' }, 410)
  }

  const blocked = previewWriteError(destination.weddingId)
  if (blocked) return blocked

  const dedicatedUat =
    process.env.VERCEL_ENV === 'preview' &&
    process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID === destination.weddingId
  const card = dedicatedUat
    ? 'ivory-floral-gold'
    : normalizeInvitationCardStyle(destination.wedding.invitationCardStyle)

  try {
    const handoff = await createPhysicalInvitationInstallHandoff({
      destinationId: destination.id,
      weddingId: destination.weddingId,
      card,
      source: 'physical-android-install',
      ipAddress: clientIp(request),
      userAgent: request.headers.get('user-agent'),
    })
    return json({
      playStoreUrl: handoff.playStoreUrl,
      appResumePath: handoff.appResumePath,
      expiresAt: handoff.expiresAt.toISOString(),
    }, 201)
  } catch (error) {
    if (error instanceof PhysicalInvitationHandoffRateLimitError) {
      return json({ error: 'too_many_attempts', message: 'Please wait a moment and try again.' }, 429, { 'Retry-After': '60' })
    }
    console.error('[wewed] Failed to create physical invitation install handoff', {
      weddingId: destination.weddingId,
      destinationId: destination.id,
      error: error instanceof Error ? error.message : 'unknown',
    })
    return json({ error: 'handoff_failed', message: 'We could not prepare the secure invitation handoff. Please try again.' }, 500)
  }
}
