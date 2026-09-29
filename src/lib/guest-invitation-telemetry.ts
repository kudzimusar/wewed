import 'server-only'

import { db } from '@/lib/db'
import { previewWeddingMutationBlocked } from '@/lib/preview-write-safety'

export type GuestInvitationOpenSource = 'web_exchange' | 'guest_session_exchange'

/**
 * Technical delivery telemetry only.
 *
 * This records that a real personal invitation credential was redeemed. It never records
 * the credential itself and it never changes Guest/RSVP/Pass business state. Preview weddings
 * stay read-only. A telemetry failure must never prevent the guest from opening an invitation.
 */
export async function recordGuestInvitationOpened(input: {
  weddingId: string
  guestId: string
  source: GuestInvitationOpenSource
}): Promise<void> {
  if (previewWeddingMutationBlocked(input.weddingId)) return

  try {
    await db.auditEvent.create({
      data: {
        action: 'guest.invitation_opened',
        resourceType: 'guest_invitation',
        resourceId: input.guestId,
        afterValue: JSON.stringify({ source: input.source }),
        weddingId: input.weddingId,
      },
    })
  } catch (error) {
    console.warn('[guest invitation telemetry] unable to record open', {
      weddingId: input.weddingId,
      guestId: input.guestId,
      source: input.source,
      error: error instanceof Error ? error.message : 'unknown',
    })
  }
}
