import { previewWeddingMutationBlocked } from '@/lib/preview-write-safety'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  normalizePhysicalInvitationCode,
  physicalInvitationDestinationId,
} from '@/lib/physical-invitation-code'
import { setWeddingSharedInvitationCookie } from '@/lib/wedding-shared-invitation-session'

interface Params {
  params: Promise<{ slug: string }>
}

function relativeRedirect(location: string): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: location,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  })
}

export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const rawCode = request.nextUrl.searchParams.get('code')?.trim() || ''
  if (!rawCode) {
    return relativeRedirect(
      `/w/${encodeURIComponent(slug)}?accessError=missing`,
    )
  }

  const code = normalizePhysicalInvitationCode(rawCode)
  const destinationId = physicalInvitationDestinationId(code)
  if (destinationId) {
    const destination = await db.qRDestination.findFirst({
      where: {
        id: destinationId,
        wedding: { slug },
        type: 'physical_invitation',
        isActive: true,
      },
      select: {
        id: true,
        weddingId: true,
        wedding: { select: { privacy: true } },
      },
    })

    if (destination && destination.wedding.privacy !== 'private') {
      if (!previewWeddingMutationBlocked(destination.weddingId)) await db.qRDestination.update({
        where: { id: destination.id },
        data: { scanCount: { increment: 1 } },
      })

      const response = relativeRedirect(
        `/w/${encodeURIComponent(slug)}?source=printed-invitation`,
      )
      setWeddingSharedInvitationCookie(response, {
        weddingId: destination.weddingId,
        destinationId: destination.id,
      })
      return response
    }
  }

  // Preserve the existing per-guest fallback for RSVP tokens. Bulk physical
  // invitation codes are checked first; a personal token continues through
  // the established guest-session exchange without changing RSVP semantics.
  const guestQuery = new URLSearchParams({ token: rawCode })
  return relativeRedirect(
    `/api/weddings/${encodeURIComponent(slug)}/guest-session/exchange?${guestQuery.toString()}`,
  )
}
