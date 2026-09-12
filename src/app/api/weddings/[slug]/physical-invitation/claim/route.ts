import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeInvitationCardStyle } from '@/lib/digital-invitation-card'
import {
  setWeddingGuestSessionCookie,
} from '@/lib/wedding-guest-session'
import {
  clearWeddingSharedInvitationCookie,
  verifyWeddingSharedInvitationSessionToken,
  WEDDING_SHARED_INVITATION_COOKIE,
} from '@/lib/wedding-shared-invitation-session'

interface Params {
  params: Promise<{ slug: string }>
}

interface ClaimPayload {
  name?: unknown
  contact?: unknown
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

function normalizedText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

function genericFailure(status = 401): NextResponse {
  return noStore(
    NextResponse.json(
      {
        success: false,
        error:
          'We could not match those details to this invitation. Check the details or ask the couple or planner for help.',
      },
      { status },
    ),
  )
}

async function delayedFailure(status = 401): Promise<NextResponse> {
  await new Promise((resolve) => setTimeout(resolve, 160))
  return genericFailure(status)
}

export async function POST(request: NextRequest, { params }: Params) {
  const origin = request.headers.get('origin')
  if (origin && origin !== request.nextUrl.origin) return genericFailure(403)

  const { slug } = await params
  const body = (await request.json().catch(() => null)) as ClaimPayload | null
  const name = normalizedText(body?.name)
  const contact = normalizedText(body?.contact)
  if (!name) return genericFailure(400)

  const sharedToken =
    request.cookies.get(WEDDING_SHARED_INVITATION_COOKIE)?.value ?? null
  const sharedSession = sharedToken
    ? verifyWeddingSharedInvitationSessionToken(sharedToken)
    : null
  if (!sharedSession) return delayedFailure()

  const wedding = await db.wedding.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      privacy: true,
      invitationCardStyle: true,
    },
  })
  if (
    !wedding ||
    wedding.privacy === 'private' ||
    sharedSession.weddingId !== wedding.id
  ) {
    return delayedFailure()
  }

  const destination = await db.qRDestination.findFirst({
    where: {
      id: sharedSession.destinationId,
      weddingId: wedding.id,
      type: 'physical_invitation',
      isActive: true,
    },
    select: { id: true },
  })
  if (!destination) return delayedFailure()

  const allowNameOnlyUatClaim =
    process.env.VERCEL_ENV === 'preview' &&
    process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID === wedding.id
  if (!contact && !allowNameOnlyUatClaim) return genericFailure(400)

  const candidates = await db.guest.findMany({
    where: {
      weddingId: wedding.id,
      name: { equals: name, mode: 'insensitive' },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      rsvp: { select: { token: true } },
    },
    take: 3,
  })

  const contactLower = contact.toLowerCase()
  const contactPhone = normalizePhone(contact)
  const matched = candidates.filter((candidate) => {
    if (!candidate.rsvp) return false
    if (!contact) return allowNameOnlyUatClaim

    const emailMatches =
      Boolean(candidate.email) && candidate.email!.trim().toLowerCase() === contactLower
    const storedPhone = candidate.phone ? normalizePhone(candidate.phone) : ''
    const phoneMatches =
      Boolean(contactPhone) && Boolean(storedPhone) && storedPhone === contactPhone
    return emailMatches || phoneMatches
  })

  if (matched.length !== 1 || !matched[0].rsvp) return delayedFailure()

  const guest = matched[0]
  const isDedicatedPreviewWedding =
    process.env.VERCEL_ENV === 'preview' &&
    process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID === wedding.id
  const selectedCard = isDedicatedPreviewWedding
    ? 'ivory-floral-gold'
    : normalizeInvitationCardStyle(wedding.invitationCardStyle)
  const query = new URLSearchParams({
    invitation: '1',
    card: selectedCard,
    source: 'printed-invitation',
  })
  const response = NextResponse.json({
    success: true,
    redirect: `/w/${encodeURIComponent(wedding.slug)}?${query.toString()}`,
    guest: { id: guest.id, name: guest.name },
  })
  setWeddingGuestSessionCookie(response, {
    weddingId: wedding.id,
    guestId: guest.id,
    rsvpToken: guest.rsvp.token,
  })
  clearWeddingSharedInvitationCookie(response)
  return noStore(response)
}
