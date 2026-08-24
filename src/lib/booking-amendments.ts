import 'server-only'

import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { BookingCommerceError, calculatePrice, getBookingForWedding, providerBusinessForUser } from '@/lib/booking-commerce'
import { allocateBookingLineDeterministic, checkDeterministicAvailability } from '@/lib/booking-resource-engine'

type CurrentBooking = {
  id: string
  weddingId: string
  status: string
  bookingMode: string
  businessAccountId: string
  serviceEngagementId: string | null
  publicReference: string
  currency: string
  totalCents: number | null
  depositCents: number | null
  priceSnapshot: unknown
  eventDate: Date | null
  serviceStart: Date | null
  serviceEnd: Date | null
  appointmentAt: Date | null
  pickupAt: Date | null
  returnDueAt: Date | null
  deliveryAt: Date | null
  setupStart: Date | null
  setupEnd: Date | null
  collectionAt: Date | null
  serviceLocation: string | null
  lineId: string
  catalogItemId: string
  variantId: string | null
  quantity: number
  selectedOptions: unknown
  nameSnapshot: string
  descriptionSnapshot: string | null
  unitPriceCents: number | null
  lineTotalCents: number | null
  linePricingSnapshot: unknown
}

type AmendmentPatch = {
  variantId?: unknown
  quantity?: unknown
  selectedAddOns?: unknown
  eventDate?: unknown
  serviceStart?: unknown
  serviceEnd?: unknown
  appointmentAt?: unknown
  pickupAt?: unknown
  returnDueAt?: unknown
  deliveryAt?: unknown
  setupStart?: unknown
  setupEnd?: unknown
  collectionAt?: unknown
  serviceLocation?: unknown
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function datePatch(value: unknown, current: Date | null, field: string): Date | null {
  if (value === undefined) return current
  if (value === null || value === '') return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) throw new BookingCommerceError(`Invalid ${field}.`, 400, 'INVALID_DATE')
  return parsed
}

function textPatch(value: unknown, current: string | null, max = 1000) {
  if (value === undefined) return current
  if (value === null) return null
  if (typeof value !== 'string') throw new BookingCommerceError('Location must be text.', 400, 'INVALID_LOCATION')
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function quantityPatch(value: unknown, current: number) {
  if (value === undefined) return current
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new BookingCommerceError('Quantity must be a positive whole number.', 400, 'INVALID_QUANTITY')
  return parsed
}

function addOnsPatch(value: unknown, current: string[]) {
  if (value === undefined) return current
  if (!Array.isArray(value)) throw new BookingCommerceError('Selected add-ons must be a list.', 400, 'INVALID_ADDONS')
  return Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean))).slice(0, 100)
}

function variantPatch(value: unknown, current: string | null) {
  if (value === undefined) return current
  if (value === null || value === '') return null
  if (typeof value !== 'string') throw new BookingCommerceError('Variant is invalid.', 400, 'INVALID_VARIANT')
  return value.trim() || null
}

function iso(value: Date | null) {
  return value?.toISOString() ?? null
}

function serviceWindow(row: Pick<CurrentBooking, 'eventDate'|'serviceStart'|'serviceEnd'|'appointmentAt'|'pickupAt'|'returnDueAt'>) {
  const eventStart = row.eventDate ? new Date(`${row.eventDate.toISOString().slice(0, 10)}T00:00:00.000Z`) : null
  const eventEnd = row.eventDate ? new Date(`${row.eventDate.toISOString().slice(0, 10)}T23:59:59.999Z`) : null
  const startsAt = row.serviceStart ?? row.appointmentAt ?? row.pickupAt ?? eventStart
  const endsAt = row.serviceEnd ?? row.returnDueAt ?? (row.appointmentAt ? new Date(row.appointmentAt.getTime() + 60 * 60_000) : eventEnd)
  if (!startsAt || !endsAt || endsAt <= startsAt) throw new BookingCommerceError('The amended booking requires a valid service window.', 400, 'BOOKING_WINDOW_REQUIRED')
  return { startsAt, endsAt }
}

async function currentBooking(bookingId: string, weddingId?: string, forUpdate = false): Promise<CurrentBooking> {
  const rows = await db.$queryRawUnsafe<CurrentBooking[]>(
    `SELECT b.id,b."weddingId",b.status,b."bookingMode",b."businessAccountId",b."serviceEngagementId",b."publicReference",
            b.currency,b."totalCents",b."depositCents",b."priceSnapshot",b."eventDate",b."serviceStart",b."serviceEnd",
            b."appointmentAt",b."pickupAt",b."returnDueAt",b."deliveryAt",b."setupStart",b."setupEnd",b."collectionAt",b."serviceLocation",
            l.id AS "lineId",l."catalogItemId",l."variantId",l.quantity,l."selectedOptions",l."nameSnapshot",l."descriptionSnapshot",
            l."unitPriceCents",l."lineTotalCents",l."pricingSnapshot" AS "linePricingSnapshot"
       FROM wewed_booking."Booking" b
       JOIN LATERAL (
         SELECT * FROM wewed_booking."BookingLine" x
          WHERE x."bookingId"=b.id AND x."supersededAt" IS NULL
          ORDER BY x."createdAt" DESC,x.id DESC LIMIT 1
       ) l ON true
      WHERE b.id=$1 AND ($2::text IS NULL OR b."weddingId"=$2)
      ${forUpdate ? 'FOR UPDATE OF b' : ''}`,
    bookingId,
    weddingId ?? null,
  )
  const row = rows[0]
  if (!row) throw new BookingCommerceError('Booking not found.', 404, 'BOOKING_NOT_FOUND')
  return row
}

function beforeSnapshot(row: CurrentBooking) {
  return {
    booking: {
      currency: row.currency,
      totalCents: row.totalCents,
      depositCents: row.depositCents,
      eventDate: iso(row.eventDate),
      serviceStart: iso(row.serviceStart),
      serviceEnd: iso(row.serviceEnd),
      appointmentAt: iso(row.appointmentAt),
      pickupAt: iso(row.pickupAt),
      returnDueAt: iso(row.returnDueAt),
      deliveryAt: iso(row.deliveryAt),
      setupStart: iso(row.setupStart),
      setupEnd: iso(row.setupEnd),
      collectionAt: iso(row.collectionAt),
      serviceLocation: row.serviceLocation,
      priceSnapshot: row.priceSnapshot,
    },
    line: {
      id: row.lineId,
      catalogItemId: row.catalogItemId,
      variantId: row.variantId,
      quantity: row.quantity,
      selectedOptions: row.selectedOptions,
      nameSnapshot: row.nameSnapshot,
      descriptionSnapshot: row.descriptionSnapshot,
      unitPriceCents: row.unitPriceCents,
      lineTotalCents: row.lineTotalCents,
      pricingSnapshot: row.linePricingSnapshot,
    },
  }
}

async function buildAfter(row: CurrentBooking, patch: AmendmentPatch) {
  const currentAddOns = Array.isArray(object(row.selectedOptions).addOns)
    ? (object(row.selectedOptions).addOns as unknown[]).filter((entry): entry is string => typeof entry === 'string')
    : []
  const variantId = variantPatch(patch.variantId, row.variantId)
  const quantity = quantityPatch(patch.quantity, row.quantity)
  const selectedAddOns = addOnsPatch(patch.selectedAddOns, currentAddOns)
  const eventDate = datePatch(patch.eventDate, row.eventDate, 'event date')
  const serviceStart = datePatch(patch.serviceStart, row.serviceStart, 'service start')
  const serviceEnd = datePatch(patch.serviceEnd, row.serviceEnd, 'service end')
  const appointmentAt = datePatch(patch.appointmentAt, row.appointmentAt, 'appointment')
  const pickupAt = datePatch(patch.pickupAt, row.pickupAt, 'pickup')
  const returnDueAt = datePatch(patch.returnDueAt, row.returnDueAt, 'return due')
  const deliveryAt = datePatch(patch.deliveryAt, row.deliveryAt, 'delivery')
  const setupStart = datePatch(patch.setupStart, row.setupStart, 'setup start')
  const setupEnd = datePatch(patch.setupEnd, row.setupEnd, 'setup end')
  const collectionAt = datePatch(patch.collectionAt, row.collectionAt, 'collection')
  const serviceLocation = textPatch(patch.serviceLocation, row.serviceLocation)
  if (serviceStart && serviceEnd && serviceEnd <= serviceStart) throw new BookingCommerceError('Service end must be after service start.', 400, 'INVALID_TIME_RANGE')
  if (setupStart && setupEnd && setupEnd <= setupStart) throw new BookingCommerceError('Setup end must be after setup start.', 400, 'INVALID_SETUP_RANGE')
  if (pickupAt && returnDueAt && returnDueAt <= pickupAt) throw new BookingCommerceError('Return must be after pickup.', 400, 'INVALID_RENTAL_RANGE')
  if (deliveryAt && collectionAt && collectionAt <= deliveryAt) throw new BookingCommerceError('Collection must be after delivery.', 400, 'INVALID_LOGISTICS_RANGE')

  const price = await calculatePrice({ itemId: row.catalogItemId, variantId, quantity, selectedAddOns })
  if (price.totalCents == null && row.bookingMode === 'instant') throw new BookingCommerceError('An Instant Book amendment requires deterministic pricing.', 409, 'AMENDMENT_QUOTE_REQUIRED')
  const window = serviceWindow({ eventDate, serviceStart, serviceEnd, appointmentAt, pickupAt, returnDueAt })
  const availability = await checkDeterministicAvailability({
    itemId: row.catalogItemId,
    variantId,
    quantity,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    serviceLocation,
    selectedAddOns,
    excludeBookingId: row.id,
  })

  return {
    booking: {
      currency: price.currency,
      totalCents: price.totalCents,
      depositCents: price.depositCents,
      eventDate: iso(eventDate),
      serviceStart: iso(serviceStart),
      serviceEnd: iso(serviceEnd),
      appointmentAt: iso(appointmentAt),
      pickupAt: iso(pickupAt),
      returnDueAt: iso(returnDueAt),
      deliveryAt: iso(deliveryAt),
      setupStart: iso(setupStart),
      setupEnd: iso(setupEnd),
      collectionAt: iso(collectionAt),
      serviceLocation,
      priceSnapshot: price.snapshot,
    },
    line: {
      catalogItemId: row.catalogItemId,
      variantId,
      quantity,
      selectedOptions: { addOns: selectedAddOns },
      unitPriceCents: price.unitPriceCents,
      lineTotalCents: price.subtotalCents,
      pricingSnapshot: price.snapshot,
    },
    price,
    availability,
    window,
  }
}

async function effectiveContractFor(row: CurrentBooking) {
  if (!row.serviceEngagementId) return null
  const rows = await db.$queryRawUnsafe<Array<{ id: string; currentVersionId: string | null }>>(
    `SELECT c.id,cv.id AS "currentVersionId"
       FROM public."Contract" c
       LEFT JOIN public."ContractVersion" cv ON cv."contractId"=c.id AND cv."versionNumber"=c."currentVersionNumber"
      WHERE c."serviceEngagementId"=$1 AND c."weddingId"=$2 AND c.status IN ('EFFECTIVE','COMPLETED')
      ORDER BY c."createdAt" DESC LIMIT 1`,
    row.serviceEngagementId,
    row.weddingId,
  )
  return rows[0] ?? null
}

export async function listBookingAmendments(bookingId: string, weddingId: string) {
  await currentBooking(bookingId, weddingId)
  return db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT id,"bookingId",status,"requestedByUserId",summary,"beforeSnapshot","afterSnapshot","impactSnapshot","priceDeltaCents",
            "contractAmendmentId","decidedByUserId","decidedAt","effectiveAt","createdAt"
       FROM wewed_booking."BookingAmendment"
      WHERE "bookingId"=$1 ORDER BY "createdAt" DESC,id DESC`,
    bookingId,
  )
}

export async function proposeBookingAmendment(input: { bookingId: string; weddingId: string; actorUserId: string; summary: unknown; patch: AmendmentPatch }) {
  const row = await currentBooking(input.bookingId, input.weddingId)
  if (!['confirmed','preparing','ready'].includes(row.status)) throw new BookingCommerceError('Only an active confirmed booking can be amended through this workflow.', 409, 'AMENDMENT_STATE_NOT_ALLOWED')
  const summary = typeof input.summary === 'string' ? input.summary.trim().slice(0, 2000) : ''
  if (summary.length < 3) throw new BookingCommerceError('Explain the requested change.', 400, 'AMENDMENT_SUMMARY_REQUIRED')
  const existing = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM wewed_booking."BookingAmendment" WHERE "bookingId"=$1 AND status='proposed' LIMIT 1`,
    row.id,
  )
  if (existing[0]) throw new BookingCommerceError('This booking already has a proposed amendment awaiting decision.', 409, 'AMENDMENT_ALREADY_PENDING')

  const before = beforeSnapshot(row)
  const after = await buildAfter(row, input.patch)
  if (JSON.stringify(before.booking) === JSON.stringify(after.booking) &&
      JSON.stringify({ ...before.line, id: undefined, nameSnapshot: undefined, descriptionSnapshot: undefined }) === JSON.stringify(after.line)) {
    throw new BookingCommerceError('The amendment does not change the booking.', 400, 'AMENDMENT_NO_CHANGES')
  }
  const contract = await effectiveContractFor(row)
  const availability = after.availability
  const hasExistingAllocations = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*)::bigint AS count FROM wewed_booking."BookingResourceAllocation" WHERE "bookingId"=$1 AND state='confirmed'`,
    row.id,
  )
  const mustBeDeterministicallyAvailable = row.bookingMode === 'instant' || Number(hasExistingAllocations[0]?.count ?? 0) > 0
  if (mustBeDeterministicallyAvailable && availability.available !== true) {
    throw new BookingCommerceError(`The requested amendment is unavailable (${String(availability.reason || 'capacity')}).`, 409, 'AMENDMENT_UNAVAILABLE')
  }
  const newTotal = after.price.totalCents
  const oldTotal = row.totalCents
  const priceDeltaCents = newTotal == null || oldTotal == null ? null : newTotal - oldTotal
  const amendmentId = randomUUID()
  await db.$executeRawUnsafe(
    `INSERT INTO wewed_booking."BookingAmendment"
     (id,"bookingId",status,"requestedByUserId",summary,"beforeSnapshot","afterSnapshot","impactSnapshot","priceDeltaCents")
     VALUES ($1,$2,'proposed',$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8)`,
    amendmentId,
    row.id,
    input.actorUserId,
    summary,
    JSON.stringify(before),
    JSON.stringify({ booking: after.booking, line: after.line }),
    JSON.stringify({
      availability,
      price: after.price,
      requiresContractAmendment: Boolean(contract),
      contractId: contract?.id ?? null,
      baseContractVersionId: contract?.currentVersionId ?? null,
      resourceEngine: 'booking-resource-engine-v1',
    }),
    priceDeltaCents,
  )
  await db.$executeRawUnsafe(
    `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType",metadata)
     VALUES ($1,$2,$3,'booking.amendment_proposed',$4::jsonb)`,
    randomUUID(), row.id, input.actorUserId, JSON.stringify({ amendmentId, priceDeltaCents, requiresContractAmendment: Boolean(contract) }),
  )
  return listBookingAmendments(row.id, row.weddingId)
}

export async function withdrawBookingAmendment(input: { amendmentId: string; bookingId: string; weddingId: string; actorUserId: string }) {
  await currentBooking(input.bookingId, input.weddingId)
  const rows = await db.$queryRawUnsafe<Array<{ requestedByUserId: string; status: string }>>(
    `SELECT "requestedByUserId",status FROM wewed_booking."BookingAmendment" WHERE id=$1 AND "bookingId"=$2 LIMIT 1`,
    input.amendmentId,
    input.bookingId,
  )
  const amendment = rows[0]
  if (!amendment) throw new BookingCommerceError('Amendment not found.', 404, 'AMENDMENT_NOT_FOUND')
  if (amendment.requestedByUserId !== input.actorUserId) throw new BookingCommerceError('Only the amendment requester can withdraw it.', 403, 'AMENDMENT_WITHDRAW_FORBIDDEN')
  if (amendment.status !== 'proposed') throw new BookingCommerceError('This amendment is already final.', 409, 'AMENDMENT_FINAL')
  await db.$executeRawUnsafe(`UPDATE wewed_booking."BookingAmendment" SET status='withdrawn' WHERE id=$1`, input.amendmentId)
  await db.$executeRawUnsafe(
    `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType",metadata) VALUES ($1,$2,$3,'booking.amendment_withdrawn',$4::jsonb)`,
    randomUUID(), input.bookingId, input.actorUserId, JSON.stringify({ amendmentId: input.amendmentId }),
  )
  return listBookingAmendments(input.bookingId, input.weddingId)
}

export async function decideBookingAmendment(input: { amendmentId: string; actorUserId: string; decision: 'accept'|'reject'; contractAmendmentId?: string | null }) {
  const business = await providerBusinessForUser(input.actorUserId)
  let weddingId = ''
  await db.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<{
      id: string
      bookingId: string
      status: string
      requestedByUserId: string
      beforeSnapshot: unknown
      afterSnapshot: unknown
      impactSnapshot: unknown
      priceDeltaCents: number | null
      weddingId: string
      businessAccountId: string
      serviceEngagementId: string | null
      bookingStatus: string
      bookingMode: string
      currency: string
      totalCents: number | null
      depositCents: number | null
    }>>(
      `SELECT a.id,a."bookingId",a.status,a."requestedByUserId",a."beforeSnapshot",a."afterSnapshot",a."impactSnapshot",a."priceDeltaCents",
              b."weddingId",b."businessAccountId",b."serviceEngagementId",b.status AS "bookingStatus",b."bookingMode",b.currency,b."totalCents",b."depositCents"
         FROM wewed_booking."BookingAmendment" a
         JOIN wewed_booking."Booking" b ON b.id=a."bookingId"
        WHERE a.id=$1 FOR UPDATE OF a,b`,
      input.amendmentId,
    )
    const amendment = rows[0]
    if (!amendment || amendment.businessAccountId !== business.businessAccountId) throw new BookingCommerceError('Amendment not found.', 404, 'AMENDMENT_NOT_FOUND')
    weddingId = amendment.weddingId
    if (amendment.status !== 'proposed') throw new BookingCommerceError('This amendment is already final.', 409, 'AMENDMENT_FINAL')
    if (amendment.requestedByUserId === input.actorUserId) throw new BookingCommerceError('The requester cannot approve their own amendment.', 403, 'AMENDMENT_SELF_APPROVAL_FORBIDDEN')

    if (input.decision === 'reject') {
      await tx.$executeRawUnsafe(
        `UPDATE wewed_booking."BookingAmendment" SET status='rejected',"decidedByUserId"=$2,"decidedAt"=CURRENT_TIMESTAMP WHERE id=$1`,
        amendment.id,
        input.actorUserId,
      )
      await tx.$executeRawUnsafe(
        `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType",metadata) VALUES ($1,$2,$3,'booking.amendment_rejected',$4::jsonb)`,
        randomUUID(), amendment.bookingId, input.actorUserId, JSON.stringify({ amendmentId: amendment.id }),
      )
      return
    }

    const impact = object(amendment.impactSnapshot)
    if (impact.requiresContractAmendment === true) {
      if (!input.contractAmendmentId) throw new BookingCommerceError('An effective governed Contract Amendment is required before this booking amendment can take effect.', 409, 'CONTRACT_AMENDMENT_REQUIRED')
      const contractRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT ca.id
           FROM wewed_contracts."ContractAmendment" ca
           JOIN public."Contract" c ON c.id=ca."contractId"
          WHERE ca.id=$1 AND ca.status='EFFECTIVE' AND ca."effectiveAt" IS NOT NULL
            AND c."serviceEngagementId"=$2 AND c."weddingId"=$3
          LIMIT 1`,
        input.contractAmendmentId,
        amendment.serviceEngagementId,
        amendment.weddingId,
      )
      if (!contractRows[0]) throw new BookingCommerceError('The linked Contract Amendment is not effective for this Service Engagement.', 409, 'CONTRACT_AMENDMENT_NOT_EFFECTIVE')
    }

    const before = object(amendment.beforeSnapshot)
    const beforeLine = object(before.line)
    const after = object(amendment.afterSnapshot)
    const afterBooking = object(after.booking)
    const afterLine = object(after.line)
    const currentLines = await tx.$queryRawUnsafe<Array<{ id: string; catalogItemId: string; nameSnapshot: string; descriptionSnapshot: string | null }>>(
      `SELECT id,"catalogItemId","nameSnapshot","descriptionSnapshot" FROM wewed_booking."BookingLine"
        WHERE "bookingId"=$1 AND "supersededAt" IS NULL ORDER BY "createdAt" DESC,id DESC LIMIT 1 FOR UPDATE`,
      amendment.bookingId,
    )
    const currentLine = currentLines[0]
    if (!currentLine || currentLine.id !== beforeLine.id) throw new BookingCommerceError('The booking changed after this amendment was proposed. Re-propose from the current booking.', 409, 'AMENDMENT_STALE')

    const variantId = typeof afterLine.variantId === 'string' ? afterLine.variantId : null
    const quantity = Number(afterLine.quantity)
    const selectedAddOns = Array.isArray(object(afterLine.selectedOptions).addOns)
      ? (object(afterLine.selectedOptions).addOns as unknown[]).filter((entry): entry is string => typeof entry === 'string')
      : []
    const price = await calculatePrice({ itemId: currentLine.catalogItemId, variantId, quantity, selectedAddOns })
    const proposedPrice = object(impact.price)
    if (price.currency !== proposedPrice.currency || price.totalCents !== proposedPrice.totalCents || price.depositCents !== proposedPrice.depositCents) {
      throw new BookingCommerceError('Catalogue pricing changed after this amendment was proposed. A fresh amendment is required.', 409, 'AMENDMENT_REQUOTE_REQUIRED')
    }

    const asDate = (value: unknown) => value ? new Date(String(value)) : null
    const eventDate = asDate(afterBooking.eventDate)
    const serviceStart = asDate(afterBooking.serviceStart)
    const serviceEnd = asDate(afterBooking.serviceEnd)
    const appointmentAt = asDate(afterBooking.appointmentAt)
    const pickupAt = asDate(afterBooking.pickupAt)
    const returnDueAt = asDate(afterBooking.returnDueAt)
    const deliveryAt = asDate(afterBooking.deliveryAt)
    const setupStart = asDate(afterBooking.setupStart)
    const setupEnd = asDate(afterBooking.setupEnd)
    const collectionAt = asDate(afterBooking.collectionAt)
    const serviceLocation = typeof afterBooking.serviceLocation === 'string' ? afterBooking.serviceLocation : null
    const window = serviceWindow({ eventDate, serviceStart, serviceEnd, appointmentAt, pickupAt, returnDueAt })

    const availability = await checkDeterministicAvailability({
      itemId: currentLine.catalogItemId,
      variantId,
      quantity,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      serviceLocation,
      selectedAddOns,
      excludeBookingId: amendment.bookingId,
    })
    const allocationRows = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM wewed_booking."BookingResourceAllocation" WHERE "bookingId"=$1 AND state='confirmed'`,
      amendment.bookingId,
    )
    const hadAllocations = Number(allocationRows[0]?.count ?? 0) > 0
    if ((amendment.bookingMode === 'instant' || hadAllocations) && availability.available !== true) {
      throw new BookingCommerceError(`The amended booking is no longer available (${String(availability.reason || 'capacity')}).`, 409, 'AMENDMENT_UNAVAILABLE')
    }

    const itemRows = await tx.$queryRawUnsafe<Array<{ itemName: string; variantName: string | null; description: string | null }>>(
      `SELECT i.name AS "itemName",v.name AS "variantName",i.description
         FROM wewed_booking."ProviderCatalogItem" i
         LEFT JOIN wewed_booking."ProviderCatalogVariant" v ON v.id=$2 AND v."catalogItemId"=i.id
        WHERE i.id=$1 LIMIT 1`,
      currentLine.catalogItemId,
      variantId,
    )
    const item = itemRows[0]
    if (!item) throw new BookingCommerceError('Catalogue item no longer exists.', 409, 'CATALOG_ITEM_NOT_FOUND')
    const newLineId = randomUUID()
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_booking."BookingLine"
       (id,"bookingId","catalogItemId","variantId","nameSnapshot","descriptionSnapshot",quantity,"unitPriceCents","lineTotalCents","pricingSnapshot","selectedOptions","supersedesLineId","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      newLineId,
      amendment.bookingId,
      currentLine.catalogItemId,
      variantId,
      item.variantName ? `${item.itemName} — ${item.variantName}` : item.itemName,
      item.description,
      quantity,
      price.unitPriceCents,
      price.subtotalCents,
      JSON.stringify(price.snapshot),
      JSON.stringify({ addOns: selectedAddOns }),
      currentLine.id,
    )

    await tx.$executeRawUnsafe(`UPDATE wewed_booking."BookingLine" SET "supersededAt"=CURRENT_TIMESTAMP WHERE id=$1`, currentLine.id)
    await tx.$executeRawUnsafe(
      `UPDATE wewed_booking."Booking"
          SET currency=$2,"subtotalCents"=$3,"feesCents"=$4,"depositCents"=$5,"totalCents"=$6,"priceSnapshot"=$7::jsonb,
              "eventDate"=$8,"serviceStart"=$9,"serviceEnd"=$10,"appointmentAt"=$11,"pickupAt"=$12,"returnDueAt"=$13,
              "deliveryAt"=$14,"setupStart"=$15,"setupEnd"=$16,"collectionAt"=$17,"serviceLocation"=$18
        WHERE id=$1`,
      amendment.bookingId,
      price.currency,
      price.subtotalCents,
      price.feesCents ?? 0,
      price.depositCents,
      price.totalCents,
      JSON.stringify(price.snapshot),
      eventDate,
      serviceStart,
      serviceEnd,
      appointmentAt,
      pickupAt,
      returnDueAt,
      deliveryAt,
      setupStart,
      setupEnd,
      collectionAt,
      serviceLocation,
    )

    if (hadAllocations || amendment.bookingMode === 'instant') {
      await tx.$executeRawUnsafe(`UPDATE wewed_booking."BookingResourceAllocation" SET state='cancelled',"updatedAt"=CURRENT_TIMESTAMP WHERE "bookingId"=$1 AND state='confirmed'`, amendment.bookingId)
      await allocateBookingLineDeterministic({
        tx,
        bookingId: amendment.bookingId,
        bookingLineId: newLineId,
        catalogItemId: currentLine.catalogItemId,
        variantId,
        quantity,
        selectedOptions: { addOns: selectedAddOns },
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        state: 'confirmed',
        holdId: null,
        expiresAt: null,
      })
    }

    if (amendment.serviceEngagementId) {
      await tx.$executeRawUnsafe(
        `UPDATE public."ServiceEngagement" SET "agreedAmount"=$2,currency=$3,"serviceDate"=$4,"serviceLocation"=$5,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 AND "weddingId"=$6`,
        amendment.serviceEngagementId,
        price.totalCents == null ? null : price.totalCents / 100,
        price.currency,
        serviceStart ?? appointmentAt ?? eventDate,
        serviceLocation,
        amendment.weddingId,
      )
      if (price.totalCents != null) {
        await tx.$executeRawUnsafe(
          `UPDATE public."BudgetItem" SET "estimatedCost"=$2,currency=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "serviceEngagementId"=$1 AND "weddingId"=$4`,
          amendment.serviceEngagementId,
          price.totalCents / 100,
          price.currency,
          amendment.weddingId,
        )
      }
    }

    if (amendment.priceDeltaCents != null && amendment.priceDeltaCents > 0 && amendment.serviceEngagementId) {
      const sequences = await tx.$queryRawUnsafe<Array<{ next: number }>>(
        `SELECT COALESCE(MAX(sequence),0)+1 AS next FROM wewed_contracts."PaymentMilestone" WHERE "bookingId"=$1`,
        amendment.bookingId,
      )
      await tx.$executeRawUnsafe(
        `INSERT INTO wewed_contracts."PaymentMilestone"
         (id,"serviceEngagementId","weddingId","bookingId","milestoneType",label,description,amount,currency,"dueAt",status,sequence,"proofRequired","createdById")
         VALUES ($1,$2,$3,$4,'CUSTOM','Booking amendment increase',$5,$6,$7,NULL,'PLANNED',$8,true,$9)`,
        randomUUID(), amendment.serviceEngagementId, amendment.weddingId, amendment.bookingId,
        `Additional planned obligation from accepted booking amendment ${amendment.id}. No payment is inferred.`,
        amendment.priceDeltaCents / 100, price.currency, sequences[0]?.next ?? 1, input.actorUserId,
      )
    }

    await tx.$executeRawUnsafe(
      `UPDATE wewed_booking."BookingAmendment"
          SET status='accepted',"contractAmendmentId"=$2,"decidedByUserId"=$3,"decidedAt"=CURRENT_TIMESTAMP,"effectiveAt"=CURRENT_TIMESTAMP
        WHERE id=$1`,
      amendment.id,
      input.contractAmendmentId ?? null,
      input.actorUserId,
    )
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType",metadata)
       VALUES ($1,$2,$3,'booking.amendment_effective',$4::jsonb)`,
      randomUUID(), amendment.bookingId, input.actorUserId,
      JSON.stringify({ amendmentId: amendment.id, contractAmendmentId: input.contractAmendmentId ?? null, newLineId, priceDeltaCents: amendment.priceDeltaCents }),
    )
  })
  return getBookingForWedding((await db.$queryRawUnsafe<Array<{ bookingId: string }>>(`SELECT "bookingId" FROM wewed_booking."BookingAmendment" WHERE id=$1`, input.amendmentId))[0]?.bookingId ?? '', weddingId)
}
