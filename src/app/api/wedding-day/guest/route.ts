import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readWeddingDayGuestContext } from '@/lib/wedding-day'
import { loadPublishedAnnouncements } from '@/lib/wedding-site/server'

export const dynamic = 'force-dynamic'

type GuestDayRow = {
  guestId: string
  guestName: string
  tableNumber: number | null
  tableName: string | null
  checkedIn: boolean | null
  attending: boolean | null
  plusOne: boolean | null
  plusOneName: string | null
  kidsAttending: boolean | null
  kidsCount: number | null
}

export async function GET(request: NextRequest) {
  const context = await readWeddingDayGuestContext(request)
  if (!context) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized guest session.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }

  const guestRows = await db.$queryRawUnsafe<GuestDayRow[]>(
    `SELECT g.id AS "guestId",
            g.name AS "guestName",
            g."tableNumber",
            st.name AS "tableName",
            r."checkedIn",
            r.attending,
            r."plusOne",
            r."plusOneName",
            r."kidsAttending",
            r."kidsCount"
       FROM public."Guest" g
       LEFT JOIN public."RSVP" r ON r."guestId" = g.id
       LEFT JOIN public."SeatingTable" st ON st.id = g."seatingTableId"
      WHERE g.id = $1 AND g."weddingId" = $2
      LIMIT 1`,
    context.guestId,
    context.weddingId,
  )
  const guest = guestRows[0]
  if (!guest) {
    return NextResponse.json(
      { success: false, error: 'Guest record not found.' },
      { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }

  const programme = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT id, time, title, description, location, "order"
       FROM public."ProgrammeItem"
      WHERE "weddingId" = $1
      ORDER BY "order" ASC, id ASC`,
    context.weddingId,
  )

  const announcements = await loadPublishedAnnouncements(context.weddingId, {
    includeAttendingOnly: guest.attending === true,
  })

  const household: Array<{
    attendeeKey: string
    attendeeName: string
  }> = [
    { attendeeKey: 'primary', attendeeName: guest.guestName },
  ]

  if (guest.plusOne) {
    household.push({
      attendeeKey: 'plus-one',
      attendeeName: guest.plusOneName?.trim() || 'Plus One',
    })
  }

  if (guest.kidsAttending && (guest.kidsCount ?? 0) > 0) {
    for (let index = 1; index <= (guest.kidsCount ?? 0); index += 1) {
      household.push({
        attendeeKey: `child-${index}`,
        attendeeName: `Child ${index}`,
      })
    }
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        guest: {
          id: guest.guestId,
          tableNumber: guest.tableNumber,
          tableName: guest.tableName,
          checkedIn: guest.checkedIn === true,
          household,
        },
        programme,
        // QRO07: the same published WeddingAnnouncement projection the website shows. Notices for
        // attending guests only reach a guest whose RSVP says they are attending.
        announcements,
      },
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
