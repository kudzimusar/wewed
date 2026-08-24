import { NextRequest, NextResponse } from 'next/server'
import { BookingCommerceError } from '@/lib/booking-commerce'
import { AUTO_BOOK_ACTIONS, executeArchitectBookingAction, type AutoBookAction } from '@/lib/booking-ai'
import { requireWeddingArchitectPlanningAccess } from '@/lib/wedding-architect-access'

export async function POST(request: NextRequest) {
  const access = await requireWeddingArchitectPlanningAccess(request)
  if (access.error) return access.error
  try {
    const body = await request.json() as Record<string, unknown>
    const action = typeof body.action === 'string' && AUTO_BOOK_ACTIONS.includes(body.action as AutoBookAction)
      ? body.action as AutoBookAction
      : null
    if (!action) return NextResponse.json({ success: false, error: 'Unsupported AutoBook action.' }, { status: 400 })
    if (action !== 'suggest' && (typeof body.itemId !== 'string' || !body.itemId.trim())) {
      return NextResponse.json({ success: false, error: 'itemId is required for an executable AutoBook action.' }, { status: 400 })
    }
    if (action === 'suggest') {
      return NextResponse.json({ success: true, data: { action: 'suggest', executed: false, message: 'Wedding Architect remains suggestion-only at this policy boundary.' } })
    }

    const data = await executeArchitectBookingAction({
      weddingId: access.context.weddingId,
      actorUserId: access.context.session.userId,
      action,
      itemId: String(body.itemId).trim(),
      variantId: typeof body.variantId === 'string' ? body.variantId : null,
      quantity: typeof body.quantity === 'number' ? body.quantity : Number(body.quantity || 1),
      selectedAddOns: Array.isArray(body.selectedAddOns) ? body.selectedAddOns.filter((entry): entry is string => typeof entry === 'string') : [],
      eventDate: body.eventDate,
      serviceStart: body.serviceStart,
      serviceEnd: body.serviceEnd,
      appointmentAt: body.appointmentAt,
      pickupAt: body.pickupAt,
      deliveryAt: body.deliveryAt,
      setupStart: body.setupStart,
      setupEnd: body.setupEnd,
      collectionAt: body.collectionAt,
      returnDueAt: body.returnDueAt,
      serviceLocation: body.serviceLocation,
      guestCount: body.guestCount,
      notes: body.notes,
      referralToken: typeof body.referralToken === 'string' ? body.referralToken : null,
      idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey.slice(0, 200) : null,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[WEDDING ARCHITECT BOOKING POST] error:', error)
    return NextResponse.json({ success: false, error: 'Wedding Architect could not execute this governed booking action.' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
