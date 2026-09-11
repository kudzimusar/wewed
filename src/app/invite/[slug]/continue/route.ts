import { NextRequest, NextResponse } from 'next/server'
import { resolvePersonalInvitation } from '@/lib/personal-invitation-access'
import {
  clearPendingInvitationCookie,
  readPendingInvitation,
} from '@/lib/pending-invitation'
import {
  clearWeddingGuestSessionCookie,
  setWeddingGuestSessionCookie,
} from '@/lib/wedding-guest-session'

interface Params {
  params: Promise<{ slug: string }>
}

function relativeRedirect(location: string): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: location,
      'Cache-Control': 'private, no-store, max-age=0',
      Vary: 'Cookie',
    },
  })
}

function redirectToGateway(slug: string, error: string) {
  const query = new URLSearchParams({ accessError: error })
  return relativeRedirect(`/w/${encodeURIComponent(slug)}?${query.toString()}`)
}

function failedExchange(slug: string, error: string): NextResponse {
  const response = redirectToGateway(slug, error)
  clearPendingInvitationCookie(response)
  clearWeddingGuestSessionCookie(response)
  return response
}

export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const pending = readPendingInvitation(request)

  if (!pending || pending.weddingSlug !== slug) {
    return failedExchange(slug, 'missing')
  }

  const invitation = await resolvePersonalInvitation({
    weddingSlug: slug,
    token: pending.rsvpToken,
    requestedCard: pending.card,
  })

  if (!invitation) {
    return failedExchange(slug, 'invalid')
  }

  const query = new URLSearchParams({ invitation: '1', card: invitation.card })
  const response = relativeRedirect(
    `/w/${encodeURIComponent(slug)}?${query.toString()}`,
  )
  setWeddingGuestSessionCookie(response, {
    weddingId: invitation.weddingId,
    guestId: invitation.guestId,
    rsvpToken: invitation.rsvpToken,
  })
  clearPendingInvitationCookie(response)
  return response
}
