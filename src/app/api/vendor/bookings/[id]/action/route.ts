import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { BookingCommerceError } from '@/lib/booking-commerce'
import { providerBookingActionGoverned } from '@/lib/booking-governance'

const ACTIONS = new Set(['approve','decline','preparing','ready','in_progress','return_due','inspection','completed'])

type Action = 'approve'|'decline'|'preparing'|'ready'|'in_progress'|'return_due'|'inspection'|'completed'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = readAppSession(request)
  if (!session || session.role !== 'vendor') return NextResponse.json({ success: false, error: 'Vendor sign-in required.' }, { status: 401 })
  try {
    const { id } = await params
    const body = await request.json() as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action : ''
    if (!ACTIONS.has(action)) return NextResponse.json({ success: false, error: 'Unsupported booking action.' }, { status: 400 })
    const data = await providerBookingActionGoverned({ bookingId: id, actorUserId: session.userId, action: action as Action })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[VENDOR BOOKING ACTION POST] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to update booking.' }, { status: 500 })
  }
}
