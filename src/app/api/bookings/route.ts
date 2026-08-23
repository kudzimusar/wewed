import { NextRequest, NextResponse } from 'next/server'
import { BookingCommerceError, createBookingDraft, listWeddingBookings } from '@/lib/booking-commerce'
import { requireWeddingPermission } from '@/lib/wedding-access'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'vendors.view')
  if (access.error) return access.error
  try {
    const data = await listWeddingBookings(access.context.weddingId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[BOOKINGS GET] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load bookings.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error
  try {
    const body = await request.json() as Record<string, unknown>
    if (typeof body.itemId !== 'string' || !body.itemId.trim()) {
      return NextResponse.json({ success: false, error: 'itemId is required.' }, { status: 400 })
    }
    const data = await createBookingDraft({
      weddingId: access.context.weddingId,
      actorUserId: access.context.session.userId,
      customerUserId: access.context.session.userId,
      itemId: body.itemId,
      variantId: typeof body.variantId === 'string' ? body.variantId : null,
      quantity: typeof body.quantity === 'number' ? body.quantity : Number(body.quantity || 1),
      selectedAddOns: Array.isArray(body.selectedAddOns) ? body.selectedAddOns.filter((item): item is string => typeof item === 'string') : [],
      eventDate: body.eventDate,
      serviceStart: body.serviceStart,
      serviceEnd: body.serviceEnd,
      appointmentAt: body.appointmentAt,
      pickupAt: body.pickupAt,
      returnDueAt: body.returnDueAt,
      serviceLocation: body.serviceLocation,
      guestCount: body.guestCount,
      notes: body.notes,
      referralToken: typeof body.referralToken === 'string' ? body.referralToken : null,
    })
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    if (error instanceof BookingCommerceError) {
      return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    }
    console.error('[BOOKINGS POST] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to create booking.' }, { status: 500 })
  }
}
