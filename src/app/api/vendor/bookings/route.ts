import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { BookingCommerceError, listProviderBookings } from '@/lib/booking-commerce'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = readAppSession(request)
  if (!session || session.role !== 'vendor') return NextResponse.json({ success: false, error: 'Vendor sign-in required.' }, { status: 401 })
  try {
    const data = await listProviderBookings(session.userId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[VENDOR BOOKINGS GET] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load vendor bookings.' }, { status: 500 })
  }
}
