import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  normalizePhysicalInvitationCode,
  physicalInvitationDestinationId,
} from '@/lib/physical-invitation-code'
import { setWeddingSharedInvitationCookie } from '@/lib/wedding-shared-invitation-session'

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return response
}

function invalidInvitation(request: NextRequest): NextResponse {
  return noStore(
    NextResponse.redirect(new URL('/guest-access-help?reason=invalid-invitation', request.url)),
  )
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

  await db.qRDestination.update({
    where: { id: destination.id },
    data: { scanCount: { increment: 1 } },
  })

  const response = NextResponse.redirect(
    new URL(
      `/w/${encodeURIComponent(destination.wedding.slug)}?source=printed-invitation`,
      request.url,
    ),
  )
  setWeddingSharedInvitationCookie(response, {
    weddingId: destination.weddingId,
    destinationId: destination.id,
  })

  return noStore(response)
}
