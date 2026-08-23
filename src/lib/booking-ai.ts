import 'server-only'

import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { BOOKING_MODES, BookingCommerceError, calculatePrice, createBookingDraft } from '@/lib/booking-commerce'
import { holdBookingGoverned, submitBookingGoverned } from '@/lib/booking-governance'
import { applyBookingDraftLogistics } from '@/lib/booking-logistics'

export const AUTO_BOOK_ACTIONS = ['suggest','prepare','hold','request','confirm'] as const
export type AutoBookAction = (typeof AUTO_BOOK_ACTIONS)[number]

const ACTION_RANK = new Map(AUTO_BOOK_ACTIONS.map((action, index) => [action, index]))

function jsonArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function cleanArray(value: unknown, max = 100, itemMax = 160): string[] {
  return Array.from(new Set(jsonArray(value).map((entry) => entry.trim()).filter(Boolean).map((entry) => entry.slice(0, itemMax)))).slice(0, max)
}

function nonNegativeCents(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new BookingCommerceError('AutoBook money limits must be non-negative whole cents.', 400, 'INVALID_AUTOBOOK_LIMIT')
  return parsed
}

function optionalFutureDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new BookingCommerceError('AutoBook expiry is invalid.', 400, 'INVALID_AUTOBOOK_EXPIRY')
  if (date <= new Date()) throw new BookingCommerceError('AutoBook expiry must be in the future.', 400, 'INVALID_AUTOBOOK_EXPIRY')
  return date
}

export async function getAutoBookPolicy(weddingId: string, userId: string) {
  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT id,"weddingId","userId","maxAction","maxPerBookingCents","maxTotalOpenCents","maxDepositCents","allowedCategories",
            "allowedBookingModes","allowedProviderSlugs","allowedRiskClasses","excludedCatalogItemIds",
            "allowNonRefundable","allowHold","allowRequestSubmission","allowInstantConfirmation",
            "allowContractAcceptance","allowPayment","expiresAt","approvedAt","revokedAt","exclusions","isActive","createdAt","updatedAt"
       FROM wewed_booking."AutoBookPolicy"
      WHERE "weddingId"=$1 AND "userId"=$2 LIMIT 1`,
    weddingId,
    userId,
  )
  return rows[0] ?? null
}

export async function saveAutoBookPolicy(input: {
  weddingId: string
  userId: string
  maxAction: unknown
  maxPerBookingCents?: unknown
  maxTotalOpenCents?: unknown
  maxDepositCents?: unknown
  allowedCategories?: unknown
  allowedBookingModes?: unknown
  allowedProviderSlugs?: unknown
  allowedRiskClasses?: unknown
  excludedCatalogItemIds?: unknown
  allowNonRefundable?: unknown
  allowHold?: unknown
  allowRequestSubmission?: unknown
  allowInstantConfirmation?: unknown
  expiresAt?: unknown
  isActive?: unknown
}) {
  const maxAction = typeof input.maxAction === 'string' && AUTO_BOOK_ACTIONS.includes(input.maxAction as AutoBookAction)
    ? input.maxAction as AutoBookAction
    : null
  if (!maxAction) throw new BookingCommerceError('Unsupported AutoBook action boundary.', 400, 'INVALID_AUTOBOOK_ACTION')
  const maxPerBookingCents = nonNegativeCents(input.maxPerBookingCents)
  const maxTotalOpenCents = nonNegativeCents(input.maxTotalOpenCents)
  const maxDepositCents = nonNegativeCents(input.maxDepositCents)
  const allowedCategories = cleanArray(input.allowedCategories)
  const allowedBookingModes = cleanArray(input.allowedBookingModes, 10, 40)
  if (allowedBookingModes.some((mode) => !BOOKING_MODES.includes(mode as (typeof BOOKING_MODES)[number]))) {
    throw new BookingCommerceError('AutoBook contains an unsupported booking mode.', 400, 'INVALID_AUTOBOOK_BOOKING_MODE')
  }
  const allowedProviderSlugs = cleanArray(input.allowedProviderSlugs, 100, 160)
  const allowedRiskClasses = cleanArray(input.allowedRiskClasses, 20, 80)
  const excludedCatalogItemIds = cleanArray(input.excludedCatalogItemIds, 200, 200)
  const allowNonRefundable = input.allowNonRefundable === true
  const allowHold = input.allowHold === true
  const allowRequestSubmission = input.allowRequestSubmission === true
  const allowInstantConfirmation = input.allowInstantConfirmation === true
  const isActive = input.isActive !== false
  const expiresAt = isActive ? optionalFutureDate(input.expiresAt) : null
  const id = randomUUID()
  await db.$executeRawUnsafe(
    `INSERT INTO wewed_booking."AutoBookPolicy"
     (id,"weddingId","userId","maxAction","maxPerBookingCents","maxTotalOpenCents","maxDepositCents","allowedCategories",
      "allowedBookingModes","allowedProviderSlugs","allowedRiskClasses","excludedCatalogItemIds","allowNonRefundable",
      "allowHold","allowRequestSubmission","allowInstantConfirmation","allowContractAcceptance","allowPayment","expiresAt","isActive","approvedAt","revokedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$16,false,false,$17,$18,
             CASE WHEN $18 THEN CURRENT_TIMESTAMP ELSE NULL END,CASE WHEN $18 THEN NULL ELSE CURRENT_TIMESTAMP END)
     ON CONFLICT ("weddingId","userId") DO UPDATE SET
       "maxAction"=EXCLUDED."maxAction",
       "maxPerBookingCents"=EXCLUDED."maxPerBookingCents",
       "maxTotalOpenCents"=EXCLUDED."maxTotalOpenCents",
       "maxDepositCents"=EXCLUDED."maxDepositCents",
       "allowedCategories"=EXCLUDED."allowedCategories",
       "allowedBookingModes"=EXCLUDED."allowedBookingModes",
       "allowedProviderSlugs"=EXCLUDED."allowedProviderSlugs",
       "allowedRiskClasses"=EXCLUDED."allowedRiskClasses",
       "excludedCatalogItemIds"=EXCLUDED."excludedCatalogItemIds",
       "allowNonRefundable"=EXCLUDED."allowNonRefundable",
       "allowHold"=EXCLUDED."allowHold",
       "allowRequestSubmission"=EXCLUDED."allowRequestSubmission",
       "allowInstantConfirmation"=EXCLUDED."allowInstantConfirmation",
       "allowContractAcceptance"=false,
       "allowPayment"=false,
       "expiresAt"=EXCLUDED."expiresAt",
       "isActive"=EXCLUDED."isActive",
       "approvedAt"=CASE WHEN EXCLUDED."isActive" THEN CURRENT_TIMESTAMP ELSE wewed_booking."AutoBookPolicy"."approvedAt" END,
       "revokedAt"=CASE WHEN EXCLUDED."isActive" THEN NULL ELSE CURRENT_TIMESTAMP END`,
    id,
    input.weddingId,
    input.userId,
    maxAction,
    maxPerBookingCents,
    maxTotalOpenCents,
    maxDepositCents,
    JSON.stringify(allowedCategories),
    JSON.stringify(allowedBookingModes),
    JSON.stringify(allowedProviderSlugs),
    JSON.stringify(allowedRiskClasses),
    JSON.stringify(excludedCatalogItemIds),
    allowNonRefundable,
    allowHold,
    allowRequestSubmission,
    allowInstantConfirmation,
    expiresAt,
    isActive,
  )
  return getAutoBookPolicy(input.weddingId, input.userId)
}

type ExecutionInput = {
  weddingId: string
  actorUserId: string
  action: AutoBookAction
  itemId: string
  variantId?: string | null
  quantity?: number
  selectedAddOns?: string[]
  eventDate?: unknown
  serviceStart?: unknown
  serviceEnd?: unknown
  appointmentAt?: unknown
  pickupAt?: unknown
  deliveryAt?: unknown
  setupStart?: unknown
  setupEnd?: unknown
  collectionAt?: unknown
  returnDueAt?: unknown
  serviceLocation?: unknown
  guestCount?: unknown
  notes?: unknown
  referralToken?: string | null
  idempotencyKey?: string | null
}

export async function executeArchitectBookingAction(input: ExecutionInput) {
  const policyRows = await db.$queryRawUnsafe<Array<{
    id: string
    maxAction: AutoBookAction
    maxPerBookingCents: number | null
    maxTotalOpenCents: number | null
    maxDepositCents: number | null
    allowedCategories: unknown
    allowedBookingModes: unknown
    allowedProviderSlugs: unknown
    allowedRiskClasses: unknown
    excludedCatalogItemIds: unknown
    allowNonRefundable: boolean
    allowHold: boolean
    allowRequestSubmission: boolean
    allowInstantConfirmation: boolean
    allowContractAcceptance: boolean
    allowPayment: boolean
    expiresAt: Date | null
    revokedAt: Date | null
    isActive: boolean
  }>>(
    `SELECT id,"maxAction","maxPerBookingCents","maxTotalOpenCents","maxDepositCents","allowedCategories",
            "allowedBookingModes","allowedProviderSlugs","allowedRiskClasses","excludedCatalogItemIds",
            "allowNonRefundable","allowHold","allowRequestSubmission","allowInstantConfirmation",
            "allowContractAcceptance","allowPayment","expiresAt","revokedAt","isActive"
       FROM wewed_booking."AutoBookPolicy"
      WHERE "weddingId"=$1 AND "userId"=$2 LIMIT 1`,
    input.weddingId,
    input.actorUserId,
  )
  const policy = policyRows[0]
  if (!policy?.isActive || policy.revokedAt) throw new BookingCommerceError('AutoBook is not enabled for this wedding and user.', 403, 'AUTOBOOK_DISABLED')
  if (policy.expiresAt && policy.expiresAt <= new Date()) throw new BookingCommerceError('This AutoBook authorization has expired.', 403, 'AUTOBOOK_EXPIRED')
  if (policy.allowContractAcceptance || policy.allowPayment) {
    throw new BookingCommerceError('Unsafe AutoBook policy detected. AI contract acceptance and payment are prohibited.', 409, 'AUTOBOOK_UNSAFE_POLICY')
  }
  const requestedRank = ACTION_RANK.get(input.action) ?? 999
  const policyRank = ACTION_RANK.get(policy.maxAction) ?? -1
  if (requestedRank > policyRank) throw new BookingCommerceError(`AutoBook policy permits actions only through ${policy.maxAction}.`, 403, 'AUTOBOOK_ACTION_NOT_ALLOWED')
  if (input.action === 'suggest') {
    return { action: 'suggest', executed: false, message: 'Suggestion-only policy does not create a booking record.' }
  }

  const catalogRows = await db.$queryRawUnsafe<Array<{
    category: string
    bookingMode: string
    providerSlug: string
    riskClass: string
    nonRefundable: boolean
  }>>(
    `SELECT o.category,i."bookingMode",p.slug AS "providerSlug",
            COALESCE(NULLIF(i.attributes->>'riskClass',''),NULLIF(i."availabilityPolicy"->>'riskClass',''),'standard') AS "riskClass",
            COALESCE((i.attributes->>'nonRefundable')::boolean,(i."availabilityPolicy"->>'nonRefundable')::boolean,false) AS "nonRefundable"
       FROM wewed_booking."ProviderCatalogItem" i
       JOIN wewed_admin."ProviderServiceOffering" o ON o.id=i."offeringId"
       JOIN wewed_admin."ProviderProfile" p ON p."businessAccountId"=o."businessAccountId"
      WHERE i.id=$1 AND i.status='published' AND o.status='published' LIMIT 1`,
    input.itemId,
  )
  const catalog = catalogRows[0]
  if (!catalog) throw new BookingCommerceError('This catalogue item is not available to AutoBook.', 404, 'CATALOG_ITEM_NOT_FOUND')

  const allowedCategories = jsonArray(policy.allowedCategories)
  if (allowedCategories.length && !allowedCategories.includes(catalog.category)) {
    throw new BookingCommerceError('This service category is outside the configured AutoBook policy.', 403, 'AUTOBOOK_CATEGORY_NOT_ALLOWED')
  }
  const allowedModes = jsonArray(policy.allowedBookingModes)
  if (allowedModes.length && !allowedModes.includes(catalog.bookingMode)) {
    throw new BookingCommerceError('This booking mode is outside the configured AutoBook policy.', 403, 'AUTOBOOK_MODE_NOT_ALLOWED')
  }
  const allowedProviders = jsonArray(policy.allowedProviderSlugs)
  if (allowedProviders.length && !allowedProviders.includes(catalog.providerSlug)) {
    throw new BookingCommerceError('This provider is outside the configured AutoBook policy.', 403, 'AUTOBOOK_PROVIDER_NOT_ALLOWED')
  }
  const allowedRiskClasses = jsonArray(policy.allowedRiskClasses)
  if (allowedRiskClasses.length && !allowedRiskClasses.includes(catalog.riskClass)) {
    throw new BookingCommerceError('This service risk class is outside the configured AutoBook policy.', 403, 'AUTOBOOK_RISK_NOT_ALLOWED')
  }
  if (jsonArray(policy.excludedCatalogItemIds).includes(input.itemId)) {
    throw new BookingCommerceError('This catalogue item is explicitly excluded from AutoBook.', 403, 'AUTOBOOK_ITEM_EXCLUDED')
  }
  if (catalog.nonRefundable && !policy.allowNonRefundable) {
    throw new BookingCommerceError('This item is marked non-refundable and the AutoBook policy does not allow that risk.', 403, 'AUTOBOOK_NONREFUNDABLE_BLOCKED')
  }
  if (input.action === 'hold' && !policy.allowHold) {
    throw new BookingCommerceError('AutoBook is not authorized to place inventory holds.', 403, 'AUTOBOOK_HOLD_NOT_AUTHORIZED')
  }
  if ((input.action === 'request' || (input.action === 'confirm' && catalog.bookingMode !== 'instant')) && !policy.allowRequestSubmission) {
    throw new BookingCommerceError('AutoBook is not authorized to submit booking or quote requests.', 403, 'AUTOBOOK_REQUEST_NOT_AUTHORIZED')
  }
  if (input.action === 'confirm' && catalog.bookingMode === 'instant' && !policy.allowInstantConfirmation) {
    throw new BookingCommerceError('AutoBook is not authorized to confirm Instant Book commitments.', 403, 'AUTOBOOK_CONFIRM_NOT_AUTHORIZED')
  }
  if ((input.action === 'hold' || input.action === 'request' || input.action === 'confirm') && catalog.bookingMode === 'instant' && !policy.allowHold) {
    throw new BookingCommerceError('Instant Book execution requires explicit hold authorization.', 403, 'AUTOBOOK_HOLD_NOT_AUTHORIZED')
  }
  if (input.action === 'hold' && catalog.bookingMode !== 'instant') {
    throw new BookingCommerceError('This service does not support automatic inventory holds. AutoBook can prepare or request it instead.', 409, 'AUTOBOOK_HOLD_NOT_SUPPORTED')
  }

  const price = await calculatePrice({
    itemId: input.itemId,
    variantId: input.variantId ?? null,
    quantity: input.quantity,
    selectedAddOns: input.selectedAddOns,
  })
  if (price.totalCents != null && policy.maxPerBookingCents != null && price.totalCents > policy.maxPerBookingCents) {
    throw new BookingCommerceError('This booking exceeds the AutoBook per-booking spending boundary.', 403, 'AUTOBOOK_PER_BOOKING_LIMIT')
  }
  if (price.depositCents != null && policy.maxDepositCents != null && price.depositCents > policy.maxDepositCents) {
    throw new BookingCommerceError('This booking exceeds the AutoBook deposit boundary.', 403, 'AUTOBOOK_DEPOSIT_LIMIT')
  }
  if (price.totalCents != null && policy.maxTotalOpenCents != null) {
    const totals = await db.$queryRawUnsafe<Array<{ total: bigint }>>(
      `SELECT COALESCE(SUM("totalCents"),0)::bigint AS total
         FROM wewed_booking."Booking"
        WHERE "weddingId"=$1 AND status NOT IN ('completed','declined','expired','cancelled','refunded')`,
      input.weddingId,
    )
    if (Number(totals[0]?.total ?? 0) + price.totalCents > policy.maxTotalOpenCents) {
      throw new BookingCommerceError('This booking would exceed the AutoBook open-commitment boundary.', 403, 'AUTOBOOK_TOTAL_LIMIT')
    }
  }

  const customerRows = await db.$queryRawUnsafe<Array<{ userId: string | null }>>(
    `SELECT c."userId" AS "userId" FROM public."Wedding" w JOIN public."Couple" c ON c.id=w."coupleId" WHERE w.id=$1 LIMIT 1`,
    input.weddingId,
  )
  const customerUserId = customerRows[0]?.userId
  if (!customerUserId) throw new BookingCommerceError('Wedding customer-of-record is unavailable.', 409, 'CUSTOMER_RECORD_REQUIRED')

  let booking = await createBookingDraft({
    weddingId: input.weddingId,
    actorUserId: input.actorUserId,
    customerUserId,
    itemId: input.itemId,
    variantId: input.variantId ?? null,
    quantity: input.quantity,
    selectedAddOns: input.selectedAddOns,
    eventDate: input.eventDate,
    serviceStart: input.serviceStart,
    serviceEnd: input.serviceEnd,
    appointmentAt: input.appointmentAt,
    pickupAt: input.pickupAt,
    returnDueAt: input.returnDueAt,
    serviceLocation: input.serviceLocation,
    guestCount: input.guestCount,
    notes: input.notes,
    referralToken: input.referralToken,
  })
  const bookingId = String(booking.id)
  if (input.deliveryAt || input.setupStart || input.setupEnd || input.collectionAt) {
    booking = await applyBookingDraftLogistics({
      bookingId,
      weddingId: input.weddingId,
      deliveryAt: input.deliveryAt,
      setupStart: input.setupStart,
      setupEnd: input.setupEnd,
      collectionAt: input.collectionAt,
    })
  }

  if ((input.action === 'hold' || input.action === 'request' || input.action === 'confirm') && catalog.bookingMode === 'instant') {
    booking = await holdBookingGoverned({
      bookingId,
      weddingId: input.weddingId,
      actorUserId: input.actorUserId,
      idempotencyKey: input.idempotencyKey?.trim() || `ai:${policy.id}:${randomUUID()}`,
    })
  }

  let boundary: string | null = null
  if (input.action === 'request' && catalog.bookingMode === 'instant') {
    // Level-4 request authority must never accidentally become Level-5 commercial confirmation.
    // Instant Book has no vendor-request state, so request authority stops safely at the hold.
    boundary = 'Instant Book is held only. Explicit Instant Book confirmation authority is required to confirm the commitment.'
  } else if (input.action === 'request' || input.action === 'confirm') {
    booking = await submitBookingGoverned({ bookingId, weddingId: input.weddingId, actorUserId: input.actorUserId })
  }

  await db.$executeRawUnsafe(
    `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType",metadata)
     VALUES ($1,$2,$3,'ai.booking_action',$4::jsonb)`,
    randomUUID(),
    bookingId,
    input.actorUserId,
    JSON.stringify({
      action: input.action,
      policyId: policy.id,
      maxAction: policy.maxAction,
      bookingMode: catalog.bookingMode,
      providerSlug: catalog.providerSlug,
      riskClass: catalog.riskClass,
      contractAcceptance: false,
      payment: false,
    }),
  )

  if (!boundary && input.action === 'confirm' && String(booking.status) === 'awaiting_terms') {
    boundary = 'Human contract acceptance is still required. AI cannot cross this boundary.'
  }

  return {
    action: input.action,
    executed: true,
    booking,
    policy: {
      id: policy.id,
      maxAction: policy.maxAction,
      contractAcceptanceAllowed: false,
      paymentAllowed: false,
    },
    boundary,
  }
}
