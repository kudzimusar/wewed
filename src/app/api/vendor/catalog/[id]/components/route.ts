import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { BookingCommerceError, providerBusinessForUser } from '@/lib/booking-commerce'
import { db } from '@/lib/db'

async function context(request: NextRequest, itemId: string) {
  const session = readAppSession(request)
  if (!session || session.role !== 'vendor') throw new BookingCommerceError('Vendor sign-in required.', 401, 'VENDOR_SESSION_REQUIRED')
  const business = await providerBusinessForUser(session.userId)
  const item = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT i.id FROM wewed_booking."ProviderCatalogItem" i
       JOIN wewed_admin."ProviderServiceOffering" o ON o.id=i."offeringId"
      WHERE i.id=$1 AND o."businessAccountId"=$2 LIMIT 1`,
    itemId,
    business.businessAccountId,
  )
  if (!item[0]) throw new BookingCommerceError('Catalogue item not found.', 404, 'CATALOG_ITEM_NOT_FOUND')
  return business
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const business = await context(request, id)
    const components = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT c.id,c."parentCatalogItemId",c."childCatalogItemId",c."childVariantId",c."componentKind",c."selectionKey",c.name,c.quantity,c."isOptional",c."priceDeltaCents",c.status,c.metadata,
              ci.name AS "childItemName",ci.slug AS "childItemSlug",cv.name AS "childVariantName"
         FROM wewed_booking."ProviderCatalogComponent" c
         JOIN wewed_booking."ProviderCatalogItem" ci ON ci.id=c."childCatalogItemId"
         JOIN wewed_admin."ProviderServiceOffering" co ON co.id=ci."offeringId" AND co."businessAccountId"=$2
         LEFT JOIN wewed_booking."ProviderCatalogVariant" cv ON cv.id=c."childVariantId" AND cv."catalogItemId"=ci.id
        WHERE c."parentCatalogItemId"=$1
        ORDER BY c."componentKind",c.name,c.id`,
      id,
      business.businessAccountId,
    )
    const candidates = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT i.id,i.name,i.slug,i.status,o.category,
              COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'sku',v.sku) ORDER BY v.name) FROM wewed_booking."ProviderCatalogVariant" v WHERE v."catalogItemId"=i.id AND v.status='active'),'[]'::jsonb) AS variants
         FROM wewed_booking."ProviderCatalogItem" i
         JOIN wewed_admin."ProviderServiceOffering" o ON o.id=i."offeringId"
        WHERE o."businessAccountId"=$1 AND i.id<>$2 AND i.status IN ('draft','published')
        ORDER BY o.category,i.name`,
      business.businessAccountId,
      id,
    )
    return NextResponse.json({ success: true, data: { components, candidates } })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[VENDOR CATALOG COMPONENT GET] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load package components.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const business = await context(request, id)
    const body = await request.json() as Record<string, unknown>
    const childCatalogItemId = typeof body.childCatalogItemId === 'string' ? body.childCatalogItemId : ''
    const componentKind = body.componentKind === 'package' || body.componentKind === 'addon' ? body.componentKind : null
    const quantity = Number(body.quantity ?? 1)
    if (!childCatalogItemId || !componentKind || !Number.isInteger(quantity) || quantity <= 0) return NextResponse.json({ success: false, error: 'Child item, component type and positive quantity are required.' }, { status: 400 })
    if (childCatalogItemId === id) return NextResponse.json({ success: false, error: 'An item cannot contain itself.' }, { status: 400 })
    const child = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT i.id FROM wewed_booking."ProviderCatalogItem" i
         JOIN wewed_admin."ProviderServiceOffering" o ON o.id=i."offeringId"
        WHERE i.id=$1 AND o."businessAccountId"=$2 AND i.status IN ('draft','published') LIMIT 1`,
      childCatalogItemId,
      business.businessAccountId,
    )
    if (!child[0]) throw new BookingCommerceError('Component item not found for this vendor.', 404, 'COMPONENT_ITEM_NOT_FOUND')
    const childVariantId = typeof body.childVariantId === 'string' && body.childVariantId.trim() ? body.childVariantId.trim() : null
    if (childVariantId) {
      const variant = await db.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM wewed_booking."ProviderCatalogVariant" WHERE id=$1 AND "catalogItemId"=$2 AND status='active' LIMIT 1`,
        childVariantId,
        childCatalogItemId,
      )
      if (!variant[0]) throw new BookingCommerceError('Component variant is unavailable.', 404, 'COMPONENT_VARIANT_NOT_FOUND')
    }
    const selectionKey = componentKind === 'addon' && typeof body.selectionKey === 'string' ? body.selectionKey.trim().slice(0, 160) : null
    if (componentKind === 'addon' && !selectionKey) return NextResponse.json({ success: false, error: 'Resource-consuming add-ons must use the same add-on selection key as the public price option.' }, { status: 400 })
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 160) : ''
    if (!name) return NextResponse.json({ success: false, error: 'Component name is required.' }, { status: 400 })
    const priceDeltaCents = body.priceDeltaCents == null || body.priceDeltaCents === '' ? null : Number(body.priceDeltaCents)
    if (priceDeltaCents != null && (!Number.isInteger(priceDeltaCents) || priceDeltaCents < 0)) return NextResponse.json({ success: false, error: 'Component price delta must be non-negative cents.' }, { status: 400 })

    const componentId = randomUUID()
    await db.$executeRawUnsafe(
      `INSERT INTO wewed_booking."ProviderCatalogComponent"
       (id,"parentCatalogItemId","childCatalogItemId","childVariantId","componentKind","selectionKey",name,quantity,"isOptional","priceDeltaCents",status,metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11::jsonb)`,
      componentId,
      id,
      childCatalogItemId,
      childVariantId,
      componentKind,
      selectionKey,
      name,
      quantity,
      body.isOptional === true,
      priceDeltaCents,
      JSON.stringify(body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {}),
    )
    return NextResponse.json({ success: true, data: { id: componentId } }, { status: 201 })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    if (error instanceof Error && error.message.includes('ProviderCatalogComponent_identity_key')) return NextResponse.json({ success: false, error: 'That package/add-on component is already configured.' }, { status: 409 })
    console.error('[VENDOR CATALOG COMPONENT POST] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to add package component.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await context(request, id)
    const componentId = request.nextUrl.searchParams.get('componentId') || ''
    if (!componentId) return NextResponse.json({ success: false, error: 'componentId is required.' }, { status: 400 })
    const removed = await db.$executeRawUnsafe(
      `DELETE FROM wewed_booking."ProviderCatalogComponent" WHERE id=$1 AND "parentCatalogItemId"=$2`,
      componentId,
      id,
    )
    if (!removed) throw new BookingCommerceError('Component not found.', 404, 'COMPONENT_NOT_FOUND')
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[VENDOR CATALOG COMPONENT DELETE] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to remove package component.' }, { status: 500 })
  }
}