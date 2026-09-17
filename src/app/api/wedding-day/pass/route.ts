import { NextRequest, NextResponse } from 'next/server'
import { guestPassForRequest } from '@/lib/wedding-day'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const credential = await guestPassForRequest(request)
    if (!credential) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized guest session.' },
        { status: 401 },
      )
    }
    return NextResponse.json(
      {
        success: true,
        data: {
          id: credential.id,
          weddingId: credential.weddingId,
          guestId: credential.guestId,
          passSerial: credential.passSerial,
          tokenVersion: credential.tokenVersion,
          eventBitmask: credential.eventBitmask,
          token: credential.token,
          issuedAt: credential.issuedAt,
          expiresAt: credential.expiresAt,
          revokedAt: credential.revokedAt,
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to issue Wedding Pass.'
    const status = message.includes('accepted RSVP') ? 409 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
