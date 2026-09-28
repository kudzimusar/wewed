import { weddingGuestSessionExpiry } from '@/lib/wedding-guest-session'
import { invitationVersionFingerprint } from '@/lib/wedding-guest-session'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeInvitationCardStyle } from '@/lib/digital-invitation-card'
import { setWeddingGuestSessionCookie } from '@/lib/wedding-guest-session'
import {
  mergeWeddingGuestPortfolio,
  readWeddingGuestPortfolio,
  setWeddingGuestPortfolioCookie,
} from '@/lib/wedding-guest-portfolio'

interface Params {
  params: Promise<{ slug: string }>
}

function relativeRedirect(location: string): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: location,
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}

function redirectToGateway(slug: string, error: string) {
  const query = new URLSearchParams({ accessError: error })
  return relativeRedirect(`/w/${encodeURIComponent(slug)}?${query.toString()}`)
}

export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const token = request.nextUrl.searchParams.get('token')?.trim() || ''

  if (!token) {
    return redirectToGateway(slug, 'missing')
  }

  const rsvp = await db.rSVP.findUnique({
    where: { token },
    include: {
      guest: {
        include: {
          wedding: {
            select: {
              id: true,
              date: true,
              slug: true,
              privacy: true,
              invitationCardStyle: true,
            },
          },
        },
      },
    },
  })

  if (
    !rsvp ||
    rsvp.guest.wedding.slug !== slug ||
    rsvp.guest.wedding.privacy === 'private'
  ) {
    await new Promise((resolve) => setTimeout(resolve, 120))
    return redirectToGateway(slug, 'invalid')
  }

  // The wedding's saved style is authoritative. Guest-facing URLs are access
  // credentials, not design selectors, and may be long-lived or forwarded.
  const invitationStyle = normalizeInvitationCardStyle(
    rsvp.guest.wedding.invitationCardStyle,
  )
  const query = new URLSearchParams({ invitation: '1', card: invitationStyle })
  const response = relativeRedirect(
    `/w/${encodeURIComponent(slug)}?${query.toString()}`,
  )
  setWeddingGuestSessionCookie(response, {
    weddingId: rsvp.guest.wedding.id,
    guestId: rsvp.guest.id,
    rsvpToken: rsvp.token,
    weddingDate: rsvp.guest.wedding.date,
  })
  setWeddingGuestPortfolioCookie(
    response,
    mergeWeddingGuestPortfolio(readWeddingGuestPortfolio(request), {
      accessExpiresAt: weddingGuestSessionExpiry(rsvp.guest.wedding.date),
      invitationVersionFingerprint: invitationVersionFingerprint({ weddingId: rsvp.guest.wedding.id, guestId: rsvp.guest.id, rsvpToken: rsvp.token }),
      weddingId: rsvp.guest.wedding.id,
      weddingSlug: rsvp.guest.wedding.slug,
      guestId: rsvp.guest.id,
      invitationCardStyle: invitationStyle,
    }),
  )
  response.headers.set('Vary', 'Cookie')
  return response
}
