import { previewWeddingMutationBlocked } from '@/lib/preview-write-safety'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeInvitationCardStyle } from '@/lib/digital-invitation-card'
import { clearPendingInvitationCookie } from '@/lib/pending-invitation'
import {
  normalizePhysicalInvitationCode,
  physicalInvitationDestinationId,
} from '@/lib/physical-invitation-code'
import { clearWeddingGuestSessionCookie } from '@/lib/wedding-guest-session'
import {
  clearWeddingSharedInvitationCookie,
  setWeddingSharedInvitationCookie,
} from '@/lib/wedding-shared-invitation-session'

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return response
}

function clearPersonalInvitationContext(response: NextResponse): void {
  clearPendingInvitationCookie(response)
  clearWeddingGuestSessionCookie(response)
}

function clearAllInvitationContext(response: NextResponse): void {
  clearPersonalInvitationContext(response)
  clearWeddingSharedInvitationCookie(response)
}

function invalidInvitation(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(
    new URL('/guest-access-help?reason=invalid-invitation', request.url),
  )
  clearAllInvitationContext(response)
  return noStore(response)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await params
  const code = normalizePhysicalInvitationCode(rawCode)
  const destinationId = physicalInvitationDestinationId(code)

  if (!code || !destinationId) return invalidInvitation(request)

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
    return invalidInvitation(request)
  }

  if (!previewWeddingMutationBlocked(destination.weddingId)) {
    await db.qRDestination.update({
      where: { id: destination.id },
      data: { scanCount: { increment: 1 } },
    })
  }

  const destinationUrl = new URL(
    `/w/${encodeURIComponent(destination.wedding.slug)}`,
    request.url,
  )
  destinationUrl.searchParams.set('source', 'printed-invitation')

  // The printed QR selects the wedding's configured invitation style. Do not
  // let a user-supplied query string override the planner/couple's choice.
  // The dedicated preview wedding remains pinned to the approved Ivory UAT
  // benchmark until the shared preview database receives the premium-style
  // persistence migration.
  const isDedicatedPreviewWedding =
    process.env.VERCEL_ENV === 'preview' &&
    process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID === destination.weddingId
  const selectedCard = isDedicatedPreviewWedding
    ? 'ivory-floral-gold'
    : normalizeInvitationCardStyle(destination.wedding.invitationCardStyle)
  destinationUrl.searchParams.set('card', selectedCard)

  const response = NextResponse.redirect(destinationUrl)
  clearPersonalInvitationContext(response)
  setWeddingSharedInvitationCookie(response, {
    weddingId: destination.weddingId,
    destinationId: destination.id,
  })

  return noStore(response)
}
