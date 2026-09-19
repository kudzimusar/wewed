import { NextRequest, NextResponse } from 'next/server'
import {
  clearAndroidInvitationAppCookie,
  setAndroidInvitationAppCookie,
} from '@/lib/android-invitation-app-session'
import { clearPendingInvitationCookie } from '@/lib/pending-invitation'
import { consumePhysicalInvitationInstallHandoff } from '@/lib/physical-invitation-install-handoff'
import { clearWeddingGuestSessionCookie } from '@/lib/wedding-guest-session'
import {
  clearWeddingSharedInvitationCookie,
  setWeddingSharedInvitationCookie,
} from '@/lib/wedding-shared-invitation-session'

export const dynamic = 'force-dynamic'

function redirectNoStore(location: string) {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: location,
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

function recovery() {
  const response = redirectNoStore('/guest-access-help?reason=invitation-resume')
  clearPendingInvitationCookie(response)
  clearWeddingGuestSessionCookie(response)
  clearWeddingSharedInvitationCookie(response)
  clearAndroidInvitationAppCookie(response)
  return response
}

export async function GET(request: NextRequest) {
  const handoff = request.nextUrl.searchParams.get('h')?.trim() || ''
  const result = await consumePhysicalInvitationInstallHandoff(handoff)
  if (!result.ok) return recovery()

  const query = new URLSearchParams({
    source: 'printed-invitation',
    card: result.card,
  })
  const response = redirectNoStore(
    `/w/${encodeURIComponent(result.weddingSlug)}?${query.toString()}`,
  )
  clearPendingInvitationCookie(response)
  clearWeddingGuestSessionCookie(response)
  setWeddingSharedInvitationCookie(response, {
    weddingId: result.weddingId,
    destinationId: result.destinationId,
  })
  setAndroidInvitationAppCookie(response, {
    weddingId: result.weddingId,
    destinationId: result.destinationId,
  })
  return response
}
