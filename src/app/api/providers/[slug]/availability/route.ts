import { NextRequest, NextResponse } from 'next/server'
import { BookingCommerceError, getPublicCatalogItem } from '@/lib/booking-commerce'
import { checkDeterministicAvailability } from '@/lib/booking-resource-engine'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const itemSlug = request.nextUrl.searchParams.get('item')
    if (!itemSlug) return NextResponse.json({ success: false, error: 'item is required.' }, { status: 400 })
    const { item } = await getPublicCatalogItem(slug, itemSlug)
    const startsAt = new Date(request.nextUrl.searchParams.get('startsAt') || '')
    const endsAt = new Date(request.nextUrl.searchParams.get('endsAt') || '')
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return NextResponse.json({ success: false, error: 'Valid startsAt and endsAt values are required.' }, { status: 400 })
    }
    const selectedAddOns = (request.nextUrl.searchParams.get('addOns') || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
    const availability = await checkDeterministicAvailability({
      itemId: item.id,
      variantId: request.nextUrl.searchParams.get('variantId'),
      quantity: Number(request.nextUrl.searchParams.get('quantity') || 1),
      startsAt,
      endsAt,
      serviceLocation: request.nextUrl.searchParams.get('location'),
      selectedAddOns,
    })
    return NextResponse.json({ success: true, data: availability })
  } catch (error) {
    if (error instanceof BookingCommerceError) {
      return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    }
    console.error('[PROVIDER AVAILABILITY GET] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to check availability.' }, { status: 500 })
  }
}