import { NextRequest, NextResponse } from 'next/server'
import { BookingCommerceError } from '@/lib/booking-commerce'
import { bookingGovernanceSummary, syncBookingTerms } from '@/lib/booking-governance'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWeddingPermission(request, 'vendors.view')
  if (access.error) return access.error
  try {
    const { id } = await params
    const data = await bookingGovernanceSummary(id, access.context.weddingId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[BOOKING TERMS GET] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load booking governance.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error
  try {
    const { id } = await params
    const data = await syncBookingTerms({ bookingId: id, weddingId: access.context.weddingId, actorUserId: access.context.session.userId })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[BOOKING TERMS POST] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to confirm contract effectivity.' }, { status: 500 })
  }
}
