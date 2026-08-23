import { NextRequest, NextResponse } from 'next/server'
import { BookingCommerceError, getBookingForWedding } from '@/lib/booking-commerce'
import { requireWeddingPermission } from '@/lib/wedding-access'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWeddingPermission(request, 'vendors.view')
  if (access.error) return access.error
  try {
    const { id } = await params
    const data = await getBookingForWedding(id, access.context.weddingId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof BookingCommerceError) {
      return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    }
    console.error('[BOOKING GET] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load booking.' }, { status: 500 })
  }
}
