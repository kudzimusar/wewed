import { previewWriteError } from '@/lib/preview-write-response'
import { NextRequest, NextResponse } from 'next/server'
import {
  createInvitationInstallHandoff,
  InvitationHandoffRateLimitError,
} from '@/lib/invitation-install-handoff'
import { readPendingInvitation } from '@/lib/pending-invitation'
import { resolvePersonalInvitation } from '@/lib/personal-invitation-access'

export const dynamic = 'force-dynamic'

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first || request.headers.get('x-real-ip')?.trim() || null
}

function json(
  body: Record<string, unknown>,
  status: number,
  extraHeaders?: Record<string, string>,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
      ...extraHeaders,
    },
  })
}

async function requestedSource(request: NextRequest): Promise<string> {
  try {
    const body = (await request.json()) as { source?: unknown }
    return typeof body.source === 'string' ? body.source : 'android-install-cta'
  } catch {
    return 'android-install-cta'
  }
}

export async function POST(request: NextRequest) {
  // Off by default. Enable only after Android versionCode 2+ containing Install
  // Referrer support is available in the intended Google Play track.
  if (process.env.ANDROID_DEFERRED_INVITATION_HANDOFF !== '1') {
    return json(
      {
        error: 'deferred_install_unavailable',
        message: 'Secure invitation install handoff is temporarily unavailable.',
      },
      503,
    )
  }

  const pending = readPendingInvitation(request)
  if (!pending) {
    return json(
      {
        error: 'invitation_missing',
        message: 'Please open your original Wewed invitation again.',
      },
      401,
    )
  }

  const invitation = await resolvePersonalInvitation({
    weddingSlug: pending.weddingSlug,
    token: pending.rsvpToken,
    requestedCard: pending.card,
  })

  if (!invitation) {
    await new Promise((resolve) => setTimeout(resolve, 120))
    return json(
      {
        error: 'invitation_unavailable',
        message: 'Please open your original Wewed invitation again.',
      },
      410,
    )
  }

  const blocked = previewWriteError(invitation.weddingId)
  if (blocked) return blocked

  try {
    const handoff = await createInvitationInstallHandoff({
      weddingId: invitation.weddingId,
      guestId: invitation.guestId,
      rsvpToken: invitation.rsvpToken,
      card: invitation.card,
      source: await requestedSource(request),
      ipAddress: clientIp(request),
      userAgent: request.headers.get('user-agent'),
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
    if (error instanceof InvitationHandoffRateLimitError) {
      return json(
        {
          error: 'too_many_attempts',
          message: 'Please wait a moment and try again.',
        },
        429,
        { 'Retry-After': '60' },
      )
    }

    console.error('[wewed] Failed to create invitation install handoff', {
      weddingId: invitation.weddingId,
      guestId: invitation.guestId,
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
