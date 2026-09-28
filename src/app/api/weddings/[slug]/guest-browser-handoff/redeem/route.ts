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

function landing(path: string, status: number): NextResponse {
  const response = NextResponse.json({ success: status === 200, path }, { status })
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

function refuse(slug: string): NextResponse {
  return landing(`/w/${encodeURIComponent(slug)}?${new URLSearchParams({ accessError: 'handoff' })}`, 401)
}

/**
 * QRO06 — redeem a native → browser Guest handoff.
 *
 * Called by the `/guest-handoff/{slug}` entry page with the exchange it read from its own URL
 * fragment (POST body — never a URL, so never a log line). Re-validates wedding + Guest + the
 * CURRENT invitation before issuing the normal browser Guest session, and answers with a
 * server-derived allowlisted landing path. Every failure answers with the wedding's access gateway
 * without saying which check failed. Read-only.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const body = (await request.json().catch(() => null)) as { h?: unknown } | null
  const verified = verifyGuestBrowserHandoffToken(typeof body?.h === 'string' ? body.h : '')
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

  const response = landing(guestBrowserHandoffDestinationPath(wedding.slug, claims.destination), 200)
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
