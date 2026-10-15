'use client'

import type { DigitalInvitationCardData } from '@/components/wedding/digital-invitation-card'
import { PhysicalInvitationClaim } from '@/components/wedding/physical-invitation-claim'
import type { InvitationCardStyle } from '@/lib/digital-invitation-card'

/**
 * Printed invitation entry points are deliberately platform-neutral.
 *
 * A physical QR code can be scanned by iPhone, Android, desktop browsers,
 * in-app browsers, or accessibility tools. The QR must therefore reveal the
 * secure shared invitation first instead of gating the guest behind an app
 * store or platform-specific install flow.
 *
 * App-specific handoff remains an optional action elsewhere in the product;
 * it is not a prerequisite for opening a printed invitation.
 */
export function PhysicalInvitationEntry({
  slug,
  invitation,
  style,
  allowNameOnlyClaim = false,
}: {
  slug: string
  weddingTitle: string
  invitation: DigitalInvitationCardData
  style: InvitationCardStyle
  allowNameOnlyClaim?: boolean
  deferredInstallEnabled: boolean
  insideWewed?: boolean
}) {
  return (
    <PhysicalInvitationClaim
      slug={slug}
      invitation={invitation}
      style={style}
      allowNameOnlyClaim={allowNameOnlyClaim}
    />
  )
}
