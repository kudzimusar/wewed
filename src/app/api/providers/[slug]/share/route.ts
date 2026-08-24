import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { BookingCommerceError, createReferralLink, getPublicCatalogItem, listPublicCatalog } from '@/lib/booking-commerce'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const itemSlug = request.nextUrl.searchParams.get('item')
    const data = itemSlug ? await getPublicCatalogItem(slug, itemSlug) : await listPublicCatalog(slug)
    const providerUrl = `https://wewed.pro/vendors/${encodeURIComponent(data.provider.slug)}`
    const itemUrl = itemSlug ? `${providerUrl}/book/${encodeURIComponent(itemSlug)}` : null
    return NextResponse.json({
      success: true,
      data: {
        providerName: data.provider.displayName,
        providerUrl,
        itemUrl,
        shareUrl: itemUrl ?? providerUrl,
        qrEndpoint: `/api/qrcode?data=${encodeURIComponent(itemUrl ?? providerUrl)}`,
      },
    })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[PROVIDER SHARE GET] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to prepare share details.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = readAppSession(request)
  if (!session) return NextResponse.json({ success: false, error: 'Sign in to create a tracked referral link.' }, { status: 401 })
  try {
    const { slug } = await params
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const itemSlug = typeof body.itemSlug === 'string' && body.itemSlug.trim() ? body.itemSlug.trim() : null
    const catalog = itemSlug ? await getPublicCatalogItem(slug, itemSlug) : await listPublicCatalog(slug)
    const item = itemSlug && 'item' in catalog ? catalog.item : null
    const referral = await createReferralLink({
      businessAccountId: catalog.provider.businessAccountId,
      catalogItemId: item?.id ?? null,
      createdByUserId: session.userId,
      channel: typeof body.channel === 'string' ? body.channel : null,
      campaign: typeof body.campaign === 'string' ? body.campaign : null,
    })
    return NextResponse.json({
      success: true,
      data: {
        ...referral,
        qrEndpoint: `/api/qrcode?data=${encodeURIComponent(referral.url)}`,
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[PROVIDER SHARE POST] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to create referral link.' }, { status: 500 })
  }
}
