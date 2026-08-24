import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { providerBusinessForUser } from '@/lib/booking-commerce'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const CONFIRMED_STATUSES = ['confirmed','preparing','ready','in_progress','return_due','inspection','completed']

export async function GET(request: NextRequest) {
  const session = readAppSession(request)
  if (!session || session.role !== 'vendor') return NextResponse.json({ success: false, error: 'Vendor sign-in required.' }, { status: 401 })
  try {
    const business = await providerBusinessForUser(session.userId)
    const [bookingRows, referralRows, itemRows, linkRows, operationsRows] = await Promise.all([
      db.$queryRawUnsafe<Array<{ status: string; count: bigint; valueCents: bigint }>>(
        `SELECT status,count(*)::bigint AS count,COALESCE(SUM("totalCents"),0)::bigint AS "valueCents"
           FROM wewed_booking."Booking"
          WHERE "businessAccountId"=$1
          GROUP BY status ORDER BY count(*) DESC`,
        business.businessAccountId,
      ),
      db.$queryRawUnsafe<Array<{ eventType: string; count: bigint }>>(
        `SELECT re."eventType",count(*)::bigint AS count
           FROM wewed_booking."ReferralEvent" re
           JOIN wewed_booking."ReferralLink" rl ON rl.id=re."referralLinkId"
          WHERE rl."businessAccountId"=$1
          GROUP BY re."eventType"`,
        business.businessAccountId,
      ),
      db.$queryRawUnsafe<Array<{ catalogItemId: string; name: string; starts: bigint; confirmed: bigint; valueCents: bigint }>>(
        `WITH item_bookings AS (
           SELECT DISTINCT i.id AS "catalogItemId",i.name,b.id AS "bookingId",b.status,b."totalCents"
             FROM wewed_booking."ProviderCatalogItem" i
             JOIN wewed_admin."ProviderServiceOffering" o ON o.id=i."offeringId"
             LEFT JOIN wewed_booking."BookingLine" bl ON bl."catalogItemId"=i.id AND bl."supersededAt" IS NULL
             LEFT JOIN wewed_booking."Booking" b ON b.id=bl."bookingId"
            WHERE o."businessAccountId"=$1
         )
         SELECT "catalogItemId",name,
                count("bookingId")::bigint AS starts,
                count("bookingId") FILTER (WHERE status=ANY($2::text[]))::bigint AS confirmed,
                COALESCE(SUM(CASE WHEN status=ANY($2::text[]) THEN "totalCents" ELSE 0 END),0)::bigint AS "valueCents"
           FROM item_bookings
          GROUP BY "catalogItemId",name
          ORDER BY confirmed DESC,starts DESC,name
          LIMIT 20`,
        business.businessAccountId,
        CONFIRMED_STATUSES,
      ),
      db.$queryRawUnsafe<Array<{ id: string; token: string; channel: string | null; campaign: string | null; catalogItemId: string | null; isActive: boolean; opens: bigint; starts: bigint; confirmed: bigint }>>(
        `SELECT rl.id,rl.token,rl.channel,rl.campaign,rl."catalogItemId",rl."isActive",
                count(re.id) FILTER (WHERE re."eventType"='open')::bigint AS opens,
                count(re.id) FILTER (WHERE re."eventType"='booking_started')::bigint AS starts,
                count(re.id) FILTER (WHERE re."eventType"='booking_confirmed')::bigint AS confirmed
           FROM wewed_booking."ReferralLink" rl
           LEFT JOIN wewed_booking."ReferralEvent" re ON re."referralLinkId"=rl.id
          WHERE rl."businessAccountId"=$1
          GROUP BY rl.id,rl.token,rl.channel,rl.campaign,rl."catalogItemId",rl."isActive"
          ORDER BY opens DESC,rl."createdAt" DESC
          LIMIT 50`,
        business.businessAccountId,
      ),
      db.$queryRawUnsafe<Array<{
        confirmed: bigint
        completed: bigint
        cancelled: bigint
        disputed: bigint
        averageLeadDays: number | null
        averageValueCents: number | null
        allocatedResourceMinutes: bigint
        capacityMinutes: bigint
      }>>(
        `WITH booking_metrics AS (
           SELECT count(*) FILTER (WHERE status=ANY($2::text[]))::bigint AS confirmed,
                  count(*) FILTER (WHERE status='completed')::bigint AS completed,
                  count(*) FILTER (WHERE status='cancelled')::bigint AS cancelled,
                  count(*) FILTER (WHERE status='disputed')::bigint AS disputed,
                  avg(EXTRACT(EPOCH FROM (COALESCE("serviceStart","appointmentAt","eventDate"::timestamp)-"createdAt"))/86400.0)
                    FILTER (WHERE COALESCE("serviceStart","appointmentAt","eventDate"::timestamp) IS NOT NULL) AS "averageLeadDays",
                  avg("totalCents") FILTER (WHERE status=ANY($2::text[]) AND "totalCents" IS NOT NULL) AS "averageValueCents"
             FROM wewed_booking."Booking"
            WHERE "businessAccountId"=$1
         ), allocation_metrics AS (
           SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (a."endsAt"-a."startsAt"))/60.0 * a.quantity),0)::bigint AS "allocatedResourceMinutes",
                  COALESCE(SUM(EXTRACT(EPOCH FROM (a."endsAt"-a."startsAt"))/60.0 * r.capacity),0)::bigint AS "capacityMinutes"
             FROM wewed_booking."BookingResourceAllocation" a
             JOIN wewed_booking."BookingResource" r ON r.id=a."resourceId"
             JOIN wewed_booking."ProviderCatalogItem" i ON i.id=r."catalogItemId"
             JOIN wewed_admin."ProviderServiceOffering" o ON o.id=i."offeringId"
            WHERE o."businessAccountId"=$1 AND a.state='confirmed'
         )
         SELECT * FROM booking_metrics CROSS JOIN allocation_metrics`,
        business.businessAccountId,
        CONFIRMED_STATUSES,
      ),
    ])

    const bookingByStatus = Object.fromEntries(bookingRows.map((row) => [row.status, { count: Number(row.count), valueCents: Number(row.valueCents) }]))
    const referralEvents = Object.fromEntries(referralRows.map((row) => [row.eventType, Number(row.count)]))
    const starts = bookingRows.reduce((sum, row) => sum + Number(row.count), 0)
    const confirmedStatuses = new Set(CONFIRMED_STATUSES)
    const confirmed = bookingRows.filter((row) => confirmedStatuses.has(row.status)).reduce((sum, row) => sum + Number(row.count), 0)
    const confirmedValueCents = bookingRows.filter((row) => confirmedStatuses.has(row.status)).reduce((sum, row) => sum + Number(row.valueCents), 0)
    const operations = operationsRows[0]
    const capacityMinutes = Number(operations?.capacityMinutes ?? 0)
    const allocatedResourceMinutes = Number(operations?.allocatedResourceMinutes ?? 0)

    return NextResponse.json({
      success: true,
      data: {
        business: { id: business.businessAccountId, name: business.businessName },
        totals: {
          bookingsStarted: starts,
          bookingsConfirmed: confirmed,
          bookingConversionRate: starts > 0 ? confirmed / starts : 0,
          confirmedValueCents,
          referralOpens: referralEvents.open ?? 0,
          referralBookingStarts: referralEvents.booking_started ?? 0,
          referralConfirmed: referralEvents.booking_confirmed ?? 0,
          completed: Number(operations?.completed ?? 0),
          cancelled: Number(operations?.cancelled ?? 0),
          disputed: Number(operations?.disputed ?? 0),
          averageLeadDays: operations?.averageLeadDays == null ? null : Number(operations.averageLeadDays),
          averageValueCents: operations?.averageValueCents == null ? null : Number(operations.averageValueCents),
          resourceUtilization: capacityMinutes > 0 ? allocatedResourceMinutes / capacityMinutes : null,
        },
        bookingsByStatus: bookingByStatus,
        referralEvents,
        catalogItems: itemRows.map((row) => ({ ...row, starts: Number(row.starts), confirmed: Number(row.confirmed), valueCents: Number(row.valueCents) })),
        referralLinks: linkRows.map((row) => ({ ...row, opens: Number(row.opens), starts: Number(row.starts), confirmed: Number(row.confirmed), path: `/r/${row.token}` })),
      },
    })
  } catch (error) {
    console.error('[VENDOR BOOKING ANALYTICS GET] error:', error)
    return NextResponse.json({ success: false, error: 'Unable to load booking analytics.' }, { status: 500 })
  }
}