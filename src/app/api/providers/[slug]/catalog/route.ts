import { NextRequest, NextResponse } from 'next/server'
import { BookingCommerceError, getPublicCatalogItem, listPublicCatalog } from '@/lib/booking-commerce'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const itemSlug = request.nextUrl.searchParams.get('item')
    const data = itemSlug
      ? await getPublicCatalogItem(slug, itemSlug)
      : await listPublicCatalog(slug)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof BookingCommerceError) {
      return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    }
    console.error('[PROVIDER CATALOG GET] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load the provider catalogue.' }, { status: 500 })
  }
}
