import { NextRequest, NextResponse } from 'next/server'
import {
  assertWeddingDayWW2RuntimeReady,
  isWeddingDayWW2Enabled,
} from '@/lib/wedding-day-feature'
import {
  guestPassForRequest,
  WeddingPassUnavailableError,
  type WeddingPassAvailabilityState,
} from '@/lib/wedding-day'

export const dynamic = 'force-dynamic'

// HTTP status per shared availability state. The body always carries `code` and `availability`
// so web, iOS, Android and Planner present the same state; clients must not infer it from status.
const UNAVAILABLE_STATUS: Record<Exclude<WeddingPassAvailabilityState, 'active'>, number> = {
  rsvp_required: 403,
  declined: 403,
  not_yet_issuable: 409,
  issuance_closed: 410,
  revoked: 410,
}

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

    const { credential, context, passKey, availability } = result
    return NextResponse.json(
      {
        success: true,
        availability,
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
          publicKeyDerBase64: passKey.publicKeyDerBase64,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    if (error instanceof WeddingPassUnavailableError && error.availability.state !== 'active') {
      return NextResponse.json(
        {
          success: false,
          code: error.availability.code,
          error: error.availability.code,
          availability: error.availability,
        },
        { status: UNAVAILABLE_STATUS[error.availability.state], headers: { 'Cache-Control': 'no-store' } },
      )
    }
    const message = error instanceof Error ? error.message : String(error)
    // Attendance flipped between the session read and the locked issuance transaction.
    const isAttendance = message === 'ATTENDANCE_REQUIRED'
    return NextResponse.json(
      {
        success: false,
        code: isAttendance ? 'ATTENDANCE_REQUIRED' : 'PASS_UNAVAILABLE',
        error: isAttendance ? 'ATTENDANCE_REQUIRED' : 'PASS_UNAVAILABLE',
      },
      { status: isAttendance ? 403 : 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
