import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { normalizeInvitationCardStyle } from '@/lib/digital-invitation-card'
import {
  guestBrowserHandoffDestinationPath,
  verifyGuestBrowserHandoffToken,
} from '@/lib/guest-browser-handoff'
import {
  invitationVersionFingerprint,
  setWeddingGuestSessionCookie,
  weddingGuestSessionExpiry,
} from '@/lib/wedding-guest-session'
import {
  mergeWeddingGuestPortfolio,
  readWeddingGuestPortfolio,
  setWeddingGuestPortfolioCookie,
} from '@/lib/wedding-guest-portfolio'
import { loadWeddingAccessRecord } from '@/lib/wedding-public-access'

interface Params {
  params: Promise<{ slug: string }>
}

function redirect(location: string): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: location,
      'Cache-Control': 'no-store, max-age=0',
      // The exchange URL must not travel onward as a Referer.
      'Referrer-Policy': 'no-referrer',
      Vary: 'Cookie',
    },
  })
}

function refuse(slug: string): NextResponse {
  return redirect(`/w/${encodeURIComponent(slug)}?${new URLSearchParams({ accessError: 'handoff' })}`)
}

/**
 * QRO06 — redeem a native → browser Guest handoff.
 *
 * Re-validates wedding + Guest + the CURRENT invitation before issuing the normal browser Guest
 * session, then redirects to a server-derived allowlisted path. Every failure lands on the
 * wedding's access gateway without saying which check failed. Read-only.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const verified = verifyGuestBrowserHandoffToken(request.nextUrl.searchParams.get('h') ?? '')
  if (!verified.ok) return refuse(slug)
  const { claims } = verified

  const wedding = await loadWeddingAccessRecord(slug)
  if (!wedding || wedding.id !== claims.weddingId || wedding.privacy === 'private') return refuse(slug)

  const rsvp = await db.rSVP.findUnique({
    where: { guestId: claims.guestId },
    select: { token: true, guest: { select: { id: true, weddingId: true } } },
  })
  if (
    !rsvp ||
    rsvp.guest.id !== claims.guestId ||
    rsvp.guest.weddingId !== wedding.id ||
    invitationVersionFingerprint({ weddingId: wedding.id, guestId: rsvp.guest.id, rsvpToken: rsvp.token }) !==
      claims.invitationVersion
  ) {
    return refuse(slug)
  }

  const response = redirect(guestBrowserHandoffDestinationPath(wedding.slug, claims.destination))
  setWeddingGuestSessionCookie(response, {
    weddingId: wedding.id,
    guestId: rsvp.guest.id,
    rsvpToken: rsvp.token,
    weddingDate: wedding.date,
  })
  setWeddingGuestPortfolioCookie(
    response,
    mergeWeddingGuestPortfolio(readWeddingGuestPortfolio(request), {
      accessExpiresAt: weddingGuestSessionExpiry(wedding.date),
      invitationVersionFingerprint: claims.invitationVersion,
      weddingId: wedding.id,
      weddingSlug: wedding.slug,
      guestId: rsvp.guest.id,
      invitationCardStyle: normalizeInvitationCardStyle(wedding.invitationCardStyle),
    }),
  )
  return response
}
