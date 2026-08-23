import 'server-only'

import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { BookingCommerceError, calculatePrice, createBookingDraft } from '@/lib/booking-commerce'
import { holdBookingGoverned, submitBookingGoverned } from '@/lib/booking-governance'

export const AUTO_BOOK_ACTIONS = ['suggest','prepare','hold','request','confirm'] as const
export type AutoBookAction = (typeof AUTO_BOOK_ACTIONS)[number]

const ACTION_RANK = new Map(AUTO_BOOK_ACTIONS.map((action, index) => [action, index]))

function jsonArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function nonNegativeCents(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new BookingCommerceError('AutoBook money limits must be non-negative whole cents.', 400, 'INVALID_AUTOBOOK_LIMIT')
  return parsed
}

export async function getAutoBookPolicy(weddingId: string, userId: string) {
  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT id,"weddingId","userId","maxAction","maxPerBookingCents","maxTotalOpenCents","allowedCategories",
            "allowNonRefundable","allowContractAcceptance","allowPayment","isActive","createdAt","updatedAt"
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
  allowedCategories?: unknown
  allowNonRefundable?: unknown
  isActive?: unknown
}) {
  const maxAction = typeof input.maxAction === 'string' && AUTO_BOOK_ACTIONS.includes(input.maxAction as AutoBookAction)
    ? input.maxAction as AutoBookAction
    : null
  if (!maxAction) throw new BookingCommerceError('Unsupported AutoBook action boundary.', 400, 'INVALID_AUTOBOOK_ACTION')
  const maxPerBookingCents = nonNegativeCents(input.maxPerBookingCents)
  const maxTotalOpenCents = nonNegativeCents(input.maxTotalOpenCents)
  const allowedCategories = jsonArray(input.allowedCategories).map((entry) => entry.trim()).filter(Boolean).slice(0, 100)
  const allowNonRefundable = input.allowNonRefundable === true
  const isActive = input.isActive !== false
  const id = randomUUID()
  await db.$executeRawUnsafe(
    `INSERT INTO wewed_booking."AutoBookPolicy"
     (id,"weddingId","userId","maxAction","maxPerBookingCents","maxTotalOpenCents","allowedCategories","allowNonRefundable","allowContractAcceptance","allowPayment","isActive")
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,false,false,$9)
     ON CONFLICT ("weddingId","userId") DO UPDATE SET
       "maxAction"=EXCLUDED."maxAction",
       "maxPerBookingCents"=EXCLUDED."maxPerBookingCents",
       "maxTotalOpenCents"=EXCLUDED."maxTotalOpenCents",
       "allowedCategories"=EXCLUDED."allowedCategories",
       "allowNonRefundable"=EXCLUDED."allowNonRefundable",
       "allowContractAcceptance"=false,
       "allowPayment"=false,
       "isActive"=EXCLUDED."isActive"`,
    id,
    input.weddingId,
    input.userId,
    maxAction,
    maxPerBookingCents,
    maxTotalOpenCents,
    JSON.stringify(allowedCategories),
    allowNonRefundable,
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
    allowedCategories: unknown
    allowNonRefundable: boolean
    allowContractAcceptance: boolean
    allowPayment: boolean
    isActive: boolean
  }>>(
    `SELECT id,"maxAction","maxPerBookingCents","maxTotalOpenCents","allowedCategories","allowNonRefundable","allowContractAcceptance","allowPayment","isActive"
       FROM wewed_booking."AutoBookPolicy"
      WHERE "weddingId"=$1 AND "userId"=$2 LIMIT 1`,
    input.weddingId,
    input.actorUserId,
  )
  const policy = policyRows[0]
  if (!policy?.isActive) throw new BookingCommerceError('AutoBook is not enabled for this wedding and user.', 403, 'AUTOBOOK_DISABLED')
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
    nonRefundable: boolean
  }>>(
    `SELECT o.category,i."bookingMode",
            COALESCE((i.attributes->>'nonRefundable')::boolean,(i."availabilityPolicy"->>'nonRefundable')::boolean,false) AS "nonRefundable"
       FROM wewed_booking."ProviderCatalogItem" i
       JOIN wewed_admin."ProviderServiceOffering" o ON o.id=i."offeringId"
      WHERE i.id=$1 AND i.status='published' AND o.status='published' LIMIT 1`,
    input.itemId,
  )
  const catalog = catalogRows[0]
  if (!catalog) throw new BookingCommerceError('This catalogue item is not available to AutoBook.', 404, 'CATALOG_ITEM_NOT_FOUND')
  const allowedCategories = jsonArray(policy.allowedCategories)
  if (allowedCategories.length && !allowedCategories.includes(catalog.category)) {
    throw new BookingCommerceError('This service category is outside the configured AutoBook policy.', 403, 'AUTOBOOK_CATEGORY_NOT_ALLOWED')
  }
  if (catalog.nonRefundable && !policy.allowNonRefundable) {
    throw new BookingCommerceError('This item is marked non-refundable and the AutoBook policy does not allow that risk.', 403, 'AUTOBOOK_NONREFUNDABLE_BLOCKED')
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

  if (input.action === 'hold' || input.action === 'request' || input.action === 'confirm') {
    if (catalog.bookingMode === 'instant') {
      booking = await holdBookingGoverned({
        bookingId,
        weddingId: input.weddingId,
        actorUserId: input.actorUserId,
        idempotencyKey: input.idempotencyKey?.trim() || `ai:${policy.id}:${randomUUID()}`,
      })
    } else if (input.action === 'hold') {
      throw new BookingCommerceError('This service does not support automatic inventory holds. AutoBook can prepare or request it instead.', 409, 'AUTOBOOK_HOLD_NOT_SUPPORTED')
    }
  }

  if (input.action === 'request' || input.action === 'confirm') {
    booking = await submitBookingGoverned({ bookingId, weddingId: input.weddingId, actorUserId: input.actorUserId })
  }

  await db.$executeRawUnsafe(
    `INSERT INTO wewed_booking."BookingEvent" (id,"bookingId","actorUserId","eventType",metadata)
     VALUES ($1,$2,$3,'ai.booking_action',$4::jsonb)`,
    randomUUID(),
    bookingId,
    input.actorUserId,
    JSON.stringify({ action: input.action, policyId: policy.id, maxAction: policy.maxAction, contractAcceptance: false, payment: false }),
  )

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
    boundary: input.action === 'confirm' && String(booking.status) === 'awaiting_terms'
      ? 'Human contract acceptance is still required. AI cannot cross this boundary.'
      : null,
  }
}
