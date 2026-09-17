import { NextRequest, NextResponse } from 'next/server'
import {
  checkInWeddingGuest,
  requireWeddingDayOperator,
} from '@/lib/wedding-day'

export const dynamic = 'force-dynamic'

interface CheckInBody {
  token?: string
  guestId?: string
  attendeeKeys?: string[]
  source?: 'qr' | 'manual' | 'offline-sync'
  gateId?: string | null
  deviceId?: string | null
  clientEventId?: string | null
  eventKey?: string
}

export async function POST(request: NextRequest) {
  const actor = await requireWeddingDayOperator(request, [
    'usher',
    'planner',
    'couple',
    'admin',
  ])
  if (!actor) {
    return NextResponse.json(
      { success: false, error: 'Forbidden — Wedding Day check-in authority required.' },
      { status: 403 },
    )
  }

  let body: CheckInBody
  try {
    body = (await request.json()) as CheckInBody
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const source = body.source ?? (body.token ? 'qr' : 'manual')
  if (!['qr', 'manual', 'offline-sync'].includes(source)) {
    return NextResponse.json({ success: false, error: 'Invalid check-in source.' }, { status: 400 })
  }
  if (source === 'qr' && !body.token) {
    return NextResponse.json({ success: false, error: 'QR check-in requires a Wedding Pass token.' }, { status: 400 })
  }
  if (source === 'manual' && !body.guestId) {
    return NextResponse.json({ success: false, error: 'Manual check-in requires a guestId.' }, { status: 400 })
  }

  try {
    const result = await checkInWeddingGuest({
      weddingId: actor.weddingId,
      guestId: body.guestId,
      token: body.token,
      attendeeKeys: body.attendeeKeys,
      actorUserId: actor.userId,
      source,
      gateId: body.gateId,
      deviceId: body.deviceId,
      clientEventId: body.clientEventId,
      eventKey: body.eventKey,
    })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Check-in failed.'
    const status =
      message === 'GUEST_NOT_ELIGIBLE' || message === 'INVALID_HOUSEHOLD_MEMBER'
        ? 409
        : message.includes('PASS') || message === 'GUEST_REQUIRED'
          ? 400
          : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
