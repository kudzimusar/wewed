import { NextRequest, NextResponse } from 'next/server'
import {
  requireWeddingDayOperator,
  transitionVendorPresence,
  type WeddingServicePresenceState,
} from '@/lib/wedding-day'

export const dynamic = 'force-dynamic'

const VALID_STATES: WeddingServicePresenceState[] = [
  'CONFIRMED',
  'EN_ROUTE',
  'ARRIVED_ON_SITE',
  'SERVICE_ACTIVE',
  'COMPLETED',
]

export async function POST(request: NextRequest) {
  const actor = await requireWeddingDayOperator(request, [
    'vendor',
    'planner',
    'couple',
    'admin',
  ])
  if (!actor) {
    return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as
    | { serviceEngagementId?: string; state?: WeddingServicePresenceState; notes?: string | null }
    | null
  const serviceEngagementId = body?.serviceEngagementId?.trim()
  const state = body?.state
  if (!serviceEngagementId || !state || !VALID_STATES.includes(state)) {
    return NextResponse.json(
      { success: false, error: 'serviceEngagementId and a valid presence state are required.' },
      { status: 400 },
    )
  }

  try {
    const data = await transitionVendorPresence({
      weddingId: actor.weddingId,
      serviceEngagementId,
      actor,
      state,
      notes: body?.notes,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update vendor presence.'
    const status = message.includes('FORBIDDEN') ? 403 : message.includes('NOT_FOUND') ? 404 : message.includes('TRANSITION') ? 409 : 400
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
