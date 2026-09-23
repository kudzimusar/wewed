import { weddingGuestSessionExpiry } from '@/lib/wedding-guest-session'
import { invitationVersionFingerprint } from '@/lib/wedding-guest-session'
import { previewWriteError } from '@/lib/preview-write-response'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeInvitationCardStyle } from '@/lib/digital-invitation-card'
import {
  applyGuestRsvpUpdate,
  GUEST_RSVP_FIELDS,
  loadWeddingChildrenPolicy,
  type GuestRsvpField,
} from '@/lib/guest-rsvp-mutation'
import {
  clearWeddingGuestSessionCookie,
  readWeddingGuestSession,
  setWeddingGuestSessionCookie,
} from '@/lib/wedding-guest-session'
import {
  mergeWeddingGuestPortfolio,
  readWeddingGuestPortfolio,
  removeWeddingGuestPortfolioEntry,
  setWeddingGuestPortfolioCookie,
} from '@/lib/wedding-guest-portfolio'
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
  if (!wedding) return { wedding: null, guest: null, session: null }
  const session = readWeddingGuestSession(request)
  const guest = await resolveGuestSessionForWedding(wedding, session)
  return { wedding, guest, session }
}

export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const { wedding, guest, session } = await currentGuest(request, slug)

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
    // A valid guest cookie for another wedding must survive a scoped 401 from
    // this wedding. Otherwise a stale/background request from Wedding A can
    // erase the newly activated Wedding B session immediately after switching.
    if (session?.weddingId === wedding.id) {
      clearWeddingGuestSessionCookie(response)
    }
    return noStore(response)
  }

  const childrenPolicy = await loadWeddingChildrenPolicy(wedding.id)

  const response = NextResponse.json({
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
        venueMapUrl: wedding.venueMapUrl,
        venueCity: wedding.venueCity,
        venueCountry: wedding.venueCountry,
        primaryColor: wedding.primaryColor,
        accentColor: wedding.accentColor,
        backgroundColor: wedding.backgroundColor,
        invitationCardStyle: normalizeInvitationCardStyle(wedding.invitationCardStyle),
        invitationCardMessage: wedding.invitationCardMessage,
        rsvpDeadline: wedding.rsvpDeadline,
        childrenPolicy,
      },
      guest: {
        id: guest.id,
        name: guest.name,
        email: guest.email,
        tableNumber: guest.tableNumber,
        tableName: guest.tableName,
      },
      rsvp: {
        attending: guest.attending,
        mealChoice: guest.mealChoice,
        plusOne: guest.plusOne,
        plusOneName: guest.plusOneName,
        plusOneMeal: guest.plusOneMeal,
        kidsAttending: childrenPolicy === 'adults_only' ? false : guest.kidsAttending,
        kidsCount: guest.kidsCount,
        dietaryNotes: guest.dietaryNotes,
        message: guest.message,
        checkedIn: guest.checkedIn,
        checkedInAt: guest.checkedInAt,
      },
    })
  // Validate against the current invitation before migrating a legacy cookie.
  if (session?.version === 1) setWeddingGuestSessionCookie(response, {
    weddingId: wedding.id, guestId: guest.id, rsvpToken: guest.rsvpToken, weddingDate: wedding.date,
  })
  return noStore(response)
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

  if (!rsvp || rsvp.guest.wedding.slug !== slug || rsvp.guest.wedding.privacy === 'private') {
    await new Promise((resolve) => setTimeout(resolve, 120))
    return noStore(
      NextResponse.json(
        { success: false, error: 'This invitation is invalid or no longer active.' },
        { status: 401 },
      ),
    )
  }

  const card = normalizeInvitationCardStyle(rsvp.guest.wedding.invitationCardStyle)
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
      invitationCardStyle: card,
    }),
  )
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

  const blocked = previewWriteError(wedding.id)
  if (blocked) return blocked

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) {
    return noStore(
      NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 }),
    )
  }

  const originGuestId =
    typeof body.originGuestId === 'string' ? body.originGuestId.trim() : ''
  if (!originGuestId) {
    return noStore(
      NextResponse.json(
        {
          success: false,
          error: 'This RSVP form is missing its guest binding. Reload the invitation and try again.',
          code: 'STALE_GUEST_CONTEXT',
        },
        { status: 409 },
      ),
    )
  }
  if (originGuestId !== guest.id) {
    return noStore(
      NextResponse.json(
        {
          success: false,
          error: 'Your invitation session changed while this RSVP form was open. Reload the current invitation before saving.',
          code: 'STALE_GUEST_CONTEXT',
        },
        { status: 409 },
      ),
    )
  }

  // Master plan Phase 9 — the actual field/policy semantics now live in the shared
  // `applyGuestRsvpUpdate` operation (`@/lib/guest-rsvp-mutation.ts`), reused by `/api/rsvp` POST
  // too, so the two guest self-service RSVP write transports cannot drift into two separate
  // implementations of these rules again. `originGuestId` stays here: it is this transport's own
  // authorization concern, not a mutation-semantics one.
  const requestedFields: Partial<Record<GuestRsvpField, unknown>> = {}
  for (const field of GUEST_RSVP_FIELDS) {
    if (field in body) requestedFields[field] = body[field]
  }
  const result = await applyGuestRsvpUpdate({
    weddingId: wedding.id,
    rsvpToken: guest.rsvpToken,
    requestedFields,
  })
  if (!result.ok) {
    return noStore(
      NextResponse.json(
        { success: false, error: result.error, code: 'CHILDREN_NOT_ALLOWED' },
        { status: 400 },
      ),
    )
  }

  const response = noStore(NextResponse.json({ success: true, rsvp: result.rsvp }))
  if (readWeddingGuestSession(request)?.version === 1) setWeddingGuestSessionCookie(response, {
    weddingId: wedding.id, guestId: guest.id, rsvpToken: guest.rsvpToken, weddingDate: wedding.date,
  })
  return response
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const { wedding, guest } = await currentGuest(request, slug)
  if (!wedding || !guest) {
    return noStore(
      NextResponse.json({ success: false, error: 'Guest access is not active.' }, { status: 401 }),
    )
  }

  const blocked = previewWriteError(wedding.id)
  if (blocked) return blocked

  const updated = await db.rSVP.update({
    where: { token: guest.rsvpToken },
    data: { checkedIn: true, checkedInAt: guest.checkedInAt ?? new Date() },
    select: { checkedIn: true, checkedInAt: true },
  })

  const response = noStore(NextResponse.json({ success: true, rsvp: updated }))
  if (readWeddingGuestSession(request)?.version === 1) setWeddingGuestSessionCookie(response, {
    weddingId: wedding.id, guestId: guest.id, rsvpToken: guest.rsvpToken, weddingDate: wedding.date,
  })
  return response
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const wedding = await loadWeddingAccessRecord(slug)
  const nextPortfolio = wedding
    ? removeWeddingGuestPortfolioEntry(
        readWeddingGuestPortfolio(request),
        wedding.id,
      )
    : null
  const response = NextResponse.json({
    success: true,
    next: nextPortfolio?.activeWeddingId ? '/app' : '/',
  })

  clearWeddingGuestSessionCookie(response)
  if (nextPortfolio) setWeddingGuestPortfolioCookie(response, nextPortfolio)

  return noStore(response)
}