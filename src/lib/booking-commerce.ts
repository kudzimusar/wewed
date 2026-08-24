import 'server-only'

import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'

type JsonObject = Record<string, unknown>

export class BookingCommerceError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = 'BOOKING_ERROR',
  ) {
    super(message)
  }
}

export const BOOKING_MODES = ['instant', 'request', 'quote', 'appointment'] as const
export const BOOKING_STATUSES = [
  'draft', 'held', 'requested', 'quote_requested', 'quote_proposed', 'awaiting_vendor', 'awaiting_terms',
  'awaiting_deposit', 'confirmed', 'preparing', 'ready', 'in_progress', 'return_due',
  'inspection', 'completed', 'declined', 'expired', 'cancelled', 'refunded', 'disputed',
] as const

interface CatalogItemRow {
  id: string
  offeringId: string
  businessAccountId: string
  providerSlug: string
  providerName: string
  category: string
  slug: string
  name: string
  description: string | null
  bookingArchetype: string
  bookingMode: string
  basePriceCents: number | null
  currency: string
  pricingUnit: string | null
  pricingSnapshotVersion: number
  minQuantity: number | null
  maxQuantity: number | null
  holdMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  requiresFitting: boolean
  requiresContract: boolean
  attributes: unknown
  addOns: unknown
  availabilityPolicy: unknown
}

interface VariantRow {
  id: string
  catalogItemId: string
  sku: string
  name: string
  optionValues: unknown
  priceOverrideCents: number | null
  inventoryMode: string
  replacementValueCents: number | null
}

function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as JsonObject
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asDate(value: unknown, field: string): Date | null {
  if (value == null || value === '') return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new BookingCommerceError(`Invalid ${field}.`, 400, 'INVALID_DATE')
  return date
}

function positiveInt(value: unknown, fallback = 1): number {
  if (value == null || value === '') return fallback
  const number = Number(value)
  if (!Number.isInteger(number) || number <= 0) {
    throw new BookingCommerceError('Quantity must be a positive whole number.', 400, 'INVALID_QUANTITY')
  }
  return number
}

function text(value: unknown, max = 4000): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function bookingReference(): string {
  return `WW-BKG-${new Date().getUTCFullYear()}-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`
}

function itemPublic(row: CatalogItemRow, variants: VariantRow[], media: unknown[], resourceCount: number) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    bookingArchetype: row.bookingArchetype,
    bookingMode: row.bookingMode,
    basePriceCents: row.basePriceCents,
    currency: row.currency,
    pricingUnit: row.pricingUnit,
    minQuantity: row.minQuantity,
    maxQuantity: row.maxQuantity,
    requiresFitting: row.requiresFitting,
    requiresContract: row.requiresContract,
    attributes: object(row.attributes),
    addOns: array(row.addOns),
    availabilityPolicy: object(row.availabilityPolicy),
    variants: variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      optionValues: object(variant.optionValues),
      priceOverrideCents: variant.priceOverrideCents,
      inventoryMode: variant.inventoryMode,
      replacementValueCents: variant.replacementValueCents,
    })),
    media,
    resourceCount,
  }
}

async function getCatalogItem(itemId: string): Promise<CatalogItemRow> {
  const rows = await db.$queryRawUnsafe<CatalogItemRow[]>(
    `SELECT i.id, i."offeringId", o."businessAccountId", p.slug AS "providerSlug",
            p."displayName" AS "providerName", o.category,
            i.slug, i.name, i.description, i."bookingArchetype", i."bookingMode",
            i."basePriceCents", i.currency, i."pricingUnit", i."pricingSnapshotVersion",
            i."minQuantity", i."maxQuantity", i."holdMinutes", i."bufferBeforeMinutes",
            i."bufferAfterMinutes", i."requiresFitting", i."requiresContract",
            i.attributes, i."addOns", i."availabilityPolicy"
       FROM wewed_booking."ProviderCatalogItem" i
       JOIN wewed_admin."ProviderServiceOffering" o ON o.id=i."offeringId"
       JOIN wewed_admin."ProviderProfile" p ON p."businessAccountId"=o."businessAccountId"
       JOIN public."BusinessAccount" ba ON ba.id=o."businessAccountId"
      WHERE i.id=$1 AND i.status='published' AND o.status='published'
        AND p.visibility='published' AND ba.status='active' AND ba."onboardingStatus"='complete'
      LIMIT 1`,
    itemId,
  )
  const item = rows[0]
  if (!item) throw new BookingCommerceError('This bookable item is unavailable.', 404, 'CATALOG_ITEM_NOT_FOUND')
  return item
}

async function getVariant(itemId: string, variantId: string | null): Promise<VariantRow | null> {
  if (!variantId) return null
  const rows = await db.$queryRawUnsafe<VariantRow[]>(
    `SELECT id, "catalogItemId", sku, name, "optionValues", "priceOverrideCents", "inventoryMode", "replacementValueCents"
       FROM wewed_booking."ProviderCatalogVariant"
      WHERE id=$1 AND "catalogItemId"=$2 AND status='active' LIMIT 1`,
    variantId,
    itemId,
  )
  if (!rows[0]) throw new BookingCommerceError('The selected option is unavailable.', 404, 'VARIANT_NOT_FOUND')
  return rows[0]
}

export async function listPublicCatalog(providerSlug: string) {
  const providers = await db.$queryRawUnsafe<Array<{
    id: string
    slug: string
    displayName: string
    businessAccountId: string
    coverImageUrl: string | null
  }>>(
    `SELECT p.id, p.slug, p."displayName", p."businessAccountId", p."coverImageUrl"
       FROM wewed_admin."ProviderProfile" p
       JOIN public."BusinessAccount" ba ON ba.id=p."businessAccountId"
      WHERE p.slug=$1 AND p.visibility='published' AND ba.status='active' AND ba."onboardingStatus"='complete'
      LIMIT 1`,
    providerSlug,
  )
  const provider = providers[0]
  if (!provider) throw new BookingCommerceError('Provider profile unavailable.', 404, 'PROVIDER_NOT_FOUND')

  const items = await db.$queryRawUnsafe<CatalogItemRow[]>(
    `SELECT i.id, i."offeringId", o."businessAccountId", p.slug AS "providerSlug",
            p."displayName" AS "providerName", o.category,
            i.slug, i.name, i.description, i."bookingArchetype", i."bookingMode",
            i."basePriceCents", i.currency, i."pricingUnit", i."pricingSnapshotVersion",
            i."minQuantity", i."maxQuantity", i."holdMinutes", i."bufferBeforeMinutes",
            i."bufferAfterMinutes", i."requiresFitting", i."requiresContract",
            i.attributes, i."addOns", i."availabilityPolicy"
       FROM wewed_booking."ProviderCatalogItem" i
       JOIN wewed_admin."ProviderServiceOffering" o ON o.id=i."offeringId"
       JOIN wewed_admin."ProviderProfile" p ON p."businessAccountId"=o."businessAccountId"
      WHERE p.slug=$1 AND i.status='published' AND o.status='published'
      ORDER BY i."sortOrder", i.name`,
    providerSlug,
  )

  const itemIds = items.map((item) => item.id)
  if (!itemIds.length) return { provider, items: [] }

  const variants = await db.$queryRawUnsafe<VariantRow[]>(
    `SELECT id, "catalogItemId", sku, name, "optionValues", "priceOverrideCents", "inventoryMode", "replacementValueCents"
       FROM wewed_booking."ProviderCatalogVariant"
      WHERE "catalogItemId"=ANY($1::text[]) AND status='active'
      ORDER BY name`,
    itemIds,
  )
  const media = await db.$queryRawUnsafe<Array<{
    id: string
    catalogItemId: string
    variantId: string | null
    type: string
    url: string
    thumbnailUrl: string | null
    altText: string
    caption: string | null
    sortOrder: number
  }>>(
    `SELECT id, "catalogItemId", "variantId", type, url, "thumbnailUrl", "altText", caption, "sortOrder"
       FROM wewed_booking."ProviderCatalogMedia"
      WHERE "catalogItemId"=ANY($1::text[]) AND "isPublished"=true
      ORDER BY "catalogItemId", "sortOrder"`,
    itemIds,
  )
  const resourceCounts = await db.$queryRawUnsafe<Array<{ catalogItemId: string; count: bigint }>>(
    `SELECT "catalogItemId", count(*)::bigint AS count
       FROM wewed_booking."BookingResource"
      WHERE "catalogItemId"=ANY($1::text[]) AND status='active'
      GROUP BY "catalogItemId"`,
    itemIds,
  )

  const counts = new Map(resourceCounts.map((entry) => [entry.catalogItemId, Number(entry.count)]))
  return {
    provider,
    items: items.map((item) => itemPublic(
      item,
      variants.filter((variant) => variant.catalogItemId === item.id),
      media.filter((entry) => entry.catalogItemId === item.id),
      counts.get(item.id) ?? 0,
    )),
  }
}

export async function getPublicCatalogItem(providerSlug: string, itemSlug: string) {
  const catalog = await listPublicCatalog(providerSlug)
  const item = catalog.items.find((entry) => entry.slug === itemSlug)
  if (!item) throw new BookingCommerceError('Bookable item unavailable.', 404, 'CATALOG_ITEM_NOT_FOUND')
  return { provider: catalog.provider, item }
}

export async function calculatePrice(input: {
  itemId: string
  variantId?: string | null
  quantity?: number
  selectedAddOns?: string[]
}) {
  const item = await getCatalogItem(input.itemId)
  const variant = await getVariant(item.id, input.variantId ?? null)
  const quantity = positiveInt(input.quantity, item.minQuantity ?? 1)
  if (item.minQuantity != null && quantity < item.minQuantity) {
    throw new BookingCommerceError(`Minimum quantity is ${item.minQuantity}.`, 400, 'MINIMUM_QUANTITY')
  }
  if (item.maxQuantity != null && quantity > item.maxQuantity) {
    throw new BookingCommerceError(`Maximum quantity is ${item.maxQuantity}.`, 400, 'MAXIMUM_QUANTITY')
  }

  const unitPriceCents = variant?.priceOverrideCents ?? item.basePriceCents
  const selected = new Set((input.selectedAddOns ?? []).filter((entry) => typeof entry === 'string'))
  const addOnLines = array(item.addOns).flatMap((raw) => {
    const addOn = object(raw)
    const id = typeof addOn.id === 'string' ? addOn.id : null
    if (!id || !selected.has(id)) return []
    const priceCents = Number(addOn.priceCents)
    if (!Number.isInteger(priceCents) || priceCents < 0) return []
    const perQuantity = addOn.quantityMode === 'per_item'
    return [{ id, name: typeof addOn.name === 'string' ? addOn.name : id, priceCents, quantity: perQuantity ? quantity : 1 }]
  })

  if (unitPriceCents == null || item.bookingMode === 'quote') {
    return {
      state: 'quote_required' as const,
      currency: item.currency,
      quantity,
      unitPriceCents: null,
      subtotalCents: null,
      feesCents: null,
      depositCents: null,
      totalCents: null,
      lines: addOnLines,
      snapshot: {
        catalogueItemId: item.id,
        variantId: variant?.id ?? null,
        version: item.pricingSnapshotVersion,
        pricingState: 'quote_required',
      },
    }
  }

  const base = unitPriceCents * quantity
  const addOnTotal = addOnLines.reduce((sum, line) => sum + line.priceCents * line.quantity, 0)
  const subtotalCents = base + addOnTotal
  const policy = object(item.availabilityPolicy)
  const feeCents = Number(policy.bookingFeeCents)
  const feesCents = Number.isInteger(feeCents) && feeCents > 0 ? feeCents : 0
  const depositPercent = Number(policy.depositPercent)
  const depositFixed = Number(policy.depositCents)
  const totalCents = subtotalCents + feesCents
  const depositCents = Number.isInteger(depositFixed) && depositFixed >= 0
    ? Math.min(depositFixed, totalCents)
    : Number.isFinite(depositPercent) && depositPercent > 0
      ? Math.min(totalCents, Math.round(totalCents * Math.min(depositPercent, 100) / 100))
      : null

  return {
    state: 'calculated' as const,
    currency: item.currency,
    quantity,
    unitPriceCents,
    subtotalCents,
    feesCents,
    depositCents,
    totalCents,
    lines: [
      { id: item.id, name: variant ? `${item.name} — ${variant.name}` : item.name, priceCents: unitPriceCents, quantity },
      ...addOnLines,
    ],
    snapshot: {
      catalogueItemId: item.id,
      variantId: variant?.id ?? null,
      version: item.pricingSnapshotVersion,
      unitPriceCents,
      addOns: addOnLines,
      calculatedAt: new Date().toISOString(),
    },
  }
}

export async function createBookingDraft(input: {
  weddingId: string
  actorUserId: string
  customerUserId: string
  itemId: string
  variantId?: string | null
  quantity?: number
  selectedAddOns?: string[]
  eventDate?: unknown
  serviceStart?: unknown
  serviceEnd?: unknown
  appointmentAt?: unknown
  pickupAt?: unknown
  returnDueAt?: unknown
  serviceLocation?: unknown
  guestCount?: unknown
  notes?: unknown
  referralToken?: string | null
}) {
  const item = await getCatalogItem(input.itemId)
  const variant = await getVariant(item.id, input.variantId ?? null)
  const price = await calculatePrice({ itemId: item.id, variantId: variant?.id, quantity: input.quantity, selectedAddOns: input.selectedAddOns })
  const id = randomUUID()
  const lineId = randomUUID()
  const eventDate = asDate(input.eventDate, 'event date')
  const serviceStart = asDate(input.serviceStart, 'service start')
  const serviceEnd = asDate(input.serviceEnd, 'service end')
  const appointmentAt = asDate(input.appointmentAt, 'appointment')
  const pickupAt = asDate(input.pickupAt, 'pickup')
  const returnDueAt = asDate(input.returnDueAt, 'return due')
  if (serviceStart && serviceEnd && !(serviceEnd > serviceStart)) throw new BookingCommerceError('Service end must be after service start.', 400, 'INVALID_TIME_RANGE')
  const guestCount = input.guestCount == null || input.guestCount === '' ? null : Number(input.guestCount)
  if (guestCount != null && (!Number.isInteger(guestCount) || guestCount < 0)) throw new BookingCommerceError('Guest count is invalid.', 400, 'INVALID_GUEST_COUNT')

  const referrals = input.referralToken
    ? await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM wewed_booking."ReferralLink" WHERE token=$1 AND "businessAccountId"=$2 AND "isActive"=true AND ("expiresAt" IS NULL OR "expiresAt">CURRENT_TIMESTAMP) LIMIT 1`,
      input.referralToken,
      item.businessAccountId,
    )
    : []
  const referralId = referrals[0]?.id ?? null

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_booking."Booking"
       (id,"publicReference","businessAccountId","offeringId","weddingId","customerUserId","createdByUserId","bookingMode",status,currency,"subtotalCents","feesCents","depositCents","totalCents","priceSnapshot","eventDate","serviceStart","serviceEnd","pickupAt","returnDueAt","appointmentAt","serviceLocation","guestCount","customerNotes","referralLinkId","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft',$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      id,
      bookingReference(),
      item.businessAccountId,
      item.offeringId,
      input.weddingId,
      input.customerUserId,
      input.actorUserId,
      item.bookingMode === 'plan_only' ? 'request' : item.bookingMode,
      price.currency,
      price.subtotalCents,
      price.feesCents ?? 0,
      price.depositCents,
      price.totalCents,
      JSON.stringify(price.snapshot),
      eventDate,
      serviceStart,
      serviceEnd,
      pickupAt,
      returnDueAt,
      appointmentAt,
      text(input.serviceLocation, 1000),
      guestCount,
      text(input.notes),
      referralId,
    )
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_booking."BookingLine"
       (id,"bookingId","catalogItemId","variantId","nameSnapshot","descriptionSnapshot",quantity,"unitPriceCents","lineTotalCents","pricingSnapshot","selectedOptions","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      lineId,
      id,
      item.id,
      variant?.id ?? null,
      variant ? `${item.name} — ${variant.name}` : item.name,
      item.description,
      price.quantity,
      price.unitPriceCents,
      price.subtotalCents,
      JSON.stringify(price.snapshot),
      JSON.stringify({ addOns: input.selectedAddOns ?? [] }),
    )
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType","toStatus",metadata) VALUES ($1,$2,$3,'booking.created','draft',$4::jsonb)`,
      randomUUID(), id, input.actorUserId, JSON.stringify({ source: 'marketplace' }),
    )
    if (referralId) {
      await tx.$executeRawUnsafe(
        `INSERT INTO wewed_booking."ReferralEvent" (id,"referralLinkId","bookingId","userId","eventType",metadata) VALUES ($1,$2,$3,$4,'booking_started','{}'::jsonb)`,
        randomUUID(), referralId, id, input.actorUserId,
      )
    }
  })
  return getBookingForWedding(id, input.weddingId)
}

export async function getBookingForWedding(bookingId: string, weddingId: string) {
  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT b.*, p.slug AS "providerSlug", p."displayName" AS "providerName", o.category,
            COALESCE(jsonb_agg(jsonb_build_object(
              'id',l.id,'catalogItemId',l."catalogItemId",'variantId',l."variantId",'name',l."nameSnapshot",
              'quantity',l.quantity,'unitPriceCents',l."unitPriceCents",'lineTotalCents',l."lineTotalCents",
              'selectedOptions',l."selectedOptions"
            ) ORDER BY l."createdAt") FILTER (WHERE l.id IS NOT NULL),'[]'::jsonb) AS lines
       FROM wewed_booking."Booking" b
       JOIN wewed_admin."ProviderProfile" p ON p."businessAccountId"=b."businessAccountId"
       JOIN wewed_admin."ProviderServiceOffering" o ON o.id=b."offeringId"
       LEFT JOIN wewed_booking."BookingLine" l ON l."bookingId"=b.id AND l."supersededAt" IS NULL
      WHERE b.id=$1 AND b."weddingId"=$2
      GROUP BY b.id,p.slug,p."displayName",o.category
      LIMIT 1`,
    bookingId,
    weddingId,
  )
  if (!rows[0]) throw new BookingCommerceError('Booking not found.', 404, 'BOOKING_NOT_FOUND')
  return rows[0]
}

export async function listWeddingBookings(weddingId: string) {
  return db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT b.id,b."publicReference",b."businessAccountId",b."offeringId",b.status,b."bookingMode",b.currency,
            b."totalCents",b."depositCents",b."eventDate",b."serviceStart",b."serviceEnd",b."appointmentAt",
            b."pickupAt",b."returnDueAt",b."deliveryAt",b."setupStart",b."setupEnd",b."collectionAt",
            b."serviceLocation",b."serviceEngagementId",b."confirmedAt",b."createdAt",b."updatedAt",
            p.slug AS "providerSlug",p."displayName" AS "providerName",o.category,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.id,'name',l."nameSnapshot",'quantity',l.quantity,'catalogItemId',l."catalogItemId",'variantId',l."variantId",'selectedOptions',l."selectedOptions") ORDER BY l."createdAt") FROM wewed_booking."BookingLine" l WHERE l."bookingId"=b.id AND l."supersededAt" IS NULL),'[]'::jsonb) AS lines
       FROM wewed_booking."Booking" b
       JOIN wewed_admin."ProviderProfile" p ON p."businessAccountId"=b."businessAccountId"
       JOIN wewed_admin."ProviderServiceOffering" o ON o.id=b."offeringId"
      WHERE b."weddingId"=$1 ORDER BY b."createdAt" DESC`,
    weddingId,
  )
}

export async function providerBusinessForUser(userId: string) {
  const rows = await db.$queryRawUnsafe<Array<{ businessAccountId: string; businessName: string }>>(
    `SELECT ba.id AS "businessAccountId",ba.name AS "businessName"
       FROM public."BusinessAccountMember" bam
       JOIN public."BusinessAccount" ba ON ba.id=bam."businessAccountId"
      WHERE bam."userId"=$1 AND bam.status='active' AND ba.status='active' AND ba."onboardingStatus"='complete'
        AND ba.type IN ('vendor','venue')
      ORDER BY CASE WHEN bam.role='business_owner' THEN 0 ELSE 1 END,ba.id LIMIT 1`,
    userId,
  )
  if (!rows[0]) throw new BookingCommerceError('Approved vendor account required.', 403, 'VENDOR_ACCOUNT_REQUIRED')
  return rows[0]
}

export async function listProviderBookings(userId: string) {
  const business = await providerBusinessForUser(userId)
  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT b.id,b."publicReference",b."weddingId",b.status,b."bookingMode",b.currency,b."totalCents",b."depositCents",
            b."eventDate",b."serviceStart",b."serviceEnd",b."appointmentAt",b."pickupAt",b."returnDueAt",
            b."deliveryAt",b."setupStart",b."setupEnd",b."collectionAt",b."serviceLocation",b."guestCount",b."customerNotes",
            b."serviceEngagementId",b."createdAt",b."updatedAt",w.title AS "weddingTitle",o.category,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.id,'name',l."nameSnapshot",'quantity',l.quantity,'catalogItemId',l."catalogItemId",'variantId',l."variantId",'selectedOptions',l."selectedOptions") ORDER BY l."createdAt") FROM wewed_booking."BookingLine" l WHERE l."bookingId"=b.id AND l."supersededAt" IS NULL),'[]'::jsonb) AS lines
       FROM wewed_booking."Booking" b
       JOIN public."Wedding" w ON w.id=b."weddingId"
       JOIN wewed_admin."ProviderServiceOffering" o ON o.id=b."offeringId"
      WHERE b."businessAccountId"=$1 ORDER BY b."createdAt" DESC`,
    business.businessAccountId,
  )
  return { business, bookings: rows }
}

export async function createReferralLink(input: { businessAccountId: string; catalogItemId?: string | null; createdByUserId?: string | null; channel?: string | null; campaign?: string | null }) {
  const token = randomUUID().replaceAll('-', '')
  const id = randomUUID()
  await db.$executeRawUnsafe(
    `INSERT INTO wewed_booking."ReferralLink" (id,token,"businessAccountId","catalogItemId","createdByUserId",channel,campaign,"isActive") VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
    id, token, input.businessAccountId, input.catalogItemId ?? null, input.createdByUserId ?? null, text(input.channel, 80), text(input.campaign, 120),
  )
  return { id, token, url: `https://wewed.pro/r/${token}` }
}

export async function resolveReferral(token: string) {
  const rows = await db.$queryRawUnsafe<Array<{ id: string; providerSlug: string; itemSlug: string | null }>>(
    `SELECT r.id,p.slug AS "providerSlug",i.slug AS "itemSlug"
       FROM wewed_booking."ReferralLink" r
       JOIN wewed_admin."ProviderProfile" p ON p."businessAccountId"=r."businessAccountId"
       LEFT JOIN wewed_booking."ProviderCatalogItem" i ON i.id=r."catalogItemId"
      WHERE r.token=$1 AND r."isActive"=true AND (r."expiresAt" IS NULL OR r."expiresAt">CURRENT_TIMESTAMP)
      LIMIT 1`,
    token,
  )
  const referral = rows[0]
  if (!referral) throw new BookingCommerceError('Referral link is unavailable.', 404, 'REFERRAL_NOT_FOUND')
  await db.$executeRawUnsafe(
    `INSERT INTO wewed_booking."ReferralEvent" (id,"referralLinkId","eventType",metadata) VALUES ($1,$2,'open','{}'::jsonb)`,
    randomUUID(), referral.id,
  )
  return {
    ...referral,
    destination: referral.itemSlug
      ? `/vendors/${encodeURIComponent(referral.providerSlug)}/book/${encodeURIComponent(referral.itemSlug)}?ref=${encodeURIComponent(token)}`
      : `/vendors/${encodeURIComponent(referral.providerSlug)}?ref=${encodeURIComponent(token)}`,
  }
}
