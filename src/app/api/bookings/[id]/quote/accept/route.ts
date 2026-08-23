import { NextRequest, NextResponse } from 'next/server'
import { BookingCommerceError } from '@/lib/booking-commerce'
import { acceptBookingQuote } from '@/lib/booking-governance'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const data = await acceptBookingQuote({
      bookingId: id,
      weddingId: access.context.weddingId,
      actorUserId: access.context.session.userId,
      quoteId: typeof body.quoteId === 'string' ? body.quoteId : null,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[BOOKING QUOTE ACCEPT POST] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to accept quote.' }, { status: 500 })
  }
}
