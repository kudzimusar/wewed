import { NextRequest, NextResponse } from 'next/server'
import { BookingCommerceError, calculatePrice, getPublicCatalogItem } from '@/lib/booking-commerce'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const body = await request.json() as Record<string, unknown>
    const itemSlug = typeof body.itemSlug === 'string' ? body.itemSlug : ''
    if (!itemSlug) return NextResponse.json({ success: false, error: 'itemSlug is required.' }, { status: 400 })
    const { item } = await getPublicCatalogItem(slug, itemSlug)
    const selectedAddOns = Array.isArray(body.selectedAddOns) ? body.selectedAddOns.filter((value): value is string => typeof value === 'string') : []
    const data = await calculatePrice({
      itemId: item.id,
      variantId: typeof body.variantId === 'string' && body.variantId ? body.variantId : null,
      quantity: body.quantity == null ? 1 : Number(body.quantity),
      selectedAddOns,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[PROVIDER PRICE POST] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to calculate this booking.' }, { status: 500 })
  }
}
