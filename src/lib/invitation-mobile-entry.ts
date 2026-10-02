import 'server-only'

import type { NextRequest } from 'next/server'
import {
  createInvitationInstallHandoff,
  InvitationHandoffRateLimitError,
} from '@/lib/invitation-install-handoff'
import { PLAY_STORE_URL } from '@/lib/invitation-links'
import { readPendingInvitation } from '@/lib/pending-invitation'
import { resolvePersonalInvitation } from '@/lib/personal-invitation-access'
import { previewWeddingMutationBlocked } from '@/lib/preview-write-safety'
import { androidDeferredInvitationHandoffEnabled } from '@/lib/invitation-deferred-install'

export type PreparedInvitationMobileEntry =
  | {
      ok: true
      deferred: true
      playStoreUrl: string
      appResumePath: string
    }
  | {
      ok: true
      deferred: false
      playStoreUrl: string
      appResumePath: null
    }
  | {
      ok: false
      reason: 'missing' | 'invalid'
    }

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first || request.headers.get('x-real-ip')?.trim() || null
}

export async function prepareInvitationMobileEntry(
  request: NextRequest,
  weddingSlug: string,
  source: 'android-install-click' | 'android-open-app-click',
): Promise<PreparedInvitationMobileEntry> {
  const pending = readPendingInvitation(request)
  if (!pending || pending.weddingSlug !== weddingSlug) {
    return { ok: false, reason: 'missing' }
  }

  const invitation = await resolvePersonalInvitation({
    weddingSlug,
    token: pending.rsvpToken,
    requestedCard: pending.card,
  })
  if (!invitation) return { ok: false, reason: 'invalid' }

  const deferredInstallEnabled = androidDeferredInvitationHandoffEnabled(invitation.weddingId)

  // The install CTA is never gated. The feature flag controls seamless deferred
  // identity transfer only. If it is disabled, the guest still reaches Google Play.
  if (!deferredInstallEnabled || previewWeddingMutationBlocked(invitation.weddingId)) {
    return { ok: true, deferred: false, playStoreUrl: PLAY_STORE_URL, appResumePath: null }
  }

  try {
    const handoff = await createInvitationInstallHandoff({
      weddingId: invitation.weddingId,
      guestId: invitation.guestId,
      rsvpToken: invitation.rsvpToken,
      card: invitation.card,
      source,
      ipAddress: clientIp(request),
      userAgent: request.headers.get('user-agent'),
    })
    return {
      ok: true,
      deferred: true,
      playStoreUrl: handoff.playStoreUrl,
      appResumePath: handoff.appResumePath,
    }
  } catch (error) {
    // A transient handoff/rate-limit/database failure must never block installation.
    // Google Play remains reachable and the original invitation remains the recovery anchor.
    console.warn('[wewed] Falling back to direct Google Play invitation install', {
      source,
      weddingId: invitation.weddingId,
      reason:
        error instanceof InvitationHandoffRateLimitError
          ? 'rate_limited'
          : error instanceof Error
            ? error.name
            : 'unknown',
    })
    return { ok: true, deferred: false, playStoreUrl: PLAY_STORE_URL, appResumePath: null }
  }
}
