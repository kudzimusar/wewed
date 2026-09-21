import { NextRequest, NextResponse } from 'next/server'
import { guestPassForRequest } from '@/lib/wedding-day'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Promotion is reviewable independently of migration/key activation.
  if (process.env.WEDDING_DAY_GUEST_API_ENABLED !== 'true') {
    return NextResponse.json({ success: false, code: 'WEDDING_DAY_NOT_ENABLED' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
  }
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
          publicKeyDerBase64: credential.publicKeyDerBase64,
          algorithm: credential.algorithm,
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
    const status = message === 'ATTENDANCE_REQUIRED' || message.includes('accepted RSVP') ? 409 : 503
    return NextResponse.json({ success: false, code: status === 409 ? 'ATTENDANCE_REQUIRED' : 'PASS_UNAVAILABLE' }, { status, headers: { 'Cache-Control': 'private, no-store' } })
  }
}
