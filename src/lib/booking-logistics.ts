import 'server-only'

import { db } from '@/lib/db'
import { BookingCommerceError, getBookingForWedding } from '@/lib/booking-commerce'

function optionalDate(value: unknown, field: string): Date | null {
  if (value == null || value === '') return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new BookingCommerceError(`Invalid ${field}.`, 400, 'INVALID_LOGISTICS_DATE')
  return date
}

export async function applyBookingDraftLogistics(input: {
  bookingId: string
  weddingId: string
  deliveryAt?: unknown
  setupStart?: unknown
  setupEnd?: unknown
  collectionAt?: unknown
}) {
  const deliveryAt = optionalDate(input.deliveryAt, 'delivery time')
  const setupStart = optionalDate(input.setupStart, 'setup start')
  const setupEnd = optionalDate(input.setupEnd, 'setup end')
  const collectionAt = optionalDate(input.collectionAt, 'collection time')

  if (setupStart && setupEnd && setupEnd <= setupStart) {
    throw new BookingCommerceError('Setup end must be after setup start.', 400, 'INVALID_SETUP_WINDOW')
  }
  if (deliveryAt && setupStart && setupStart < deliveryAt) {
    throw new BookingCommerceError('Setup cannot start before delivery.', 400, 'INVALID_LOGISTICS_SEQUENCE')
  }
  if (setupEnd && collectionAt && collectionAt <= setupEnd) {
    throw new BookingCommerceError('Collection must be after setup is complete.', 400, 'INVALID_LOGISTICS_SEQUENCE')
  }

  const updated = await db.$executeRawUnsafe(
    `UPDATE wewed_booking."Booking"
        SET "deliveryAt"=$3,"setupStart"=$4,"setupEnd"=$5,"collectionAt"=$6
      WHERE id=$1 AND "weddingId"=$2 AND status IN ('draft','held')`,
    input.bookingId,
    input.weddingId,
    deliveryAt,
    setupStart,
    setupEnd,
    collectionAt,
  )
  if (!updated) throw new BookingCommerceError('Booking logistics can only be changed before submission.', 409, 'BOOKING_LOGISTICS_LOCKED')
  return getBookingForWedding(input.bookingId, input.weddingId)
}
