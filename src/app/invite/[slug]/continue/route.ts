import { weddingGuestSessionExpiry } from '@/lib/wedding-guest-session'
import { invitationVersionFingerprint } from '@/lib/wedding-guest-session'
import { NextRequest, NextResponse } from 'next/server'
import { resolvePersonalInvitation } from '@/lib/personal-invitation-access'
import {
  clearPendingInvitationCookie,
  readPendingInvitation,
} from '@/lib/pending-invitation'
import {
  setWeddingGuestSessionCookie,
} from '@/lib/wedding-guest-session'
import {
  mergeWeddingGuestPortfolio,
  readWeddingGuestPortfolio,
  setWeddingGuestPortfolioCookie,
} from '@/lib/wedding-guest-portfolio'
import { clearWeddingSharedInvitationCookie } from '@/lib/wedding-shared-invitation-session'

interface Params {
  params: Promise<{ slug: string }>
}

function relativeRedirect(location: string): NextResponse {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: location,
      'Cache-Control': 'private, no-store, max-age=0',
      Vary: 'Cookie',
    },
  })
}

function redirectToGateway(slug: string, error: string) {
  const query = new URLSearchParams({ accessError: error })
  return relativeRedirect(`/w/${encodeURIComponent(slug)}?${query.toString()}`)
}

function failedExchange(slug: string, error: string): NextResponse {
  const response = redirectToGateway(slug, error)
  // Keep the previously active guest intact: a failed attempt to switch
  // invitations must not strand the user in a stale, unauthorized UI. Anonymous
  // shared physical context still fails closed.
  clearPendingInvitationCookie(response)
  clearWeddingSharedInvitationCookie(response)
  return response
}

export async function GET(request: NextRequest, { params }: Params) {
  const { slug } = await params
  const pending = readPendingInvitation(request)

  if (!pending || pending.weddingSlug !== slug) {
    return failedExchange(slug, 'missing')
  }

  const invitation = await resolvePersonalInvitation({
    weddingSlug: slug,
    token: pending.rsvpToken,
    requestedCard: pending.card,
  })

  if (!invitation) {
    return failedExchange(slug, 'invalid')
  }

  const query = new URLSearchParams({ invitation: '1', card: invitation.card })
  const response = relativeRedirect(
    `/w/${encodeURIComponent(slug)}?${query.toString()}`,
  )
  clearWeddingSharedInvitationCookie(response)
  setWeddingGuestSessionCookie(response, {
    weddingId: invitation.weddingId,
    guestId: invitation.guestId,
    rsvpToken: invitation.rsvpToken,
    weddingDate: invitation.weddingDate,
  })
  setWeddingGuestPortfolioCookie(
    response,
    mergeWeddingGuestPortfolio(readWeddingGuestPortfolio(request), {
      accessExpiresAt: weddingGuestSessionExpiry(invitation.weddingDate),
      invitationVersionFingerprint: invitationVersionFingerprint(invitation),
      weddingId: invitation.weddingId,
      weddingSlug: slug,
      guestId: invitation.guestId,
      invitationCardStyle: invitation.card,
    }),
  )
  clearPendingInvitationCookie(response)
  return response
}
