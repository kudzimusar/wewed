import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { BookingCommerceError, providerBusinessForUser } from '@/lib/booking-commerce'
import { db } from '@/lib/db'

async function context(request: NextRequest, itemId: string) {
  const session = readAppSession(request)
  if (!session || session.role !== 'vendor') throw new BookingCommerceError('Vendor sign-in required.', 401, 'VENDOR_SESSION_REQUIRED')
  const business = await providerBusinessForUser(session.userId)
  const items = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT i.id FROM wewed_booking."ProviderCatalogItem" i JOIN wewed_admin."ProviderServiceOffering" o ON o.id=i."offeringId" WHERE i.id=$1 AND o."businessAccountId"=$2 LIMIT 1`,
    itemId, business.businessAccountId,
  )
  if (!items[0]) throw new BookingCommerceError('Catalogue item not found.', 404, 'CATALOG_ITEM_NOT_FOUND')
  return { session, business }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await context(request, id)
    const body = await request.json() as Record<string, unknown>
    const allowedStatus = body.status === 'published' || body.status === 'draft' || body.status === 'archived' ? body.status : null
    const basePriceCents = body.basePriceCents === undefined ? undefined : body.basePriceCents === null || body.basePriceCents === '' ? null : Number(body.basePriceCents)
    if (basePriceCents !== undefined && basePriceCents !== null && (!Number.isInteger(basePriceCents) || basePriceCents < 0)) return NextResponse.json({ success: false, error: 'Price must be a non-negative amount in cents.' }, { status: 400 })
    const rows = await db.$queryRawUnsafe<Array<{ bookingMode: string }>>(`SELECT "bookingMode" FROM wewed_booking."ProviderCatalogItem" WHERE id=$1`, id)
    const mode = typeof body.bookingMode === 'string' ? body.bookingMode : rows[0]?.bookingMode
    if (mode === 'instant' && basePriceCents === null) return NextResponse.json({ success: false, error: 'Instant Book requires deterministic pricing.' }, { status: 400 })

    await db.$executeRawUnsafe(
      `UPDATE wewed_booking."ProviderCatalogItem" SET
        name=CASE WHEN $2::text IS NULL THEN name ELSE $2 END,
        description=CASE WHEN $3::text IS NULL THEN description ELSE $3 END,
        "bookingMode"=CASE WHEN $4::text IS NULL THEN "bookingMode" ELSE $4 END,
        "basePriceCents"=CASE WHEN $5::boolean=false THEN "basePriceCents" ELSE $6 END,
        status=CASE WHEN $7::text IS NULL THEN status ELSE $7 END,
        attributes=CASE WHEN $8::jsonb IS NULL THEN attributes ELSE $8::jsonb END,
        "addOns"=CASE WHEN $9::jsonb IS NULL THEN "addOns" ELSE $9::jsonb END,
        "availabilityPolicy"=CASE WHEN $10::jsonb IS NULL THEN "availabilityPolicy" ELSE $10::jsonb END,
        "requiresFitting"=CASE WHEN $11::boolean=false THEN "requiresFitting" ELSE $12 END,
        "requiresContract"=CASE WHEN $13::boolean=false THEN "requiresContract" ELSE $14 END,
        "publishedAt"=CASE WHEN $7='published' THEN COALESCE("publishedAt",CURRENT_TIMESTAMP) WHEN $7='archived' THEN "publishedAt" ELSE "publishedAt" END
       WHERE id=$1`,
      id,
      typeof body.name === 'string' ? body.name.trim().slice(0, 160) || null : null,
      typeof body.description === 'string' ? body.description.trim().slice(0, 8000) || null : null,
      typeof body.bookingMode === 'string' ? body.bookingMode : null,
      body.basePriceCents !== undefined,
      basePriceCents ?? null,
      allowedStatus,
      body.attributes && typeof body.attributes === 'object' && !Array.isArray(body.attributes) ? JSON.stringify(body.attributes) : null,
      Array.isArray(body.addOns) ? JSON.stringify(body.addOns) : null,
      body.availabilityPolicy && typeof body.availabilityPolicy === 'object' && !Array.isArray(body.availabilityPolicy) ? JSON.stringify(body.availabilityPolicy) : null,
      body.requiresFitting !== undefined,
      Boolean(body.requiresFitting),
      body.requiresContract !== undefined,
      Boolean(body.requiresContract),
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[VENDOR CATALOG PATCH] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to update catalogue item.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await context(request, id)
    const active = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM wewed_booking."BookingLine" l JOIN wewed_booking."Booking" b ON b.id=l."bookingId" WHERE l."catalogItemId"=$1 AND b.status NOT IN ('draft','declined','expired','cancelled','refunded','completed')`, id,
    )
    if (Number(active[0]?.count ?? 0) > 0) return NextResponse.json({ success: false, error: 'This item has active booking history and cannot be deleted. Archive it instead.' }, { status: 409 })
    await db.$executeRawUnsafe(`UPDATE wewed_booking."ProviderCatalogItem" SET status='archived' WHERE id=$1`, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[VENDOR CATALOG DELETE] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to archive catalogue item.' }, { status: 500 })
  }
}
