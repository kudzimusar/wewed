import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { BookingCommerceError, providerBusinessForUser } from '@/lib/booking-commerce'
import { db } from '@/lib/db'

async function authorize(request: NextRequest, itemId: string) {
  const session = readAppSession(request)
  if (!session || session.role !== 'vendor') throw new BookingCommerceError('Vendor sign-in required.', 401, 'VENDOR_SESSION_REQUIRED')
  const business = await providerBusinessForUser(session.userId)
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT i.id FROM wewed_booking."ProviderCatalogItem" i JOIN wewed_admin."ProviderServiceOffering" o ON o.id=i."offeringId" WHERE i.id=$1 AND o."businessAccountId"=$2 LIMIT 1`,
    itemId, business.businessAccountId,
  )
  if (!rows[0]) throw new BookingCommerceError('Catalogue item not found.', 404, 'CATALOG_ITEM_NOT_FOUND')
  return business
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: itemId } = await params
    await authorize(request, itemId)
    const body = await request.json() as Record<string, unknown>
    const action = typeof body.action === 'string' ? body.action : ''

    if (action === 'variant.create') {
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 160) : ''
      const sku = typeof body.sku === 'string' ? body.sku.trim().slice(0, 100) : ''
      const inventoryMode = typeof body.inventoryMode === 'string' ? body.inventoryMode : 'none'
      if (!name || !sku || !['none','serialized','pooled','capacity','time_slot'].includes(inventoryMode)) return NextResponse.json({ success: false, error: 'Variant name, SKU and valid inventory mode are required.' }, { status: 400 })
      const id = randomUUID()
      const price = body.priceOverrideCents == null || body.priceOverrideCents === '' ? null : Number(body.priceOverrideCents)
      if (price != null && (!Number.isInteger(price) || price < 0)) return NextResponse.json({ success: false, error: 'Variant price must be a non-negative amount in cents.' }, { status: 400 })
      await db.$executeRawUnsafe(
        `INSERT INTO wewed_booking."ProviderCatalogVariant" (id,"catalogItemId",sku,name,"optionValues",status,"priceOverrideCents","inventoryMode","replacementValueCents",metadata) VALUES ($1,$2,$3,$4,$5::jsonb,'active',$6,$7,$8,$9::jsonb)`,
        id,itemId,sku,name,JSON.stringify(body.optionValues && typeof body.optionValues === 'object' && !Array.isArray(body.optionValues) ? body.optionValues : {}),price,inventoryMode,
        body.replacementValueCents == null || body.replacementValueCents === '' ? null : Number(body.replacementValueCents),
        JSON.stringify(body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {}),
      )
      return NextResponse.json({ success: true, data: { id } }, { status: 201 })
    }

    if (action === 'resource.create') {
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 160) : ''
      const resourceType = typeof body.resourceType === 'string' ? body.resourceType : ''
      const capacity = Number(body.capacity || 1)
      if (!name || !['item','pool','staff','team','vehicle','venue','space','capacity','slot','other'].includes(resourceType) || !Number.isInteger(capacity) || capacity <= 0) return NextResponse.json({ success: false, error: 'Resource name, type and positive capacity are required.' }, { status: 400 })
      const variantId = typeof body.variantId === 'string' && body.variantId ? body.variantId : null
      if (variantId) {
        const variants = await db.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM wewed_booking."ProviderCatalogVariant" WHERE id=$1 AND "catalogItemId"=$2 AND status='active' LIMIT 1`,variantId,itemId)
        if (!variants[0]) return NextResponse.json({ success: false, error: 'Selected variant is unavailable.' }, { status: 404 })
      }
      const id = randomUUID()
      await db.$executeRawUnsafe(
        `INSERT INTO wewed_booking."BookingResource" (id,"catalogItemId","variantId",name,"resourceType","serialReference",capacity,status,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8::jsonb)`,
        id,itemId,variantId,name,resourceType,typeof body.serialReference === 'string' ? body.serialReference.trim().slice(0,160) || null : null,capacity,JSON.stringify(body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {}),
      )
      return NextResponse.json({ success: true, data: { id } }, { status: 201 })
    }

    if (action === 'media.create') {
      const type = body.type === 'video' ? 'video' : body.type === 'image' ? 'image' : ''
      const url = typeof body.url === 'string' ? body.url.trim().slice(0, 2000) : ''
      if (!type || !/^https:\/\//i.test(url)) return NextResponse.json({ success: false, error: 'Published media must use an HTTPS image or video URL.' }, { status: 400 })
      const variantId = typeof body.variantId === 'string' && body.variantId ? body.variantId : null
      if (variantId) {
        const variants = await db.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM wewed_booking."ProviderCatalogVariant" WHERE id=$1 AND "catalogItemId"=$2 LIMIT 1`,variantId,itemId)
        if (!variants[0]) return NextResponse.json({ success: false, error: 'Selected variant is unavailable.' }, { status: 404 })
      }
      const id = randomUUID()
      await db.$executeRawUnsafe(
        `INSERT INTO wewed_booking."ProviderCatalogMedia" (id,"catalogItemId","variantId",type,url,"thumbnailUrl","altText",caption,"sortOrder","isPublished") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        id,itemId,variantId,type,url,typeof body.thumbnailUrl === 'string' && /^https:\/\//i.test(body.thumbnailUrl) ? body.thumbnailUrl.slice(0,2000) : null,
        typeof body.altText === 'string' ? body.altText.trim().slice(0,300) : '',typeof body.caption === 'string' ? body.caption.trim().slice(0,1000) || null : null,Number(body.sortOrder)||0,Boolean(body.isPublished),
      )
      return NextResponse.json({ success: true, data: { id } }, { status: 201 })
    }

    if (action === 'blackout.create') {
      const resourceId = typeof body.resourceId === 'string' ? body.resourceId : ''
      const startsAt = new Date(String(body.startsAt || ''))
      const endsAt = new Date(String(body.endsAt || ''))
      if (!resourceId || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || !(endsAt > startsAt)) return NextResponse.json({ success: false, error: 'Resource and a valid blackout time range are required.' }, { status: 400 })
      const resources = await db.$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM wewed_booking."BookingResource" WHERE id=$1 AND "catalogItemId"=$2 LIMIT 1`,resourceId,itemId)
      if (!resources[0]) return NextResponse.json({ success: false, error: 'Resource not found.' }, { status: 404 })
      const id = randomUUID()
      await db.$executeRawUnsafe(
        `INSERT INTO wewed_booking."AvailabilityRule" (id,"resourceId","ruleType","startsAt","endsAt",reason) VALUES ($1,$2,'blackout',$3,$4,$5)`,
        id,resourceId,startsAt,endsAt,typeof body.reason === 'string' ? body.reason.trim().slice(0,500) || null : null,
      )
      return NextResponse.json({ success: true, data: { id } }, { status: 201 })
    }

    return NextResponse.json({ success: false, error: 'Unsupported catalogue action.' }, { status: 400 })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[VENDOR CATALOG ASSETS POST] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to update catalogue resources.' }, { status: 500 })
  }
}
