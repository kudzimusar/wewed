import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { consumeInvitationInstallHandoff } from '@/lib/invitation-install-handoff'
import { clearPendingInvitationCookie } from '@/lib/pending-invitation'
import { setWeddingGuestSessionCookie } from '@/lib/wedding-guest-session'
import {
  mergeWeddingGuestPortfolio,
  readWeddingGuestPortfolio,
  setWeddingGuestPortfolioCookie,
} from '@/lib/wedding-guest-portfolio'
import { clearWeddingSharedInvitationCookie } from '@/lib/wedding-shared-invitation-session'

export const dynamic = 'force-dynamic'

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first || request.headers.get('x-real-ip')?.trim() || null
}

function hardenedRedirect(location: string, status = 303): NextResponse {
  return new NextResponse(null, {
    status,
    headers: {
      Location: location,
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

function recoveryRedirect(): NextResponse {
  const response = hardenedRedirect('/guest-access-help?reason=invitation-resume')
  // Do not erase an already-valid guest session when a new handoff is invalid,
  // expired, duplicated, or otherwise fails. The replacement is atomic: only a
  // successfully redeemed handoff is allowed to overwrite the active guest.
  clearPendingInvitationCookie(response)
  console.info('[wewed][invitation-handoff]', {
    checkpoint: 'active_guest_set',
    handoffId: result.handoffId,
  })
  return response
}

export async function GET(request: NextRequest) {
  const handoff = request.nextUrl.searchParams.get('h')?.trim() || ''
  console.info('[wewed][invitation-handoff]', { checkpoint: 'resume_requested' })
  const result = await consumeInvitationInstallHandoff({
    secret: handoff,
    ipAddress: clientIp(request),
    userAgent: request.headers.get('user-agent'),
  })

  if (!result.ok) {
    console.info('[wewed][invitation-handoff]', {
      checkpoint: 'resume_rejected',
      reason: result.reason,
    })
    return recoveryRedirect()
  }

  console.info('[wewed][invitation-handoff]', {
    checkpoint: 'handoff_redeemed',
    handoffId: result.handoffId,
  })

  // Every successful Android handoff gets a fresh, non-sensitive navigation nonce.
  // Guest A and Guest B can legitimately resolve to the same wedding URL. Without a
  // changing URL, Chrome/TWA may simply foreground the already-mounted invitation and
  // preserve Guest A's open RSVP/client state after Guest B has become authoritative.
  // This opaque nonce forces a real navigation/re-render while carrying no guest ID,
  // RSVP token, or handoff credential.
  const query = new URLSearchParams({
    invitation: '1',
    card: result.card,
    source: 'android-app',
    entry: randomUUID(),
  })
  const response = hardenedRedirect(
    `/w/${encodeURIComponent(result.weddingSlug)}?${query.toString()}`,
  )

  clearWeddingSharedInvitationCookie(response)
  setWeddingGuestSessionCookie(response, {
    weddingId: result.weddingId,
    guestId: result.guestId,
    rsvpToken: result.rsvpToken,
  })
  setWeddingGuestPortfolioCookie(
    response,
    mergeWeddingGuestPortfolio(readWeddingGuestPortfolio(request), {
      weddingId: result.weddingId,
      weddingSlug: result.weddingSlug,
      guestId: result.guestId,
      invitationCardStyle: result.card,
    }),
  )
  clearPendingInvitationCookie(response)
  return response
}
