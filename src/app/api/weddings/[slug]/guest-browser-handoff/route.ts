import { NextRequest, NextResponse } from 'next/server'
import {
  createGuestBrowserHandoffToken,
  isGuestBrowserHandoffDestination,
} from '@/lib/guest-browser-handoff'
import { invitationVersionFingerprint, readWeddingGuestSession } from '@/lib/wedding-guest-session'
import { loadWeddingAccessRecord, resolveGuestSessionForWedding } from '@/lib/wedding-public-access'

interface Params {
  params: Promise<{ slug: string }>
}

function noStore(body: Record<string, unknown>, status: number): NextResponse {
  const response = NextResponse.json(body, { status })
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

/**
 * QRO06 — issue a native → browser Guest handoff (see `guest-browser-handoff.ts`).
 *
 * Only an already valid Guest session for THIS wedding may ask, and only for an allowlisted
 * destination key. The Guest is the one the server resolves from that session; the body carries
 * nothing but the destination key. Read-only: no RSVP, guest or wedding write.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { slug } = await params
  // Native clients identify themselves; a cross-site browser form cannot set this header.
  if (request.headers.get('x-wewed-client') !== 'native') {
    return noStore({ success: false, error: 'Unsupported client.' }, 400)
  }
  const body = (await request.json().catch(() => null)) as { destination?: unknown } | null
  if (!isGuestBrowserHandoffDestination(body?.destination)) {
    return noStore({ success: false, error: 'Unsupported destination.' }, 400)
  }

  const wedding = await loadWeddingAccessRecord(slug)
  if (!wedding) return noStore({ success: false, error: 'Wedding not found.' }, 404)
  if (wedding.privacy === 'private') {
    return noStore({ success: false, error: 'Guest access is not active.' }, 403)
  }

  const guest = await resolveGuestSessionForWedding(wedding, readWeddingGuestSession(request))
  if (!guest) return noStore({ success: false, authorized: false, error: 'Guest access is not active.' }, 401)

  const { token, expiresAt } = createGuestBrowserHandoffToken({
    weddingId: wedding.id,
    guestId: guest.id,
    invitationVersion: invitationVersionFingerprint({ weddingId: wedding.id, guestId: guest.id, rsvpToken: guest.rsvpToken }),
    destination: body.destination,
  })
  const url = new URL(`/api/weddings/${encodeURIComponent(wedding.slug)}/guest-browser-handoff/redeem`, request.nextUrl.origin)
  url.searchParams.set('h', token)
  return noStore({ success: true, url: url.toString(), expiresAt: new Date(expiresAt).toISOString() }, 200)
}
