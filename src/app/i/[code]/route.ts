import { previewWeddingMutationBlocked } from '@/lib/preview-write-safety'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clearPendingInvitationCookie } from '@/lib/pending-invitation'
import {
  normalizePhysicalInvitationCode,
  physicalInvitationDestinationId,
} from '@/lib/physical-invitation-code'
import { clearWeddingGuestSessionCookie } from '@/lib/wedding-guest-session'
import { setWeddingSharedInvitationCookie } from '@/lib/wedding-shared-invitation-session'

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return response
}

function clearPersonalInvitationContext(response: NextResponse): void {
  clearPendingInvitationCookie(response)
  clearWeddingGuestSessionCookie(response)
}

function invalidInvitation(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(
    new URL('/guest-access-help?reason=invalid-invitation', request.url),
  )
  clearPersonalInvitationContext(response)
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
      wedding: { select: { slug: true, privacy: true } },
    },
  })

  if (!destination || destination.wedding.privacy === 'private') {
    return invalidInvitation(request)
  }

  if (!previewWeddingMutationBlocked(destination.weddingId)) await db.qRDestination.update({
    where: { id: destination.id },
    data: { scanCount: { increment: 1 } },
  })

  const response = NextResponse.redirect(
    new URL(
      `/w/${encodeURIComponent(destination.wedding.slug)}?source=printed-invitation`,
      request.url,
    ),
  )
  clearPersonalInvitationContext(response)
  setWeddingSharedInvitationCookie(response, {
    weddingId: destination.weddingId,
    destinationId: destination.id,
  })

  return noStore(response)
}
