import { NextRequest, NextResponse } from 'next/server'
import {
  assertWeddingDayWW2RuntimeReady,
  isWeddingDayWW2Enabled,
} from '@/lib/wedding-day-feature'
import { guestPassForRequest } from '@/lib/wedding-day'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!isWeddingDayWW2Enabled()) {
    return NextResponse.json(
      { success: false, code: 'WEDDING_DAY_DISABLED', error: 'Wedding Day is currently disabled.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  try {
    assertWeddingDayWW2RuntimeReady()
  } catch {
    return NextResponse.json(
      {
        success: false,
        code: 'WEDDING_DAY_KEY_CONFIGURATION_INVALID',
        error: 'Wedding Day signing configuration is unavailable.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  try {
    const result = await guestPassForRequest(request)
    if (!result) {
      return NextResponse.json(
        { success: false, code: 'SESSION_INVALID', error: 'Unauthorized or invalid guest session.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const { credential, context } = result
    return NextResponse.json(
      {
        success: true,
        data: {
          id: credential.id,
          weddingId: credential.weddingId,
          weddingSlug: context.weddingSlug,
          weddingTitle: context.weddingTitle,
          guestId: credential.guestId,
          guestName: context.guestName,
          passSerial: credential.passSerial,
          tokenVersion: credential.tokenVersion,
          eventBitmask: credential.eventBitmask,
          token: credential.token,
          issuedAt: credential.issuedAt,
          expiresAt: credential.expiresAt,
          revokedAt: credential.revokedAt,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const isAttendance = message.includes('accepted RSVP') || message.includes('ATTENDANCE_REQUIRED')
    const isClosed = message === 'PASS_ISSUANCE_CLOSED'
    const status = isAttendance ? 403 : isClosed ? 410 : 500
    const code = isAttendance ? 'ATTENDANCE_REQUIRED' : isClosed ? 'PASS_ISSUANCE_CLOSED' : 'PASS_UNAVAILABLE'
    return NextResponse.json(
      { success: false, code, error: message },
      { status, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
