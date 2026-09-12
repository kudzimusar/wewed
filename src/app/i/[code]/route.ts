import { NextRequest, NextResponse } from 'next/server'
import { clearAndroidInvitationAppCookie } from '@/lib/android-invitation-app-session'
import { db } from '@/lib/db'
import { normalizeInvitationCardStyle } from '@/lib/digital-invitation-card'
import { clearPendingInvitationCookie } from '@/lib/pending-invitation'
import {
  normalizePhysicalInvitationCode,
  physicalInvitationDestinationId,
} from '@/lib/physical-invitation-code'
import { previewWeddingMutationBlocked } from '@/lib/preview-write-safety'
import { clearWeddingGuestSessionCookie } from '@/lib/wedding-guest-session'
import {
  clearWeddingSharedInvitationCookie,
  setWeddingSharedInvitationCookie,
} from '@/lib/wedding-shared-invitation-session'

function relativeRedirect(location: string): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: location,
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
      Vary: 'Cookie',
    },
  })
}

function clearPersonalInvitationContext(response: NextResponse): void {
  clearPendingInvitationCookie(response)
  clearWeddingGuestSessionCookie(response)
  clearAndroidInvitationAppCookie(response)
}

function clearAllInvitationContext(response: NextResponse): void {
  clearPersonalInvitationContext(response)
  clearWeddingSharedInvitationCookie(response)
}

function invalidInvitation(): NextResponse {
  const response = relativeRedirect(
    '/guest-access-help?reason=invalid-invitation',
  )
  clearAllInvitationContext(response)
  return response
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await params
  const code = normalizePhysicalInvitationCode(rawCode)
  const destinationId = physicalInvitationDestinationId(code)

  if (!code || !destinationId) return invalidInvitation()

  const destination = await db.qRDestination.findFirst({
    where: {
      id: destinationId,
      type: 'physical_invitation',
      isActive: true,
    },
    select: {
      id: true,
      weddingId: true,
      wedding: {
        select: {
          slug: true,
          privacy: true,
          invitationCardStyle: true,
        },
      },
    },
  })

  if (!destination || destination.wedding.privacy === 'private') {
    return invalidInvitation()
  }

  if (!previewWeddingMutationBlocked(destination.weddingId)) {
    await db.qRDestination.update({
      where: { id: destination.id },
      data: { scanCount: { increment: 1 } },
    })
  }

  const isDedicatedPreviewWedding =
    process.env.VERCEL_ENV === 'preview' &&
    process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID === destination.weddingId
  const selectedCard = isDedicatedPreviewWedding
    ? 'ivory-floral-gold'
    : normalizeInvitationCardStyle(destination.wedding.invitationCardStyle)
  const query = new URLSearchParams({
    source: 'printed-invitation',
    card: selectedCard,
  })
  const response = relativeRedirect(
    `/w/${encodeURIComponent(destination.wedding.slug)}?${query.toString()}`,
  )

  // Every fresh printed-QR scan returns to the Android entry gate. Only the
  // dedicated app-resume route may mint app reveal authority again.
  clearPersonalInvitationContext(response)
  setWeddingSharedInvitationCookie(response, {
    weddingId: destination.weddingId,
    destinationId: destination.id,
  })

  return response
}
