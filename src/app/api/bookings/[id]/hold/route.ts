import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { BookingCommerceError, holdBooking } from '@/lib/booking-commerce'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
      ? body.idempotencyKey.trim().slice(0, 200)
      : randomUUID()
    const data = await holdBooking({ bookingId: id, weddingId: access.context.weddingId, actorUserId: access.context.session.userId, idempotencyKey })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof BookingCommerceError) {
      return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    }
    console.error('[BOOKING HOLD POST] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to reserve availability.' }, { status: 500 })
  }
}
