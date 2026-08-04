import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeInvitationCardStyle } from '@/lib/digital-invitation-card'
import {
  clearWeddingGuestSessionCookie,
  readWeddingGuestSession,
  setWeddingGuestSessionCookie,
} from '@/lib/wedding-guest-session'
import {
  loadWeddingAccessRecord,
  resolveGuestSessionForWedding,
} from '@/lib/wedding-public-access'

interface Params {
  params: Promise<{ slug: string }>
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

async function currentGuest(request: NextRequest, slug: string) {
  const wedding = await loadWeddingAccessRecord(slug)
  if (!wedding) return { wedding: null, guest: null }
  const guest = await resolveGuestSessionForWedding(
    wedding,
    readWeddingGuestSession(request),
  )
  return { wedding, guest }
}

export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const { wedding, guest } = await currentGuest(request, slug)

  if (!wedding) {
    return noStore(
      NextResponse.json({ success: false, error: 'Wedding not found.' }, { status: 404 }),
    )
  }
  if (!guest) {
    const response = NextResponse.json(
      { success: false, authorized: false, error: 'Guest access is not active.' },
      { status: 401 },
    )
    clearWeddingGuestSessionCookie(response)
    return noStore(response)
  }

  return noStore(
    NextResponse.json({
      success: true,
      authorized: true,
      wedding: {
        slug: wedding.slug,
        privacy: wedding.privacy,
        title: wedding.title,
        monogram: wedding.monogram,
        tagline: wedding.tagline,
        date: wedding.date,
        venue: wedding.venue,
        venueCity: wedding.venueCity,
        venueCountry: wedding.venueCountry,
        primaryColor: wedding.primaryColor,
        accentColor: wedding.accentColor,
        backgroundColor: wedding.backgroundColor,
        invitationCardStyle: normalizeInvitationCardStyle(wedding.invitationCardStyle),
        invitationCardMessage: wedding.invitationCardMessage,
        rsvpDeadline: wedding.rsvpDeadline,
      },
      guest: {
        id: guest.id,
        name: guest.name,
        email: guest.email,
        tableNumber: guest.tableNumber,
      },
      rsvp: {
        attending: guest.attending,
        mealChoice: guest.mealChoice,
        plusOne: guest.plusOne,
        plusOneName: guest.plusOneName,
        plusOneMeal: guest.plusOneMeal,
        kidsAttending: guest.kidsAttending,
        kidsCount: guest.kidsCount,
        dietaryNotes: guest.dietaryNotes,
        message: guest.message,
        checkedIn: guest.checkedIn,
        checkedInAt: guest.checkedInAt,
      },
    }),
  )
}

export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null
  const token = typeof body?.token === 'string' ? body.token.trim() : ''

  if (!token) {
    return noStore(
      NextResponse.json({ success: false, error: 'Invitation token is required.' }, { status: 400 }),
    )
  }

  const rsvp = await db.rSVP.findUnique({
    where: { token },
    include: {
      guest: {
        include: { wedding: { select: { id: true, slug: true, privacy: true } } },
      },
    },
  })

  if (!rsvp || rsvp.guest.wedding.slug !== slug || rsvp.guest.wedding.privacy === 'private') {
    await new Promise((resolve) => setTimeout(resolve, 120))
    return noStore(
      NextResponse.json(
        { success: false, error: 'This invitation is invalid or no longer active.' },
        { status: 401 },
      ),
    )
  }

  const response = NextResponse.json({
    success: true,
    authorized: true,
    wedding: { slug: rsvp.guest.wedding.slug },
    guest: { id: rsvp.guest.id, name: rsvp.guest.name },
  })
  setWeddingGuestSessionCookie(response, {
    weddingId: rsvp.guest.wedding.id,
    guestId: rsvp.guest.id,
    rsvpToken: rsvp.token,
  })
  return noStore(response)
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const { wedding, guest } = await currentGuest(request, slug)
  if (!wedding || !guest) {
    return noStore(
      NextResponse.json({ success: false, error: 'Guest access is not active.' }, { status: 401 }),
    )
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) {
    return noStore(
      NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 }),
    )
  }

  const data: Record<string, unknown> = {}
  for (const field of ['attending', 'mealChoice', 'plusOne', 'plusOneName', 'plusOneMeal', 'kidsAttending', 'kidsCount', 'dietaryNotes', 'message'] as const) {
    if (body[field] !== undefined) data[field] = body[field]
  }

  const updated = await db.rSVP.update({
    where: { token: guest.rsvpToken },
    data,
    select: {
      attending: true,
      mealChoice: true,
      plusOne: true,
      plusOneName: true,
      plusOneMeal: true,
      kidsAttending: true,
      kidsCount: true,
      dietaryNotes: true,
      message: true,
      checkedIn: true,
      checkedInAt: true,
    },
  })

  return noStore(NextResponse.json({ success: true, rsvp: updated }))
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const { wedding, guest } = await currentGuest(request, slug)
  if (!wedding || !guest) {
    return noStore(
      NextResponse.json({ success: false, error: 'Guest access is not active.' }, { status: 401 }),
    )
  }

  const updated = await db.rSVP.update({
    where: { token: guest.rsvpToken },
    data: { checkedIn: true, checkedInAt: guest.checkedInAt ?? new Date() },
    select: { checkedIn: true, checkedInAt: true },
  })

  return noStore(NextResponse.json({ success: true, rsvp: updated }))
}

export async function DELETE(_request: NextRequest) {
  const response = NextResponse.json({ success: true })
  clearWeddingGuestSessionCookie(response)
  return noStore(response)
}
