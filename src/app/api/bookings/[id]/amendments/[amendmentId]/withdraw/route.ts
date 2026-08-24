import { NextRequest, NextResponse } from 'next/server'
import { BookingCommerceError } from '@/lib/booking-commerce'
import { withdrawBookingAmendment } from '@/lib/booking-amendments'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; amendmentId: string }> }) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error
  try {
    const { id, amendmentId } = await params
    const data = await withdrawBookingAmendment({
      amendmentId,
      bookingId: id,
      weddingId: access.context.weddingId,
      actorUserId: access.context.session.userId,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[BOOKING AMENDMENT WITHDRAW POST] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to withdraw booking amendment.' }, { status: 500 })
  }
}