import { NextRequest, NextResponse } from 'next/server'
import { listWeddingBookingCommercialContext } from '@/lib/booking-commercial-context'
import { requireWeddingPermission } from '@/lib/wedding-access'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'vendors.view')
  if (access.error) return access.error
  try {
    const data = await listWeddingBookingCommercialContext(access.context.weddingId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[BOOKING COMMERCIAL CONTEXT GET] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load booking commercial context.' }, { status: 500 })
  }
}
