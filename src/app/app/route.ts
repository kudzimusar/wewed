import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { db } from '@/lib/db'
import { normalizeInvitationCardStyle } from '@/lib/digital-invitation-card'
import {
  GOOGLE_PLAY_DISTRIBUTION_COOKIE,
  GOOGLE_PLAY_DISTRIBUTION_VALUE,
} from '@/lib/google-play-distribution'
import { buildInvitationContinuePath } from '@/lib/invitation-links'
import { readPendingInvitation } from '@/lib/pending-invitation'
import {
  readWeddingGuestSession,
  setWeddingGuestSessionCookie,
} from '@/lib/wedding-guest-session'
import {
  mergeWeddingGuestPortfolio,
  readWeddingGuestPortfolio,
  setWeddingGuestPortfolioCookie,
} from '@/lib/wedding-guest-portfolio'

const WORKSPACE_BY_ROLE = {
  admin: '/admin',
  couple: '/couple',
  planner: '/planner',
  vendor: '/vendor',
} as const

function invitationDestination(slug: string, card: string): string {
  const query = new URLSearchParams({
    invitation: '1',
    card: normalizeInvitationCardStyle(card),
  })
  return `/w/${encodeURIComponent(slug)}?${query.toString()}`
}

async function resolvePortfolioEntry(input: { weddingId: string; guestId: string }) {
  return db.guest.findFirst({
    where: { id: input.guestId, weddingId: input.weddingId },
    select: {
      id: true,
      rsvp: { select: { token: true } },
      wedding: {
        select: {
          id: true,
          slug: true,
          invitationCardStyle: true,
        },
      },
    },
  })
}

async function resolveLegacyGuestSession(request: NextRequest) {
  const guestSession = readWeddingGuestSession(request)
  if (!guestSession) return null

  const rsvp = await db.rSVP.findUnique({
    where: { token: guestSession.rsvpToken },
    include: {
      guest: {
        include: {
          wedding: {
            select: {
              id: true,
              slug: true,
              invitationCardStyle: true,
            },
          },
        },
      },
    },
  })

  if (
    !rsvp ||
    rsvp.guest.id !== guestSession.guestId ||
    rsvp.guest.wedding.id !== guestSession.weddingId
  ) {
    return null
  }

  return {
    weddingId: rsvp.guest.wedding.id,
    weddingSlug: rsvp.guest.wedding.slug,
    guestId: rsvp.guest.id,
    invitationCardStyle: normalizeInvitationCardStyle(
      rsvp.guest.wedding.invitationCardStyle,
    ),
    rsvpToken: rsvp.token,
  }
}

export async function GET(request: NextRequest) {
  const pendingInvitation = readPendingInvitation(request)
  const session = readAppSession(request)
  let destination: string
  let guestRestore:
    | {
        weddingId: string
        weddingSlug: string
        guestId: string
        invitationCardStyle: ReturnType<typeof normalizeInvitationCardStyle>
        rsvpToken: string
      }
    | null = null

  if (pendingInvitation) {
    destination = buildInvitationContinuePath({
      weddingSlug: pendingInvitation.weddingSlug,
      source: 'app-launch',
    })
  } else if (session) {
    // Authenticated product roles keep their management workspace as the cold-launch
    // authority. A guest portfolio must never hijack Admin/Planner/Couple/Vendor work.
    destination = WORKSPACE_BY_ROLE[session.role]
  } else {
    const portfolio = readWeddingGuestPortfolio(request)
    const activeEntry = portfolio
      ? portfolio.entries.find((entry) => entry.weddingId === portfolio.activeWeddingId) ??
        portfolio.entries[0]
      : null

    if (activeEntry) {
      const record = await resolvePortfolioEntry(activeEntry)
      if (record?.rsvp && record.wedding.id === activeEntry.weddingId) {
        guestRestore = {
          weddingId: record.wedding.id,
          weddingSlug: record.wedding.slug,
          guestId: record.id,
          invitationCardStyle: normalizeInvitationCardStyle(
            activeEntry.invitationCardStyle || record.wedding.invitationCardStyle,
          ),
          rsvpToken: record.rsvp.token,
        }
      }
    }

    // Promote the pre-portfolio guest cookie on first launch after this release so an
    // already invited guest does not lose the promised cold-launch-to-card behavior.
    guestRestore ??= await resolveLegacyGuestSession(request)

    destination = guestRestore
      ? invitationDestination(
          guestRestore.weddingSlug,
          guestRestore.invitationCardStyle,
        )
      : '/sign-in?from=app'
  }

  const response = NextResponse.redirect(new URL(destination, request.url))

  if (guestRestore) {
    setWeddingGuestSessionCookie(response, {
      weddingId: guestRestore.weddingId,
      guestId: guestRestore.guestId,
      rsvpToken: guestRestore.rsvpToken,
    })
    setWeddingGuestPortfolioCookie(
      response,
      mergeWeddingGuestPortfolio(readWeddingGuestPortfolio(request), {
        weddingId: guestRestore.weddingId,
        weddingSlug: guestRestore.weddingSlug,
        guestId: guestRestore.guestId,
        invitationCardStyle: guestRestore.invitationCardStyle,
      }),
    )
  }

  if (request.nextUrl.searchParams.get('source') === GOOGLE_PLAY_DISTRIBUTION_VALUE) {
    response.cookies.set(GOOGLE_PLAY_DISTRIBUTION_COOKIE, GOOGLE_PLAY_DISTRIBUTION_VALUE, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 365 * 24 * 60 * 60,
    })
  }

  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}
