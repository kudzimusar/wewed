import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { BookingCommerceError, providerBusinessForUser } from '@/lib/booking-commerce'
import { db } from '@/lib/db'

const ARCHETYPES = new Set(['individual_rental','quantity_rental','appointment','timed_service','event_day_service','capacity','transport','package','custom','hybrid'])
const MODES = new Set(['instant','request','quote','appointment','plan_only'])

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asArray(value: unknown): unknown[] { return Array.isArray(value) ? value : [] }

async function vendorSession(request: NextRequest) {
  const session = readAppSession(request)
  if (!session || session.role !== 'vendor') throw new BookingCommerceError('Vendor sign-in required.', 401, 'VENDOR_SESSION_REQUIRED')
  const business = await providerBusinessForUser(session.userId)
  return { session, business }
}

export async function GET(request: NextRequest) {
  try {
    const { business } = await vendorSession(request)
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT i.*,o.category,o."displayName" AS "offeringName",
              COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'sku',v.sku,'name',v.name,'optionValues',v."optionValues",'status',v.status,'priceOverrideCents',v."priceOverrideCents",'inventoryMode',v."inventoryMode",'replacementValueCents',v."replacementValueCents") ORDER BY v.name) FROM wewed_booking."ProviderCatalogVariant" v WHERE v."catalogItemId"=i.id),'[]'::jsonb) AS variants,
              COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'variantId',m."variantId",'type',m.type,'url',m.url,'thumbnailUrl',m."thumbnailUrl",'altText',m."altText",'caption',m.caption,'sortOrder',m."sortOrder",'isPublished',m."isPublished") ORDER BY m."sortOrder") FROM wewed_booking."ProviderCatalogMedia" m WHERE m."catalogItemId"=i.id),'[]'::jsonb) AS media,
              COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'variantId',r."variantId",'name',r.name,'resourceType',r."resourceType",'serialReference',r."serialReference",'capacity',r.capacity,'status',r.status,'metadata',r.metadata) ORDER BY r.name) FROM wewed_booking."BookingResource" r WHERE r."catalogItemId"=i.id),'[]'::jsonb) AS resources
         FROM wewed_booking."ProviderCatalogItem" i
         JOIN wewed_admin."ProviderServiceOffering" o ON o.id=i."offeringId"
        WHERE o."businessAccountId"=$1
        ORDER BY o.category,i."sortOrder",i.name`,
      business.businessAccountId,
    )
    const offerings = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id,category,"displayName",status,"pricingVisibility","startingPriceCents",currency,"pricingModel","aiReadinessStatus"
         FROM wewed_admin."ProviderServiceOffering"
        WHERE "businessAccountId"=$1 AND status IN ('draft','published') ORDER BY category`,
      business.businessAccountId,
    )
    return NextResponse.json({ success: true, data: { business, offerings, items: rows } })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[VENDOR CATALOG GET] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load catalogue.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { business } = await vendorSession(request)
    const body = await request.json() as Record<string, unknown>
    const offeringId = typeof body.offeringId === 'string' ? body.offeringId : ''
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 160) : ''
    const archetype = typeof body.bookingArchetype === 'string' ? body.bookingArchetype : ''
    const bookingMode = typeof body.bookingMode === 'string' ? body.bookingMode : 'request'
    if (!offeringId || !name || !ARCHETYPES.has(archetype) || !MODES.has(bookingMode)) {
      return NextResponse.json({ success: false, error: 'Offering, item name, booking archetype and booking mode are required.' }, { status: 400 })
    }
    const offerings = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM wewed_admin."ProviderServiceOffering" WHERE id=$1 AND "businessAccountId"=$2 AND status IN ('draft','published') LIMIT 1`,
      offeringId, business.businessAccountId,
    )
    if (!offerings[0]) return NextResponse.json({ success: false, error: 'Offering is not available for this vendor.' }, { status: 404 })

    const rawPrice = body.basePriceCents == null || body.basePriceCents === '' ? null : Number(body.basePriceCents)
    if (rawPrice != null && (!Number.isInteger(rawPrice) || rawPrice < 0)) return NextResponse.json({ success: false, error: 'Price must be a non-negative amount in cents.' }, { status: 400 })
    if (bookingMode === 'instant' && rawPrice == null) return NextResponse.json({ success: false, error: 'Instant Book requires a verified deterministic price.' }, { status: 400 })
    const currency = typeof body.currency === 'string' && /^[A-Z]{3}$/.test(body.currency.toUpperCase()) ? body.currency.toUpperCase() : 'USD'
    const holdMinutes = Number.isInteger(Number(body.holdMinutes)) ? Math.max(1, Math.min(1440, Number(body.holdMinutes))) : 15
    const itemId = randomUUID()
    let slug = slugify(typeof body.slug === 'string' ? body.slug : name)
    if (!slug) slug = `item-${itemId.slice(0, 8)}`

    await db.$executeRawUnsafe(
      `INSERT INTO wewed_booking."ProviderCatalogItem"
       (id,"offeringId",slug,name,description,"bookingArchetype","bookingMode",status,"basePriceCents",currency,"pricingUnit","minQuantity","maxQuantity","holdMinutes","bufferBeforeMinutes","bufferAfterMinutes","requiresFitting","requiresContract",attributes,"addOns","availabilityPolicy","sortOrder","publishedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20::jsonb,$21::jsonb,$22,CASE WHEN $8='published' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
      itemId, offeringId, slug, name,
      typeof body.description === 'string' ? body.description.trim().slice(0, 8000) || null : null,
      archetype, bookingMode, body.status === 'published' ? 'published' : 'draft', rawPrice, currency,
      typeof body.pricingUnit === 'string' ? body.pricingUnit.trim().slice(0, 80) || null : null,
      body.minQuantity == null || body.minQuantity === '' ? null : Number(body.minQuantity),
      body.maxQuantity == null || body.maxQuantity === '' ? null : Number(body.maxQuantity),
      holdMinutes, Math.max(0, Number(body.bufferBeforeMinutes) || 0), Math.max(0, Number(body.bufferAfterMinutes) || 0),
      Boolean(body.requiresFitting), Boolean(body.requiresContract), JSON.stringify(asObject(body.attributes)), JSON.stringify(asArray(body.addOns)), JSON.stringify(asObject(body.availabilityPolicy)), Number(body.sortOrder) || 0,
    )
    return NextResponse.json({ success: true, data: { id: itemId, slug } }, { status: 201 })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    if (error instanceof Error && error.message.includes('ProviderCatalogItem_offering_slug_key')) return NextResponse.json({ success: false, error: 'That catalogue slug is already in use for this service.' }, { status: 409 })
    console.error('[VENDOR CATALOG POST] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to create catalogue item.' }, { status: 500 })
  }
}
