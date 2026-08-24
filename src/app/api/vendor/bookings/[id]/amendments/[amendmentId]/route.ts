import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { BookingCommerceError, providerBusinessForUser } from '@/lib/booking-commerce'
import { decideBookingAmendment } from '@/lib/booking-amendments'
import { db } from '@/lib/db'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; amendmentId: string }> }) {
  const session = readAppSession(request)
  if (!session || session.role !== 'vendor') return NextResponse.json({ success: false, error: 'Vendor sign-in required.' }, { status: 401 })
  try {
    const { id, amendmentId } = await params
    const business = await providerBusinessForUser(session.userId)
    const scoped = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT a.id
         FROM wewed_booking."BookingAmendment" a
         JOIN wewed_booking."Booking" b ON b.id=a."bookingId"
        WHERE a.id=$1 AND b.id=$2 AND b."businessAccountId"=$3
        LIMIT 1`,
      amendmentId,
      id,
      business.businessAccountId,
    )
    if (!scoped[0]) throw new BookingCommerceError('Booking amendment not found.', 404, 'AMENDMENT_NOT_FOUND')

    const body = await request.json() as Record<string, unknown>
    const decision = body.decision === 'accept' || body.decision === 'reject' ? body.decision : null
    if (!decision) return NextResponse.json({ success: false, error: 'decision must be accept or reject.' }, { status: 400 })
    const data = await decideBookingAmendment({
      amendmentId,
      actorUserId: session.userId,
      decision,
      contractAmendmentId: typeof body.contractAmendmentId === 'string' ? body.contractAmendmentId : null,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[VENDOR BOOKING AMENDMENT POST] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to decide booking amendment.' }, { status: 500 })
  }
}