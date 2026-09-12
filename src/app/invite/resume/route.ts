import { NextRequest, NextResponse } from 'next/server'
import { consumeInvitationInstallHandoff } from '@/lib/invitation-install-handoff'
import { clearPendingInvitationCookie } from '@/lib/pending-invitation'
import {
  clearWeddingGuestSessionCookie,
  setWeddingGuestSessionCookie,
} from '@/lib/wedding-guest-session'
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
  clearPendingInvitationCookie(response)
  clearWeddingGuestSessionCookie(response)
  clearWeddingSharedInvitationCookie(response)
  return response
}

export async function GET(request: NextRequest) {
  const handoff = request.nextUrl.searchParams.get('h')?.trim() || ''
  const result = await consumeInvitationInstallHandoff({
    secret: handoff,
    ipAddress: clientIp(request),
    userAgent: request.headers.get('user-agent'),
  })

  if (!result.ok) {
    return recoveryRedirect()
  }

  const query = new URLSearchParams({
    invitation: '1',
    card: result.card,
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
  clearPendingInvitationCookie(response)
  return response
}
