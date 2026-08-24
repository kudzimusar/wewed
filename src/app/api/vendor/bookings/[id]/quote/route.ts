import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { BookingCommerceError } from '@/lib/booking-commerce'
import { proposeBookingQuote } from '@/lib/booking-governance'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = readAppSession(request)
  if (!session || session.role !== 'vendor') return NextResponse.json({ success: false, error: 'Vendor sign-in required.' }, { status: 401 })
  try {
    const { id } = await params
    const body = await request.json() as Record<string, unknown>
    const data = await proposeBookingQuote({
      bookingId: id,
      actorUserId: session.userId,
      currency: body.currency,
      subtotalCents: body.subtotalCents,
      feesCents: body.feesCents,
      depositCents: body.depositCents,
      notes: body.notes,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[VENDOR BOOKING QUOTE POST] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to propose quote.' }, { status: 500 })
  }
}
