import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { BookingCommerceError } from '@/lib/booking-commerce'
import { decideBookingAmendment } from '@/lib/booking-amendments'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; amendmentId: string }> }) {
  const session = readAppSession(request)
  if (!session || session.role !== 'vendor') return NextResponse.json({ success: false, error: 'Vendor sign-in required.' }, { status: 401 })
  try {
    const { id, amendmentId } = await params
    const body = await request.json() as Record<string, unknown>
    const decision = body.decision === 'accept' || body.decision === 'reject' ? body.decision : null
    if (!decision) return NextResponse.json({ success: false, error: 'decision must be accept or reject.' }, { status: 400 })
    const data = await decideBookingAmendment({
      amendmentId,
      actorUserId: session.userId,
      decision,
      contractAmendmentId: typeof body.contractAmendmentId === 'string' ? body.contractAmendmentId : null,
    })
    if (String(data.id) !== id) throw new BookingCommerceError('Booking amendment does not belong to this booking.', 404, 'AMENDMENT_NOT_FOUND')
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[VENDOR BOOKING AMENDMENT POST] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to decide booking amendment.' }, { status: 500 })
  }
}