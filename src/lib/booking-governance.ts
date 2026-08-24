import 'server-only'

import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  BookingCommerceError,
  getBookingForWedding,
  providerBusinessForUser,
} from '@/lib/booking-commerce'
import { allocateBookingLineDeterministic } from '@/lib/booking-resource-engine'

type Tx = Prisma.TransactionClient

type BookingMode = 'instant' | 'request' | 'quote' | 'appointment'

type BookingHeader = {
  id: string
  weddingId: string
  status: string
  bookingMode: BookingMode
  businessAccountId: string
  offeringId: string
  customerUserId: string
  createdByUserId: string
  referralLinkId: string | null
  serviceEngagementId: string | null
  publicReference: string
  currency: string
  totalCents: number | null
  depositCents: number | null
  serviceStart: Date | null
  serviceEnd: Date | null
  appointmentAt: Date | null
  pickupAt: Date | null
  deliveryAt: Date | null
  collectionAt: Date | null
  returnDueAt: Date | null
  eventDate: Date | null
  serviceLocation: string | null
}

type BookingLine = {
  id: string
  catalogItemId: string
  variantId: string | null
  quantity: number
  nameSnapshot: string
  selectedOptions: unknown
  holdMinutes: number
  requiresContract: boolean
}

type ProviderFacts = {
  businessAccountId: string
  providerName: string
  category: string
  totalCents: number | null
  currency: string
  serviceDate: Date | null
  serviceLocation: string | null
  customerUserId: string
  publicReference: string
  firstLine: string
  phone: string | null
  publicEmail: string | null
  website: string | null
}

function integerCents(value: unknown, field: string, allowNull = false): number | null {
  if (allowNull && (value == null || value === '')) return null
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new BookingCommerceError(`${field} must be a non-negative amount in cents.`, 400, 'INVALID_MONEY')
  }
  return parsed
}

function cleanText(value: unknown, max = 2000): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function rawServiceWindow(header: BookingHeader) {
  const eventStart = header.eventDate
    ? new Date(`${header.eventDate.toISOString().slice(0, 10)}T00:00:00.000Z`)
    : null
  const eventEnd = header.eventDate
    ? new Date(`${header.eventDate.toISOString().slice(0, 10)}T23:59:59.999Z`)
    : null
  // Keep governed allocation in exact parity with the public availability pre-check.
  // Delivery-only packages/transport must reserve delivery -> collection, not the whole event day.
  const startsAt = header.serviceStart ?? header.appointmentAt ?? header.pickupAt ?? header.deliveryAt ?? eventStart
  const endsAt = header.serviceEnd ?? header.returnDueAt ?? header.collectionAt ?? (header.appointmentAt ? new Date(header.appointmentAt.getTime() + 60 * 60_000) : eventEnd)
  if (!startsAt || !endsAt || endsAt <= startsAt) {
    throw new BookingCommerceError('Choose the booking date/time before reserving availability.', 400, 'BOOKING_WINDOW_REQUIRED')
  }
  return { startsAt, endsAt }
}

async function bookingForUpdate(tx: Tx, bookingId: string, weddingId?: string): Promise<{ header: BookingHeader; lines: BookingLine[] }> {
  const headers = await tx.$queryRawUnsafe<BookingHeader[]>(
    `SELECT id,"weddingId",status,"bookingMode","businessAccountId","offeringId","customerUserId","createdByUserId",
            "referralLinkId","serviceEngagementId","publicReference",currency,"totalCents","depositCents",
            "serviceStart","serviceEnd","appointmentAt","pickupAt","deliveryAt","collectionAt","returnDueAt","eventDate","serviceLocation"
       FROM wewed_booking."Booking"
      WHERE id=$1 AND ($2::text IS NULL OR "weddingId"=$2)
      FOR UPDATE`,
    bookingId,
    weddingId ?? null,
  )
  const header = headers[0]
  if (!header) throw new BookingCommerceError('Booking not found.', 404, 'BOOKING_NOT_FOUND')
  const lines = await tx.$queryRawUnsafe<BookingLine[]>(
    `SELECT l.id,l."catalogItemId",l."variantId",l.quantity,l."nameSnapshot",l."selectedOptions",
            i."holdMinutes",i."requiresContract"
       FROM wewed_booking."BookingLine" l
       JOIN wewed_booking."ProviderCatalogItem" i ON i.id=l."catalogItemId"
      WHERE l."bookingId"=$1 AND l."supersededAt" IS NULL
      ORDER BY l."createdAt",l.id`,
    bookingId,
  )
  if (!lines.length) throw new BookingCommerceError('Booking has no current service lines.', 409, 'BOOKING_LINES_REQUIRED')
  return { header, lines }
}

async function releaseExpiredHolds(tx: Tx, bookingId: string) {
  await tx.$executeRawUnsafe(
    `UPDATE wewed_booking."BookingHold"
        SET status='expired',"releasedAt"=COALESCE("releasedAt",CURRENT_TIMESTAMP)
      WHERE "bookingId"=$1 AND status='active' AND "expiresAt"<=CURRENT_TIMESTAMP`,
    bookingId,
  )
  await tx.$executeRawUnsafe(
    `UPDATE wewed_booking."BookingResourceAllocation"
        SET state='released',"updatedAt"=CURRENT_TIMESTAMP
      WHERE "bookingId"=$1 AND state='hold' AND "expiresAt"<=CURRENT_TIMESTAMP`,
    bookingId,
  )
}

async function allocateLine(
  tx: Tx,
  header: BookingHeader,
  line: BookingLine,
  state: 'hold' | 'confirmed',
  holdId: string | null,
  expiresAt: Date | null,
) {
  const window = rawServiceWindow(header)
  return allocateBookingLineDeterministic({
    tx,
    bookingId: header.id,
    bookingLineId: line.id,
    catalogItemId: line.catalogItemId,
    variantId: line.variantId,
    quantity: line.quantity,
    selectedOptions: line.selectedOptions,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    state,
    holdId,
    expiresAt,
  })
}

async function reserveConfiguredResources(tx: Tx, header: BookingHeader, lines: BookingLine[]) {
  const existing = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*)::bigint AS count
       FROM wewed_booking."BookingResourceAllocation"
      WHERE "bookingId"=$1 AND state='confirmed'`,
    header.id,
  )
  if (Number(existing[0]?.count ?? 0) > 0) return
  for (const line of lines) await allocateLine(tx, header, line, 'confirmed', null, null)
}

async function providerFacts(tx: Tx, bookingId: string, weddingId: string): Promise<ProviderFacts> {
  const rows = await tx.$queryRawUnsafe<ProviderFacts[]>(
    `SELECT b."businessAccountId",p."displayName" AS "providerName",o.category,b."totalCents",b.currency,
            COALESCE(b."serviceStart",b."appointmentAt",b."eventDate"::timestamp) AS "serviceDate",b."serviceLocation",
            b."customerUserId",b."publicReference",
            COALESCE((SELECT l."nameSnapshot" FROM wewed_booking."BookingLine" l WHERE l."bookingId"=b.id AND l."supersededAt" IS NULL ORDER BY l."createdAt" DESC,l.id DESC LIMIT 1),o."displayName") AS "firstLine",
            p.phone,p."publicEmail",p.website
       FROM wewed_booking."Booking" b
       JOIN wewed_admin."ProviderProfile" p ON p."businessAccountId"=b."businessAccountId"
       JOIN wewed_admin."ProviderServiceOffering" o ON o.id=b."offeringId"
      WHERE b.id=$1 AND b."weddingId"=$2 LIMIT 1`,
    bookingId,
    weddingId,
  )
  const row = rows[0]
  if (!row) throw new BookingCommerceError('Booking not found.', 404, 'BOOKING_NOT_FOUND')
  return row
}

async function ensureVendor(tx: Tx, weddingId: string, facts: ProviderFacts) {
  const existing = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM public."Vendor" WHERE "weddingId"=$1 AND lower(name)=lower($2) ORDER BY "createdAt" LIMIT 1`,
    weddingId,
    facts.providerName,
  )
  if (existing[0]) return existing[0].id
  const vendorId = randomUUID()
  await tx.$executeRawUnsafe(
    `INSERT INTO public."Vendor"
     (id,name,category,description,website,phone,contact,email,featured,"contractStatus","paymentStatus","weddingId","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,'pending','unpaid',$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    vendorId,
    facts.providerName,
    facts.category,
    `Marketplace booking ${facts.publicReference}`,
    facts.website,
    facts.phone,
    facts.phone ?? facts.publicEmail,
    facts.publicEmail,
    weddingId,
  )
  return vendorId
}

function templateCategory(category: string) {
  const normalized = category.toLowerCase()
  if (normalized.includes('venue')) return 'venue'
  if (normalized.includes('cater')) return 'caterer'
  if (normalized.includes('photo') && !normalized.includes('booth')) return 'photographer'
  if (normalized.includes('video')) return 'videographer'
  if (normalized.includes('flor')) return 'florist'
  if (normalized === 'dj' || normalized.includes('entertain')) return 'dj'
  if (normalized.includes('decor')) return 'decor'
  if (normalized.includes('transport') || normalized.includes('car')) return 'transport'
  if (normalized.includes('stationery') || normalized.includes('print')) return 'stationery'
  return 'other'
}

async function bootstrapContract(tx: Tx, engagementId: string, bookingId: string, weddingId: string, actorUserId: string, facts: ProviderFacts) {
  const existing = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM public."Contract" WHERE "serviceEngagementId"=$1 AND "weddingId"=$2 ORDER BY "createdAt" DESC LIMIT 1`,
    engagementId,
    weddingId,
  )
  if (existing[0]) return existing[0].id

  const weddingRows = await tx.$queryRawUnsafe<Array<{
    weddingTitle: string
    coupleId: string
    coupleName: string
    coupleUserId: string
    coupleEmail: string | null
    providerOwnerUserId: string | null
  }>>(
    `SELECT w.title AS "weddingTitle",c.id AS "coupleId",
            concat_ws(' & ',NULLIF(c.partner1,''),NULLIF(c.partner2,'')) AS "coupleName",
            c."userId" AS "coupleUserId",cu.email AS "coupleEmail",ba."ownerUserId" AS "providerOwnerUserId"
       FROM public."Wedding" w
       JOIN public."Couple" c ON c.id=w."coupleId"
       LEFT JOIN public."User" cu ON cu.id=c."userId"
       JOIN wewed_admin."BusinessAccount" ba ON ba.id=$2
      WHERE w.id=$1 LIMIT 1`,
    weddingId,
    facts.businessAccountId,
  )
  const wedding = weddingRows[0]
  if (!wedding) throw new BookingCommerceError('Wedding customer record is unavailable.', 409, 'CUSTOMER_RECORD_REQUIRED')

  const category = templateCategory(facts.category)
  const templates = await tx.$queryRawUnsafe<Array<{ id: string; semanticVersion: string; title: string }>>(
    `SELECT id,"semanticVersion",title
       FROM public."ContractTemplate"
      WHERE "serviceCategory"=$1 AND status IN ('active','counsel_approved','internal_review')
      ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'counsel_approved' THEN 1 ELSE 2 END,
               "effectiveFrom" DESC NULLS LAST,"createdAt" DESC
      LIMIT 1`,
    category,
  )
  const template = templates[0]
  if (!template) throw new BookingCommerceError('No Wewed contract template is available for this service.', 409, 'CONTRACT_TEMPLATE_REQUIRED')

  const clientPartyId = randomUUID()
  const providerPartyId = randomUUID()
  await tx.$executeRawUnsafe(
    `INSERT INTO public."EngagementParty"
     (id,"serviceEngagementId","weddingId","partyRole","partyKind","displayName",email,"userId","entityId","authorityBasis","requiredForReview",status,"createdById","updatedAt")
     VALUES ($1,$2,$3,'CLIENT','COUPLE',$4,$5,$6,$7,'wedding_customer_of_record',true,'active',$8,CURRENT_TIMESTAMP)`,
    clientPartyId,
    engagementId,
    weddingId,
    wedding.coupleName || 'Wedding couple',
    wedding.coupleEmail,
    wedding.coupleUserId,
    wedding.coupleId,
    actorUserId,
  )
  await tx.$executeRawUnsafe(
    `INSERT INTO public."EngagementParty"
     (id,"serviceEngagementId","weddingId","partyRole","partyKind","displayName",email,phone,"userId","entityId","authorityBasis","requiredForReview",status,"createdById","updatedAt")
     VALUES ($1,$2,$3,'SERVICE_PROVIDER','VENDOR',$4,$5,$6,$7,$8,'provider_business_account',true,'active',$9,CURRENT_TIMESTAMP)`,
    providerPartyId,
    engagementId,
    weddingId,
    facts.providerName,
    facts.publicEmail,
    facts.phone,
    wedding.providerOwnerUserId,
    facts.businessAccountId,
    actorUserId,
  )

  const contractId = randomUUID()
  const versionId = randomUUID()
  const contractNumberRows = await tx.$queryRawUnsafe<Array<{ number: string }>>(
    `SELECT public.next_wewed_contract_number() AS number`,
  )
  const contractNumber = contractNumberRows[0]?.number
  if (!contractNumber) throw new BookingCommerceError('Unable to allocate a contract number.', 500, 'CONTRACT_NUMBER_FAILED')

  const canonical = {
    source: 'vendor_booking',
    bookingId,
    publicReference: facts.publicReference,
    weddingId,
    weddingTitle: wedding.weddingTitle,
    serviceEngagementId: engagementId,
    provider: { businessAccountId: facts.businessAccountId, name: facts.providerName },
    customer: { coupleId: wedding.coupleId, displayName: wedding.coupleName || 'Wedding couple' },
    service: {
      category: facts.category,
      description: facts.firstLine,
      date: facts.serviceDate?.toISOString() ?? null,
      location: facts.serviceLocation,
    },
    commercial: {
      amountCents: facts.totalCents,
      currency: facts.currency,
    },
    templateId: template.id,
    templateSemanticVersion: template.semanticVersion,
  }
  const renderedHtml = `<article><h1>${escapeHtml(template.title)}</h1><p><strong>Contract:</strong> ${escapeHtml(contractNumber)}</p><p><strong>Wedding:</strong> ${escapeHtml(wedding.weddingTitle)}</p><p><strong>Client:</strong> ${escapeHtml(wedding.coupleName || 'Wedding couple')}</p><p><strong>Service provider:</strong> ${escapeHtml(facts.providerName)}</p><p><strong>Service:</strong> ${escapeHtml(facts.firstLine)}</p><p><strong>Booking reference:</strong> ${escapeHtml(facts.publicReference)}</p><p>This draft is governed by the Wewed contract workflow. Viewing or generating this draft is not acceptance. The issued immutable version and append-only acceptance evidence control effectivity.</p></article>`

  await tx.$executeRawUnsafe(
    `INSERT INTO public."Contract"
     (id,"contractNumber","serviceEngagementId","weddingId","templateId",status,"currentVersionNumber",title,"createdById","updatedAt")
     VALUES ($1,$2,$3,$4,$5,'DRAFT',1,$6,$7,CURRENT_TIMESTAMP)`,
    contractId,
    contractNumber,
    engagementId,
    weddingId,
    template.id,
    `${facts.providerName} — ${facts.firstLine}`,
    actorUserId,
  )
  await tx.$executeRawUnsafe(
    `INSERT INTO public."ContractVersion"
     (id,"contractId","weddingId","versionNumber",status,"templateSemanticVersion","canonicalJson","renderedHtml","createdById","updatedAt")
     VALUES ($1,$2,$3,1,'DRAFT',$4,$5,$6,$7,CURRENT_TIMESTAMP)`,
    versionId,
    contractId,
    weddingId,
    template.semanticVersion,
    JSON.stringify(canonical),
    renderedHtml,
    actorUserId,
  )
  await tx.$executeRawUnsafe(
    `INSERT INTO wewed_contracts."ContractPartyRequirement"
     (id,"contractId","contractVersionId","engagementPartyId","requiredRole",status)
     VALUES ($1,$2,$3,$4,'CLIENT','PENDING'),($5,$2,$3,$6,'SERVICE_PROVIDER','PENDING')
     ON CONFLICT ("contractVersionId","engagementPartyId") DO NOTHING`,
    randomUUID(),
    contractId,
    versionId,
    clientPartyId,
    randomUUID(),
    providerPartyId,
  )
  await tx.$executeRawUnsafe(
    `INSERT INTO public."ContractEvent" (id,"contractId","versionId","eventType","actorId",metadata)
     VALUES ($1,$2,$3,'BOOKING_DRAFT_CREATED',$4,$5)`,
    randomUUID(),
    contractId,
    versionId,
    actorUserId,
    JSON.stringify({ bookingId, publicReference: facts.publicReference }),
  )
  return contractId
}

async function ensureDraftEngagementTx(tx: Tx, bookingId: string, weddingId: string, actorUserId: string, requireContract: boolean) {
  const locked = await tx.$queryRawUnsafe<Array<{ serviceEngagementId: string | null }>>(
    `SELECT "serviceEngagementId" FROM wewed_booking."Booking" WHERE id=$1 AND "weddingId"=$2 FOR UPDATE`,
    bookingId,
    weddingId,
  )
  if (!locked[0]) throw new BookingCommerceError('Booking not found.', 404, 'BOOKING_NOT_FOUND')
  let engagementId = locked[0].serviceEngagementId
  const facts = await providerFacts(tx, bookingId, weddingId)
  if (!engagementId) {
    const vendorId = await ensureVendor(tx, weddingId, facts)
    engagementId = randomUUID()
    await tx.$executeRawUnsafe(
      `INSERT INTO public."ServiceEngagement"
       (id,origin,"recordMode","serviceCategory","serviceDescription","agreedAmount",currency,"serviceDate","serviceLocation",
        "externalAgreementStatus","historicalBasis","recordedById","createdById","weddingId","vendorId","lifecycleStatus","createdAt","updatedAt")
       VALUES ($1,'current','managed_contract',$2,$3,$4,$5,$6,$7,'none',NULL,$8,$8,$9,$10,'draft',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      engagementId,
      facts.category,
      `${facts.firstLine} — ${facts.publicReference}`,
      facts.totalCents == null ? null : facts.totalCents / 100,
      facts.currency,
      facts.serviceDate,
      facts.serviceLocation,
      actorUserId,
      weddingId,
      vendorId,
    )
    await tx.$executeRawUnsafe(
      `UPDATE wewed_booking."Booking" SET "serviceEngagementId"=$2 WHERE id=$1`,
      bookingId,
      engagementId,
    )
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType",metadata)
       VALUES ($1,$2,$3,'booking.engagement_linked',$4::jsonb)`,
      randomUUID(),
      bookingId,
      actorUserId,
      JSON.stringify({ serviceEngagementId: engagementId, lifecycleStatus: 'draft' }),
    )
  }
  if (requireContract) await bootstrapContract(tx, engagementId, bookingId, weddingId, actorUserId, facts)
  return engagementId
}

async function ensureBudgetTx(tx: Tx, bookingId: string, weddingId: string) {
  const rows = await tx.$queryRawUnsafe<Array<{
    serviceEngagementId: string | null
    totalCents: number | null
    currency: string
    category: string
    firstLine: string
    providerName: string
    vendorId: string | null
    publicReference: string
  }>>(
    `SELECT b."serviceEngagementId",b."totalCents",b.currency,o.category,b."publicReference",
            p."displayName" AS "providerName",se."vendorId",
            COALESCE((SELECT l."nameSnapshot" FROM wewed_booking."BookingLine" l WHERE l."bookingId"=b.id AND l."supersededAt" IS NULL ORDER BY l."createdAt" DESC,l.id DESC LIMIT 1),o."displayName") AS "firstLine"
       FROM wewed_booking."Booking" b
       JOIN wewed_admin."ProviderServiceOffering" o ON o.id=b."offeringId"
       JOIN wewed_admin."ProviderProfile" p ON p."businessAccountId"=b."businessAccountId"
       LEFT JOIN public."ServiceEngagement" se ON se.id=b."serviceEngagementId"
      WHERE b.id=$1 AND b."weddingId"=$2 LIMIT 1`,
    bookingId,
    weddingId,
  )
  const booking = rows[0]
  if (!booking?.serviceEngagementId || booking.totalCents == null) return
  const existing = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM public."BudgetItem" WHERE "serviceEngagementId"=$1 LIMIT 1`,
    booking.serviceEngagementId,
  )
  if (existing[0]) return
  await tx.$executeRawUnsafe(
    `INSERT INTO public."BudgetItem"
     (id,category,description,"estimatedCost","actualCost","paidAmount",currency,"vendorId","vendorName",notes,"serviceEngagementId","weddingId","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,NULL,0,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    randomUUID(),
    booking.category,
    booking.firstLine,
    booking.totalCents / 100,
    booking.currency,
    booking.vendorId,
    booking.providerName,
    `Created from booking ${booking.publicReference}. No payment or contribution funding is inferred by booking confirmation.`,
    booking.serviceEngagementId,
    weddingId,
  )
}

async function ensurePaymentMilestonesTx(tx: Tx, header: BookingHeader, engagementId: string, actorUserId: string) {
  if (header.totalCents == null) return
  const scheduleRows = await tx.$queryRawUnsafe<Array<{ availabilityPolicy: unknown; serviceDate: Date | null }>>(
    `SELECT i."availabilityPolicy",COALESCE(b."serviceStart",b."appointmentAt",b."eventDate"::timestamp) AS "serviceDate"
       FROM wewed_booking."Booking" b
       JOIN wewed_booking."BookingLine" l ON l."bookingId"=b.id AND l."supersededAt" IS NULL
       JOIN wewed_booking."ProviderCatalogItem" i ON i.id=l."catalogItemId"
      WHERE b.id=$1 ORDER BY l."createdAt" DESC,l.id DESC LIMIT 1`,
    header.id,
  )
  const policy = scheduleRows[0]?.availabilityPolicy && typeof scheduleRows[0].availabilityPolicy === 'object' && !Array.isArray(scheduleRows[0].availabilityPolicy)
    ? scheduleRows[0].availabilityPolicy as Record<string, unknown>
    : {}
  const serviceDate = scheduleRows[0]?.serviceDate ?? header.serviceStart ?? header.appointmentAt ?? header.eventDate

  if (header.depositCents != null && header.depositCents > 0) {
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_contracts."PaymentMilestone"
       (id,"serviceEngagementId","weddingId","bookingId","milestoneType",label,description,amount,currency,"dueAt",status,sequence,"proofRequired","createdById")
       VALUES ($1,$2,$3,$4,'DEPOSIT','Booking deposit',$5,$6,$7,NULL,'PLANNED',0,true,$8)
       ON CONFLICT ("bookingId","milestoneType",sequence) WHERE "bookingId" IS NOT NULL DO NOTHING`,
      randomUUID(), engagementId, header.weddingId, header.id,
      `Deposit obligation from booking ${header.publicReference}. Payment remains factual evidence in ManagedPaymentRecord.`,
      header.depositCents / 100, header.currency, actorUserId,
    )
  }

  const balanceDueDays = Number(policy.balanceDueDaysBeforeEvent)
  const deposit = header.depositCents ?? 0
  const balanceCents = header.totalCents - deposit
  if (balanceCents > 0 && Number.isInteger(balanceDueDays) && balanceDueDays >= 0 && serviceDate) {
    const dueAt = new Date(serviceDate.getTime() - balanceDueDays * 86_400_000)
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_contracts."PaymentMilestone"
       (id,"serviceEngagementId","weddingId","bookingId","milestoneType",label,description,amount,currency,"dueAt",status,sequence,"proofRequired","createdById")
       VALUES ($1,$2,$3,$4,'PRE_EVENT_BALANCE','Pre-event balance',$5,$6,$7,$8,'PLANNED',1,true,$9)
       ON CONFLICT ("bookingId","milestoneType",sequence) WHERE "bookingId" IS NOT NULL DO NOTHING`,
      randomUUID(), engagementId, header.weddingId, header.id,
      `Balance schedule from verified booking policy for ${header.publicReference}.`,
      balanceCents / 100, header.currency, dueAt, actorUserId,
    )
  }
}

async function depositSatisfiedTx(tx: Tx, bookingId: string) {
  const rows = await tx.$queryRawUnsafe<Array<{ satisfied: boolean }>>(
    `SELECT wewed_booking.booking_deposit_is_satisfied($1) AS satisfied`,
    bookingId,
  )
  return Boolean(rows[0]?.satisfied)
}

async function confirmOrAwaitDepositTx(tx: Tx, header: BookingHeader, engagementId: string, actorUserId: string, eventType: string, fromStatus: string) {
  await ensureBudgetTx(tx, header.id, header.weddingId)
  await ensurePaymentMilestonesTx(tx, header, engagementId, actorUserId)

  if (header.depositCents != null && header.depositCents > 0 && !(await depositSatisfiedTx(tx, header.id))) {
    await tx.$executeRawUnsafe(`UPDATE wewed_booking."Booking" SET status='awaiting_deposit' WHERE id=$1`, header.id)
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType","fromStatus","toStatus",metadata)
       VALUES ($1,$2,$3,'booking.awaiting_deposit',$4,'awaiting_deposit',$5::jsonb)`,
      randomUUID(), header.id, actorUserId, fromStatus,
      JSON.stringify({ serviceEngagementId: engagementId, depositCents: header.depositCents, currency: header.currency }),
    )
    return 'awaiting_deposit'
  }

  await tx.$executeRawUnsafe(
    `UPDATE wewed_booking."Booking"
        SET status='confirmed',"confirmedAt"=COALESCE("confirmedAt",CURRENT_TIMESTAMP)
      WHERE id=$1`,
    header.id,
  )
  await tx.$executeRawUnsafe(
    `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType","fromStatus","toStatus",metadata)
     VALUES ($1,$2,$3,$4,$5,'confirmed','{}'::jsonb)`,
    randomUUID(), header.id, actorUserId, eventType, fromStatus,
  )
  return 'confirmed'
}

async function markConfirmedTx(tx: Tx, header: BookingHeader, actorUserId: string, eventType: string) {
  const requiresContractRows = await tx.$queryRawUnsafe<Array<{ required: boolean }>>(
    `SELECT EXISTS(SELECT 1 FROM wewed_booking."BookingLine" l JOIN wewed_booking."ProviderCatalogItem" i ON i.id=l."catalogItemId" WHERE l."bookingId"=$1 AND l."supersededAt" IS NULL AND i."requiresContract"=true) AS required`,
    header.id,
  )
  const requiresContract = Boolean(requiresContractRows[0]?.required)
  const engagementId = await ensureDraftEngagementTx(tx, header.id, header.weddingId, actorUserId, requiresContract)
  if (requiresContract) {
    const effective = await tx.$queryRawUnsafe<Array<{ effective: boolean }>>(
      `SELECT EXISTS(
         SELECT 1 FROM public."Contract" c
         JOIN wewed_contracts."ContractVersionEffectivity" e ON e."contractId"=c.id
         WHERE c."serviceEngagementId"=$1 AND c."weddingId"=$2 AND c.status IN ('EFFECTIVE','COMPLETED')
       ) AS effective`,
      engagementId,
      header.weddingId,
    )
    if (!effective[0]?.effective) {
      await tx.$executeRawUnsafe(
        `UPDATE wewed_booking."Booking" SET status='awaiting_terms' WHERE id=$1`,
        header.id,
      )
      await tx.$executeRawUnsafe(
        `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType","fromStatus","toStatus",metadata)
         VALUES ($1,$2,$3,'booking.awaiting_terms',$4,'awaiting_terms',$5::jsonb)`,
        randomUUID(), header.id, actorUserId, header.status, JSON.stringify({ serviceEngagementId: engagementId }),
      )
      return 'awaiting_terms'
    }
  }
  return confirmOrAwaitDepositTx(tx, header, engagementId, actorUserId, eventType, header.status)
}

export async function holdBookingGoverned(input: { bookingId: string; weddingId: string; actorUserId: string; idempotencyKey: string }) {
  const idempotencyKey = input.idempotencyKey.trim()
  if (!idempotencyKey) throw new BookingCommerceError('A hold idempotency key is required.', 400, 'IDEMPOTENCY_REQUIRED')
  await db.$transaction(async (tx) => {
    const { header, lines } = await bookingForUpdate(tx, input.bookingId, input.weddingId)
    if (!['draft','held'].includes(header.status)) throw new BookingCommerceError('This booking can no longer be held.', 409, 'INVALID_BOOKING_STATE')
    if (header.bookingMode !== 'instant') throw new BookingCommerceError('This service requires a vendor request rather than an automatic hold.', 409, 'HOLD_NOT_SUPPORTED')
    await releaseExpiredHolds(tx, header.id)
    const existing = await tx.$queryRawUnsafe<Array<{ id: string; bookingId: string; status: string; expiresAt: Date }>>(
      `SELECT id,"bookingId",status,"expiresAt" FROM wewed_booking."BookingHold" WHERE "idempotencyKey"=$1 LIMIT 1`,
      idempotencyKey,
    )
    if (existing[0]) {
      if (existing[0].bookingId !== header.id) {
        throw new BookingCommerceError('This hold idempotency key is already bound to another booking.', 409, 'IDEMPOTENCY_KEY_REUSED')
      }
      if (existing[0].status === 'active' && existing[0].expiresAt > new Date()) return
      throw new BookingCommerceError('This hold attempt has already completed or expired. Use a new idempotency key after checking availability again.', 409, 'IDEMPOTENCY_KEY_EXPIRED')
    }

    await tx.$executeRawUnsafe(
      `UPDATE wewed_booking."BookingResourceAllocation" SET state='released',"updatedAt"=CURRENT_TIMESTAMP WHERE "bookingId"=$1 AND state='hold'`,
      header.id,
    )
    await tx.$executeRawUnsafe(
      `UPDATE wewed_booking."BookingHold" SET status='released',"releasedAt"=COALESCE("releasedAt",CURRENT_TIMESTAMP) WHERE "bookingId"=$1 AND status='active'`,
      header.id,
    )
    const holdMinutes = Math.min(...lines.map((line) => line.holdMinutes))
    const expiresAt = new Date(Date.now() + holdMinutes * 60_000)
    const holdId = randomUUID()
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_booking."BookingHold" (id,"bookingId","idempotencyKey",status,"expiresAt","createdByUserId") VALUES ($1,$2,$3,'active',$4,$5)`,
      holdId, header.id, idempotencyKey, expiresAt, input.actorUserId,
    )
    for (const line of lines) await allocateLine(tx, header, line, 'hold', holdId, expiresAt)
    await tx.$executeRawUnsafe(`UPDATE wewed_booking."Booking" SET status='held' WHERE id=$1`, header.id)
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType","fromStatus","toStatus",metadata)
       VALUES ($1,$2,$3,'booking.held',$4,'held',$5::jsonb)`,
      randomUUID(), header.id, input.actorUserId, header.status, JSON.stringify({ expiresAt: expiresAt.toISOString() }),
    )
  })
  return getBookingForWedding(input.bookingId, input.weddingId)
}

export async function submitBookingGoverned(input: { bookingId: string; weddingId: string; actorUserId: string }) {
  const referral = { current: null as { id: string; next: string } | null }
  await db.$transaction(async (tx) => {
    const { header } = await bookingForUpdate(tx, input.bookingId, input.weddingId)
    if (!['draft','held'].includes(header.status)) throw new BookingCommerceError('This booking has already been submitted.', 409, 'INVALID_BOOKING_STATE')
    if (header.bookingMode === 'quote') {
      await tx.$executeRawUnsafe(`UPDATE wewed_booking."Booking" SET status='quote_requested' WHERE id=$1`, header.id)
      await tx.$executeRawUnsafe(
        `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType","fromStatus","toStatus",metadata) VALUES ($1,$2,$3,'booking.submitted',$4,'quote_requested','{}'::jsonb)`,
        randomUUID(), header.id, input.actorUserId, header.status,
      )
      referral.current = header.referralLinkId ? { id: header.referralLinkId, next: 'booking_requested' } : null
      return
    }
    if (header.bookingMode !== 'instant') {
      await tx.$executeRawUnsafe(`UPDATE wewed_booking."Booking" SET status='requested' WHERE id=$1`, header.id)
      await tx.$executeRawUnsafe(
        `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType","fromStatus","toStatus",metadata) VALUES ($1,$2,$3,'booking.submitted',$4,'requested','{}'::jsonb)`,
        randomUUID(), header.id, input.actorUserId, header.status,
      )
      referral.current = header.referralLinkId ? { id: header.referralLinkId, next: 'booking_requested' } : null
      return
    }
    if (header.totalCents == null) throw new BookingCommerceError('Instant Book requires a deterministic price.', 409, 'PRICE_REQUIRED')
    await releaseExpiredHolds(tx, header.id)
    const holds = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM wewed_booking."BookingHold" WHERE "bookingId"=$1 AND status='active' AND "expiresAt">CURRENT_TIMESTAMP LIMIT 1`,
      header.id,
    )
    if (!holds[0]) throw new BookingCommerceError('Your temporary hold expired. Check availability again.', 409, 'HOLD_EXPIRED')
    await tx.$executeRawUnsafe(`UPDATE wewed_booking."BookingHold" SET status='converted' WHERE id=$1`, holds[0].id)
    await tx.$executeRawUnsafe(
      `UPDATE wewed_booking."BookingResourceAllocation" SET state='confirmed',"expiresAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "bookingId"=$1 AND "holdId"=$2 AND state='hold'`,
      header.id,
      holds[0].id,
    )
    const next = await markConfirmedTx(tx, header, input.actorUserId, 'booking.confirmed')
    referral.current = header.referralLinkId ? { id: header.referralLinkId, next: next === 'confirmed' ? 'booking_confirmed' : 'booking_requested' } : null
  })
  const referralEvent = referral.current
  if (referralEvent) {
    await db.$executeRawUnsafe(
      `INSERT INTO wewed_booking."ReferralEvent" (id,"referralLinkId","bookingId","userId","eventType",metadata)
       VALUES ($1,$2,$3,$4,$5,'{}'::jsonb)`,
      randomUUID(), referralEvent.id, input.bookingId, input.actorUserId, referralEvent.next,
    )
  }
  return getBookingForWedding(input.bookingId, input.weddingId)
}

export async function providerBookingActionGoverned(input: { bookingId: string; actorUserId: string; action: 'approve'|'decline'|'preparing'|'ready'|'in_progress'|'return_due'|'inspection'|'completed' }) {
  const business = await providerBusinessForUser(input.actorUserId)
  let weddingId = ''
  await db.$transaction(async (tx) => {
    const { header, lines } = await bookingForUpdate(tx, input.bookingId)
    weddingId = header.weddingId
    if (header.businessAccountId !== business.businessAccountId) throw new BookingCommerceError('Booking not found.', 404, 'BOOKING_NOT_FOUND')
    if (input.action === 'approve' && header.status === 'quote_requested') {
      throw new BookingCommerceError('Submit a commercial quote for customer acceptance instead of approving a quote request directly.', 409, 'QUOTE_REQUIRED')
    }
    if (input.action === 'decline') {
      if (!['requested','quote_requested','quote_proposed','awaiting_vendor','awaiting_terms'].includes(header.status)) throw new BookingCommerceError(`Cannot decline a ${header.status} booking here.`, 409, 'INVALID_BOOKING_STATE')
      await tx.$executeRawUnsafe(`UPDATE wewed_booking."Booking" SET status='declined' WHERE id=$1`, header.id)
      await tx.$executeRawUnsafe(`UPDATE wewed_booking."BookingResourceAllocation" SET state='cancelled',"updatedAt"=CURRENT_TIMESTAMP WHERE "bookingId"=$1 AND state IN ('hold','confirmed')`, header.id)
      await tx.$executeRawUnsafe(
        `UPDATE wewed_booking."BookingHold" SET status='released',"releasedAt"=COALESCE("releasedAt",CURRENT_TIMESTAMP) WHERE "bookingId"=$1 AND status='active'`,
        header.id,
      )
      await tx.$executeRawUnsafe(
        `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType","fromStatus","toStatus",metadata) VALUES ($1,$2,$3,'vendor.decline',$4,'declined','{}'::jsonb)`,
        randomUUID(), header.id, input.actorUserId, header.status,
      )
      return
    }
    if (input.action === 'approve') {
      if (!['requested','awaiting_vendor'].includes(header.status)) throw new BookingCommerceError(`Cannot approve a ${header.status} booking.`, 409, 'INVALID_BOOKING_STATE')
      await reserveConfiguredResources(tx, header, lines)
      await markConfirmedTx(tx, header, input.actorUserId, 'vendor.approve')
      return
    }
    const allowed: Record<string, string[]> = {
      confirmed: ['preparing','in_progress'],
      preparing: ['ready','in_progress'],
      ready: ['in_progress'],
      in_progress: ['return_due','inspection','completed'],
      return_due: ['inspection','completed'],
      inspection: ['completed'],
    }
    if (!(allowed[header.status] ?? []).includes(input.action)) throw new BookingCommerceError(`Cannot change ${header.status} booking to ${input.action}.`, 409, 'INVALID_BOOKING_STATE')
    await tx.$executeRawUnsafe(
      `UPDATE wewed_booking."Booking" SET status=$2,"completedAt"=CASE WHEN $2='completed' THEN CURRENT_TIMESTAMP ELSE "completedAt" END WHERE id=$1`,
      header.id,
      input.action,
    )
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType","fromStatus","toStatus",metadata) VALUES ($1,$2,$3,$4,$5,$6,'{}'::jsonb)`,
      randomUUID(), header.id, input.actorUserId, `vendor.${input.action}`, header.status, input.action,
    )
  })
  return getBookingForWedding(input.bookingId, weddingId)
}

export async function proposeBookingQuote(input: { bookingId: string; actorUserId: string; currency?: unknown; subtotalCents: unknown; feesCents?: unknown; depositCents?: unknown; notes?: unknown }) {
  const business = await providerBusinessForUser(input.actorUserId)
  let weddingId = ''
  const quoteId = randomUUID()
  await db.$transaction(async (tx) => {
    const { header } = await bookingForUpdate(tx, input.bookingId)
    weddingId = header.weddingId
    if (header.businessAccountId !== business.businessAccountId) throw new BookingCommerceError('Booking not found.', 404, 'BOOKING_NOT_FOUND')
    if (!['quote_requested','quote_proposed'].includes(header.status) || header.bookingMode !== 'quote') throw new BookingCommerceError('This booking is not awaiting a vendor quote.', 409, 'INVALID_BOOKING_STATE')
    const subtotal = integerCents(input.subtotalCents, 'Subtotal') as number
    const fees = integerCents(input.feesCents ?? 0, 'Fees') as number
    const deposit = integerCents(input.depositCents, 'Deposit', true)
    const total = subtotal + fees
    if (deposit != null && deposit > total) throw new BookingCommerceError('Deposit cannot exceed the quote total.', 400, 'INVALID_DEPOSIT')
    const currency = typeof input.currency === 'string' && /^[A-Z]{3}$/.test(input.currency.trim().toUpperCase()) ? input.currency.trim().toUpperCase() : header.currency
    await tx.$executeRawUnsafe(`UPDATE wewed_booking."BookingQuote" SET status='superseded' WHERE "bookingId"=$1 AND status='proposed'`, header.id)
    const snapshot = { source: 'vendor_quote', subtotalCents: subtotal, feesCents: fees, depositCents: deposit, totalCents: total, currency }
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_booking."BookingQuote"
       (id,"bookingId",status,currency,"subtotalCents","feesCents","depositCents","totalCents",snapshot,notes,"proposedByUserId")
       VALUES ($1,$2,'proposed',$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
      quoteId, header.id, currency, subtotal, fees, deposit, total, JSON.stringify(snapshot), cleanText(input.notes), input.actorUserId,
    )
    await tx.$executeRawUnsafe(
      `UPDATE wewed_booking."Booking" SET status='quote_proposed',currency=$2,"subtotalCents"=$3,"feesCents"=$4,"depositCents"=$5,"totalCents"=$6,"priceSnapshot"=$7::jsonb,"acceptedQuoteId"=NULL WHERE id=$1`,
      header.id, currency, subtotal, fees, deposit, total, JSON.stringify(snapshot),
    )
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType","fromStatus","toStatus",metadata)
       VALUES ($1,$2,$3,'vendor.quote_proposed',$4,'quote_proposed',$5::jsonb)`,
      randomUUID(), header.id, input.actorUserId, header.status, JSON.stringify({ quoteId, totalCents: total, currency }),
    )
  })
  return getBookingForWedding(input.bookingId, weddingId)
}

export async function acceptBookingQuote(input: { bookingId: string; weddingId: string; actorUserId: string; quoteId?: string | null }) {
  await db.$transaction(async (tx) => {
    const { header, lines } = await bookingForUpdate(tx, input.bookingId, input.weddingId)
    if (header.status !== 'quote_proposed' || header.bookingMode !== 'quote') throw new BookingCommerceError('This booking has no quote awaiting acceptance.', 409, 'INVALID_BOOKING_STATE')
    const quotes = await tx.$queryRawUnsafe<Array<{ id: string; currency: string; subtotalCents: number; feesCents: number; depositCents: number | null; totalCents: number; snapshot: unknown }>>(
      `SELECT id,currency,"subtotalCents","feesCents","depositCents","totalCents",snapshot
         FROM wewed_booking."BookingQuote"
        WHERE "bookingId"=$1 AND status='proposed' AND ($2::text IS NULL OR id=$2)
        ORDER BY "proposedAt" DESC LIMIT 1 FOR UPDATE`,
      header.id,
      input.quoteId ?? null,
    )
    const quote = quotes[0]
    if (!quote) throw new BookingCommerceError('The selected quote is no longer available.', 409, 'QUOTE_NOT_FOUND')
    await tx.$executeRawUnsafe(
      `UPDATE wewed_booking."BookingQuote" SET status='accepted',"acceptedByUserId"=$2,"acceptedAt"=CURRENT_TIMESTAMP WHERE id=$1`,
      quote.id,
      input.actorUserId,
    )
    await tx.$executeRawUnsafe(
      `UPDATE wewed_booking."Booking" SET "acceptedQuoteId"=$2,currency=$3,"subtotalCents"=$4,"feesCents"=$5,"depositCents"=$6,"totalCents"=$7,"priceSnapshot"=$8::jsonb WHERE id=$1`,
      header.id,
      quote.id,
      quote.currency,
      quote.subtotalCents,
      quote.feesCents,
      quote.depositCents,
      quote.totalCents,
      JSON.stringify(quote.snapshot ?? {}),
    )
    await reserveConfiguredResources(tx, header, lines)
    const refreshed = { ...header, status: 'quote_proposed', currency: quote.currency, totalCents: quote.totalCents, depositCents: quote.depositCents }
    const next = await markConfirmedTx(tx, refreshed, input.actorUserId, 'booking.quote_accepted')
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType","fromStatus","toStatus",metadata)
       VALUES ($1,$2,$3,'booking.quote_accepted','quote_proposed',$4,$5::jsonb)`,
      randomUUID(), header.id, input.actorUserId, next, JSON.stringify({ quoteId: quote.id }),
    )
  })
  return getBookingForWedding(input.bookingId, input.weddingId)
}

export async function syncBookingTerms(input: { bookingId: string; weddingId: string; actorUserId: string }) {
  await db.$transaction(async (tx) => {
    const { header } = await bookingForUpdate(tx, input.bookingId, input.weddingId)
    if (header.status !== 'awaiting_terms' || !header.serviceEngagementId) throw new BookingCommerceError('This booking is not awaiting governed contract terms.', 409, 'INVALID_BOOKING_STATE')
    const effective = await tx.$queryRawUnsafe<Array<{ contractId: string; effectiveAt: Date }>>(
      `SELECT c.id AS "contractId",e."effectiveAt"
         FROM public."Contract" c
         JOIN wewed_contracts."ContractVersionEffectivity" e ON e."contractId"=c.id
        WHERE c."serviceEngagementId"=$1 AND c."weddingId"=$2 AND c.status IN ('EFFECTIVE','COMPLETED')
        ORDER BY e."effectiveAt" DESC LIMIT 1`,
      header.serviceEngagementId,
      header.weddingId,
    )
    const terms = effective[0]
    if (!terms) throw new BookingCommerceError('The required Wewed contract is not yet effective. All required parties must complete the governed acceptance workflow first.', 409, 'CONTRACT_NOT_EFFECTIVE')
    await tx.$executeRawUnsafe(`UPDATE wewed_booking."Booking" SET "termsSatisfiedAt"=$2 WHERE id=$1`, header.id, terms.effectiveAt)
    const next = await confirmOrAwaitDepositTx(tx, header, header.serviceEngagementId, input.actorUserId, 'booking.contract_effective', 'awaiting_terms')
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType","fromStatus","toStatus",metadata)
       VALUES ($1,$2,$3,'booking.contract_effective','awaiting_terms',$4,$5::jsonb)`,
      randomUUID(), header.id, input.actorUserId, next, JSON.stringify({ contractId: terms.contractId, effectiveAt: terms.effectiveAt.toISOString() }),
    )
  })
  return getBookingForWedding(input.bookingId, input.weddingId)
}

export async function syncBookingDeposit(input: { bookingId: string; weddingId: string; actorUserId: string }) {
  await db.$transaction(async (tx) => {
    const { header } = await bookingForUpdate(tx, input.bookingId, input.weddingId)
    if (header.status !== 'awaiting_deposit' || !header.serviceEngagementId) throw new BookingCommerceError('This booking is not awaiting a recorded deposit.', 409, 'INVALID_BOOKING_STATE')
    await ensurePaymentMilestonesTx(tx, header, header.serviceEngagementId, input.actorUserId)
    if (!(await depositSatisfiedTx(tx, header.id))) {
      throw new BookingCommerceError('The required deposit has not yet been satisfied by factual payment evidence.', 409, 'DEPOSIT_NOT_SATISFIED')
    }
    await tx.$executeRawUnsafe(`UPDATE wewed_booking."Booking" SET status='confirmed',"confirmedAt"=COALESCE("confirmedAt",CURRENT_TIMESTAMP) WHERE id=$1`, header.id)
    await ensureBudgetTx(tx, header.id, header.weddingId)
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType","fromStatus","toStatus",metadata)
       VALUES ($1,$2,$3,'booking.deposit_satisfied','awaiting_deposit','confirmed',$4::jsonb)`,
      randomUUID(), header.id, input.actorUserId, JSON.stringify({ depositCents: header.depositCents, currency: header.currency }),
    )
  })
  return getBookingForWedding(input.bookingId, input.weddingId)
}

export async function cancelBookingGoverned(input: { bookingId: string; weddingId: string; actorUserId: string; reason?: unknown }) {
  await db.$transaction(async (tx) => {
    const { header } = await bookingForUpdate(tx, input.bookingId, input.weddingId)
    if (!['draft','held','requested','quote_requested','quote_proposed','awaiting_vendor','awaiting_terms','awaiting_deposit'].includes(header.status)) {
      throw new BookingCommerceError('This booking has reached a governed commercial state. Use the contract amendment/cancellation process instead of silently cancelling it.', 409, 'GOVERNED_CANCELLATION_REQUIRED')
    }
    if (['awaiting_terms','awaiting_deposit'].includes(header.status) && header.serviceEngagementId) {
      const effective = await tx.$queryRawUnsafe<Array<{ effective: boolean }>>(
        `SELECT EXISTS(SELECT 1 FROM public."Contract" c JOIN wewed_contracts."ContractVersionEffectivity" e ON e."contractId"=c.id WHERE c."serviceEngagementId"=$1 AND c."weddingId"=$2) AS effective`,
        header.serviceEngagementId,
        header.weddingId,
      )
      if (effective[0]?.effective) throw new BookingCommerceError('The contract is already effective. Use the governed cancellation/amendment process.', 409, 'GOVERNED_CANCELLATION_REQUIRED')
    }
    await tx.$executeRawUnsafe(`UPDATE wewed_booking."Booking" SET status='cancelled',"cancelledAt"=CURRENT_TIMESTAMP WHERE id=$1`, header.id)
    await tx.$executeRawUnsafe(`UPDATE wewed_booking."BookingResourceAllocation" SET state='cancelled',"updatedAt"=CURRENT_TIMESTAMP WHERE "bookingId"=$1 AND state IN ('hold','confirmed')`, header.id)
    await tx.$executeRawUnsafe(`UPDATE wewed_booking."BookingHold" SET status='released',"releasedAt"=COALESCE("releasedAt",CURRENT_TIMESTAMP) WHERE "bookingId"=$1 AND status='active'`, header.id)
    await tx.$executeRawUnsafe(
      `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType","fromStatus","toStatus",metadata)
       VALUES ($1,$2,$3,'booking.cancelled',$4,'cancelled',$5::jsonb)`,
      randomUUID(), header.id, input.actorUserId, header.status, JSON.stringify({ reason: cleanText(input.reason) }),
    )
  })
  return getBookingForWedding(input.bookingId, input.weddingId)
}

export async function bookingGovernanceSummary(bookingId: string, weddingId: string) {
  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT b.id,b.status,b."acceptedQuoteId",b."termsSatisfiedAt",b."serviceEngagementId",
            q.id AS "quoteId",q.status AS "quoteStatus",q.currency AS "quoteCurrency",q."subtotalCents" AS "quoteSubtotalCents",
            q."feesCents" AS "quoteFeesCents",q."depositCents" AS "quoteDepositCents",q."totalCents" AS "quoteTotalCents",q.notes AS "quoteNotes",q."proposedAt" AS "quoteProposedAt",
            c.id AS "contractId",c."contractNumber",c.status AS "contractStatus",c."currentVersionNumber"
       FROM wewed_booking."Booking" b
       LEFT JOIN LATERAL (
         SELECT * FROM wewed_booking."BookingQuote" x WHERE x."bookingId"=b.id ORDER BY x."proposedAt" DESC LIMIT 1
       ) q ON true
       LEFT JOIN LATERAL (
         SELECT * FROM public."Contract" x WHERE x."serviceEngagementId"=b."serviceEngagementId" AND x."weddingId"=b."weddingId" ORDER BY x."createdAt" DESC LIMIT 1
       ) c ON true
      WHERE b.id=$1 AND b."weddingId"=$2 LIMIT 1`,
    bookingId,
    weddingId,
  )
  if (!rows[0]) throw new BookingCommerceError('Booking not found.', 404, 'BOOKING_NOT_FOUND')
  return rows[0]
}