import { NextRequest, NextResponse } from 'next/server'
import { BookingCommerceError } from '@/lib/booking-commerce'
import { listBookingAmendments, proposeBookingAmendment } from '@/lib/booking-amendments'
import { requireWeddingPermission } from '@/lib/wedding-access'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWeddingPermission(request, 'vendors.view')
  if (access.error) return access.error
  try {
    const { id } = await params
    const data = await listBookingAmendments(id, access.context.weddingId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[BOOKING AMENDMENTS GET] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load booking amendments.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireWeddingPermission(request, 'vendors.edit')
  if (access.error) return access.error
  try {
    const { id } = await params
    const body = await request.json() as Record<string, unknown>
    const patch = body.patch && typeof body.patch === 'object' && !Array.isArray(body.patch)
      ? body.patch as Record<string, unknown>
      : {}
    const data = await proposeBookingAmendment({
      bookingId: id,
      weddingId: access.context.weddingId,
      actorUserId: access.context.session.userId,
      summary: body.summary,
      patch,
    })
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[BOOKING AMENDMENTS POST] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to propose booking amendment.' }, { status: 500 })
  }
}