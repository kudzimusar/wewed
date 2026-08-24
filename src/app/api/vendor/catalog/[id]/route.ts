import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { BookingCommerceError, providerBusinessForUser } from '@/lib/booking-commerce'
import { db } from '@/lib/db'

const MODES = new Set(['instant','request','quote','appointment','plan_only'])

function optionalNonNegativeInteger(value: unknown, field: string, max = Number.MAX_SAFE_INTEGER): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) throw new BookingCommerceError(`${field} must be a non-negative whole number.`, 400, 'INVALID_AVAILABILITY_POLICY')
  return parsed
}

function optionalPositiveInteger(value: unknown, field: string, max = Number.MAX_SAFE_INTEGER): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) throw new BookingCommerceError(`${field} must be a positive whole number.`, 400, 'INVALID_AVAILABILITY_POLICY')
  return parsed
}

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

async function publicationReadiness(itemId: string, proposedMode: string, proposedStatus: string | null, proposedPrice: number | null | undefined) {
  const rows = await db.$queryRawUnsafe<Array<{
    bookingMode: string
    bookingArchetype: string
    status: string
    basePriceCents: number | null
    resourceCount: bigint
    componentCount: bigint
  }>>(
    `SELECT i."bookingMode",i."bookingArchetype",i.status,i."basePriceCents",
            (SELECT count(*)::bigint FROM wewed_booking."BookingResource" r WHERE r."catalogItemId"=i.id AND r.status='active') AS "resourceCount",
            (SELECT count(*)::bigint FROM wewed_booking."ProviderCatalogComponent" c WHERE c."parentCatalogItemId"=i.id AND c.status='active' AND c."componentKind"='package' AND c."isOptional"=false) AS "componentCount"
       FROM wewed_booking."ProviderCatalogItem" i WHERE i.id=$1 LIMIT 1`,
    itemId,
  )
  const row = rows[0]
  if (!row) throw new BookingCommerceError('Catalogue item not found.', 404, 'CATALOG_ITEM_NOT_FOUND')
  const status = proposedStatus ?? row.status
  if (status !== 'published') return
  const mode = proposedMode || row.bookingMode
  const price = proposedPrice === undefined ? row.basePriceCents : proposedPrice
  if (mode === 'instant' && price == null) throw new BookingCommerceError('Instant Book cannot be published without a deterministic price.', 400, 'INSTANT_PRICE_REQUIRED')
  if (row.bookingArchetype === 'package' && Number(row.componentCount) === 0) throw new BookingCommerceError('A package cannot be published until its component services/resources are configured.', 409, 'PACKAGE_COMPONENTS_REQUIRED')
  if (mode === 'instant' && Number(row.resourceCount) === 0 && Number(row.componentCount) === 0) throw new BookingCommerceError('Instant Book cannot be published without deterministic inventory/resources.', 409, 'INSTANT_RESOURCES_REQUIRED')
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await context(request, id)
    const body = await request.json() as Record<string, unknown>
    const allowedStatus = body.status === 'published' || body.status === 'draft' || body.status === 'archived' ? body.status : null
    const basePriceCents = body.basePriceCents === undefined ? undefined : body.basePriceCents === null || body.basePriceCents === '' ? null : Number(body.basePriceCents)
    if (basePriceCents !== undefined && basePriceCents !== null && (!Number.isInteger(basePriceCents) || basePriceCents < 0)) return NextResponse.json({ success: false, error: 'Price must be a non-negative amount in cents.' }, { status: 400 })
    const existing = await db.$queryRawUnsafe<Array<{ bookingMode: string; minDurationMinutes: number | null; maxDurationMinutes: number | null }>>(`SELECT "bookingMode","minDurationMinutes","maxDurationMinutes" FROM wewed_booking."ProviderCatalogItem" WHERE id=$1`, id)
    const mode = typeof body.bookingMode === 'string' ? body.bookingMode : existing[0]?.bookingMode
    if (!mode || !MODES.has(mode)) return NextResponse.json({ success: false, error: 'Unsupported booking mode.' }, { status: 400 })

    const minNoticeMinutes = optionalNonNegativeInteger(body.minNoticeMinutes, 'Minimum notice', 5256000)
    const bookingHorizonDays = optionalNonNegativeInteger(body.bookingHorizonDays, 'Booking horizon', 3650)
    const minDurationMinutes = optionalPositiveInteger(body.minDurationMinutes, 'Minimum duration', 5256000)
    const maxDurationMinutes = optionalPositiveInteger(body.maxDurationMinutes, 'Maximum duration', 5256000)
    const effectiveMinDuration = minDurationMinutes === undefined ? existing[0]?.minDurationMinutes ?? null : minDurationMinutes
    const effectiveMaxDuration = maxDurationMinutes === undefined ? existing[0]?.maxDurationMinutes ?? null : maxDurationMinutes
    if (effectiveMinDuration != null && effectiveMaxDuration != null && effectiveMaxDuration < effectiveMinDuration) return NextResponse.json({ success: false, error: 'Maximum duration cannot be shorter than minimum duration.' }, { status: 400 })
    const operatingTimezone = body.operatingTimezone === undefined ? undefined : typeof body.operatingTimezone === 'string' ? body.operatingTimezone.trim().slice(0, 100) || null : null
    if (operatingTimezone) {
      const zones = await db.$queryRawUnsafe<Array<{ ok: boolean }>>(`SELECT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=$1) AS ok`, operatingTimezone)
      if (!zones[0]?.ok) return NextResponse.json({ success: false, error: 'Operating timezone is not recognized by PostgreSQL.' }, { status: 400 })
    }
    const serviceAreaPolicy = body.serviceAreaPolicy === undefined ? undefined : body.serviceAreaPolicy && typeof body.serviceAreaPolicy === 'object' && !Array.isArray(body.serviceAreaPolicy) ? body.serviceAreaPolicy as Record<string, unknown> : {}
    if (serviceAreaPolicy && serviceAreaPolicy.mode === 'text_allowlist') {
      if (!Array.isArray(serviceAreaPolicy.allowedTerms) || serviceAreaPolicy.allowedTerms.filter((value) => typeof value === 'string' && value.trim()).length === 0) return NextResponse.json({ success: false, error: 'Text allowlist service area requires at least one allowed place/term.' }, { status: 400 })
    }
    const holdMinutes = optionalPositiveInteger(body.holdMinutes, 'Hold duration', 1440)
    const bufferBeforeMinutes = optionalNonNegativeInteger(body.bufferBeforeMinutes, 'Buffer before', 10080)
    const bufferAfterMinutes = optionalNonNegativeInteger(body.bufferAfterMinutes, 'Buffer after', 10080)

    await publicationReadiness(id, mode, allowedStatus, basePriceCents)

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
        "minNoticeMinutes"=CASE WHEN $15::boolean=false THEN "minNoticeMinutes" ELSE $16 END,
        "bookingHorizonDays"=CASE WHEN $17::boolean=false THEN "bookingHorizonDays" ELSE $18 END,
        "minDurationMinutes"=CASE WHEN $19::boolean=false THEN "minDurationMinutes" ELSE $20 END,
        "maxDurationMinutes"=CASE WHEN $21::boolean=false THEN "maxDurationMinutes" ELSE $22 END,
        "operatingTimezone"=CASE WHEN $23::boolean=false THEN "operatingTimezone" ELSE $24 END,
        "serviceAreaPolicy"=CASE WHEN $25::boolean=false THEN "serviceAreaPolicy" ELSE $26::jsonb END,
        "holdMinutes"=CASE WHEN $27::boolean=false THEN "holdMinutes" ELSE $28 END,
        "bufferBeforeMinutes"=CASE WHEN $29::boolean=false THEN "bufferBeforeMinutes" ELSE $30 END,
        "bufferAfterMinutes"=CASE WHEN $31::boolean=false THEN "bufferAfterMinutes" ELSE $32 END,
        "publishedAt"=CASE WHEN $7='published' THEN COALESCE("publishedAt",CURRENT_TIMESTAMP) ELSE "publishedAt" END
       WHERE id=$1`,
      id,
      typeof body.name === 'string' ? body.name.trim().slice(0, 160) || null : null,
      typeof body.description === 'string' ? body.description.trim().slice(0, 8000) || null : null,
      typeof body.bookingMode === 'string' ? mode : null,
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
      minNoticeMinutes !== undefined,
      minNoticeMinutes ?? null,
      bookingHorizonDays !== undefined,
      bookingHorizonDays ?? null,
      minDurationMinutes !== undefined,
      minDurationMinutes ?? null,
      maxDurationMinutes !== undefined,
      maxDurationMinutes ?? null,
      operatingTimezone !== undefined,
      operatingTimezone ?? null,
      serviceAreaPolicy !== undefined,
      JSON.stringify(serviceAreaPolicy ?? {}),
      holdMinutes !== undefined,
      holdMinutes ?? null,
      bufferBeforeMinutes !== undefined,
      bufferBeforeMinutes ?? null,
      bufferAfterMinutes !== undefined,
      bufferAfterMinutes ?? null,
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
      `SELECT count(*)::bigint AS count FROM wewed_booking."BookingLine" l JOIN wewed_booking."Booking" b ON b.id=l."bookingId" WHERE l."catalogItemId"=$1 AND l."supersededAt" IS NULL AND b.status NOT IN ('draft','declined','expired','cancelled','refunded','completed')`, id,
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