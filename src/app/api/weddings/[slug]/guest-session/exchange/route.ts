import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { setWeddingGuestSessionCookie } from '@/lib/wedding-guest-session'

interface Params {
  params: Promise<{ slug: string }>
}

function redirectToGateway(request: NextRequest, slug: string, error: string) {
  const target = new URL(`/w/${encodeURIComponent(slug)}`, request.url)
  target.searchParams.set('accessError', error)
  const response = NextResponse.redirect(target, 303)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}

export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const token = request.nextUrl.searchParams.get('token')?.trim() || ''

  if (!token) {
    return redirectToGateway(request, slug, 'missing')
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
    return redirectToGateway(request, slug, 'invalid')
  }

  const target = new URL(`/w/${encodeURIComponent(slug)}`, request.url)
  target.searchParams.set('invitation', '1')
  const response = NextResponse.redirect(target, 303)
  setWeddingGuestSessionCookie(response, {
    weddingId: rsvp.guest.wedding.id,
    guestId: rsvp.guest.id,
    rsvpToken: rsvp.token,
  })
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}
