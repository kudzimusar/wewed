import { NextRequest, NextResponse } from 'next/server'
import { resolvePersonalInvitation } from '@/lib/personal-invitation-access'
import {
  readPendingInvitation,
  setPendingInvitationCookie,
} from '@/lib/pending-invitation'

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

export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const token = request.nextUrl.searchParams.get('rsvp')?.trim() || ''
  const requestedCard = request.nextUrl.searchParams.get('card')

  if (!token) {
    const pending = readPendingInvitation(request)
    if (pending?.weddingSlug === slug) {
      return relativeRedirect(`/invite/${encodeURIComponent(slug)}/open`)
    }
    return redirectToGateway(slug, 'missing')
  }

  const invitation = await resolvePersonalInvitation({
    weddingSlug: slug,
    token,
    requestedCard,
  })

  if (!invitation) {
    await new Promise((resolve) => setTimeout(resolve, 120))
    return redirectToGateway(slug, 'invalid')
  }

  const response = relativeRedirect(
    `/invite/${encodeURIComponent(slug)}/open`,
  )
  setPendingInvitationCookie(response, {
    weddingSlug: invitation.weddingSlug,
    rsvpToken: invitation.rsvpToken,
    card: invitation.card,
  })
  return response
}
