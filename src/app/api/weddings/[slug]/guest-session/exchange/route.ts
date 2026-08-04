import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { setWeddingGuestSessionCookie } from '@/lib/wedding-guest-session'

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
            select: { id: true, slug: true, privacy: true },
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

  const response = relativeRedirect(
    `/w/${encodeURIComponent(slug)}?invitation=1`,
  )
  setWeddingGuestSessionCookie(response, {
    weddingId: rsvp.guest.wedding.id,
    guestId: rsvp.guest.id,
    rsvpToken: rsvp.token,
  })
  response.headers.set('Vary', 'Cookie')
  return response
}
