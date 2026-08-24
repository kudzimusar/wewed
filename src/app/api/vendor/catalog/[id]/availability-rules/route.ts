import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { BookingCommerceError, providerBusinessForUser } from '@/lib/booking-commerce'
import { db } from '@/lib/db'

const RULE_TYPES = new Set(['weekly','blackout','available_window','capacity_override'])

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
    await context(request, id)
    const data = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT ar.*,r.name AS "resourceName",r."resourceType",r."variantId"
         FROM wewed_booking."AvailabilityRule" ar
         JOIN wewed_booking."BookingResource" r ON r.id=ar."resourceId"
        WHERE r."catalogItemId"=$1
        ORDER BY r.name,ar."ruleType",ar."dayOfWeek",ar."startsAt",ar."startTime",ar.id`,
      id,
    )
    return NextResponse.json({ success: true, data })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[VENDOR AVAILABILITY RULE GET] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load availability rules.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await context(request, id)
    const body = await request.json() as Record<string, unknown>
    const resourceId = typeof body.resourceId === 'string' ? body.resourceId : ''
    const ruleType = typeof body.ruleType === 'string' ? body.ruleType : ''
    if (!resourceId || !RULE_TYPES.has(ruleType)) return NextResponse.json({ success: false, error: 'Resource and valid rule type are required.' }, { status: 400 })
    const owned = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM wewed_booking."BookingResource" WHERE id=$1 AND "catalogItemId"=$2 LIMIT 1`,
      resourceId,
      id,
    )
    if (!owned[0]) throw new BookingCommerceError('Resource not found for this item.', 404, 'RESOURCE_NOT_FOUND')

    const dayOfWeek = body.dayOfWeek == null || body.dayOfWeek === '' ? null : Number(body.dayOfWeek)
    if (dayOfWeek != null && (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)) return NextResponse.json({ success: false, error: 'dayOfWeek must be 0–6.' }, { status: 400 })
    const capacityOverride = body.capacityOverride == null || body.capacityOverride === '' ? null : Number(body.capacityOverride)
    if (capacityOverride != null && (!Number.isInteger(capacityOverride) || capacityOverride < 0)) return NextResponse.json({ success: false, error: 'Capacity override must be a non-negative whole number.' }, { status: 400 })
    const startsAt = body.startsAt ? new Date(String(body.startsAt)) : null
    const endsAt = body.endsAt ? new Date(String(body.endsAt)) : null
    if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime())) || (startsAt && endsAt && endsAt <= startsAt)) return NextResponse.json({ success: false, error: 'Availability window is invalid.' }, { status: 400 })
    const startTime = typeof body.startTime === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(body.startTime) ? body.startTime : null
    const endTime = typeof body.endTime === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(body.endTime) ? body.endTime : null
    if (ruleType === 'weekly' && (dayOfWeek == null || !startTime || !endTime || endTime <= startTime)) return NextResponse.json({ success: false, error: 'Weekly rules require day, start time and later end time.' }, { status: 400 })
    if ((ruleType === 'blackout' || ruleType === 'available_window') && (!startsAt || !endsAt)) return NextResponse.json({ success: false, error: 'This rule requires a start and end date/time.' }, { status: 400 })
    if (ruleType === 'capacity_override' && capacityOverride == null) return NextResponse.json({ success: false, error: 'Capacity override is required.' }, { status: 400 })

    const ruleId = randomUUID()
    await db.$executeRawUnsafe(
      `INSERT INTO wewed_booking."AvailabilityRule"
       (id,"resourceId","ruleType","dayOfWeek","startsAt","endsAt","startTime","endTime","capacityOverride",reason,metadata,"createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7::time,$8::time,$9,$10,$11::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      ruleId,
      resourceId,
      ruleType,
      dayOfWeek,
      startsAt,
      endsAt,
      startTime,
      endTime,
      capacityOverride,
      typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null,
      JSON.stringify(body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {}),
    )
    return NextResponse.json({ success: true, data: { id: ruleId } }, { status: 201 })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[VENDOR AVAILABILITY RULE POST] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to create availability rule.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await context(request, id)
    const ruleId = request.nextUrl.searchParams.get('ruleId') || ''
    if (!ruleId) return NextResponse.json({ success: false, error: 'ruleId is required.' }, { status: 400 })
    const removed = await db.$executeRawUnsafe(
      `DELETE FROM wewed_booking."AvailabilityRule" ar
        USING wewed_booking."BookingResource" r
        WHERE ar.id=$1 AND ar."resourceId"=r.id AND r."catalogItemId"=$2`,
      ruleId,
      id,
    )
    if (!removed) throw new BookingCommerceError('Availability rule not found.', 404, 'AVAILABILITY_RULE_NOT_FOUND')
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof BookingCommerceError) return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status })
    console.error('[VENDOR AVAILABILITY RULE DELETE] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to remove availability rule.' }, { status: 500 })
  }
}