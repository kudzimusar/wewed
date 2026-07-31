import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import type { GuestWorksheetDataRow, GuestWorksheetRecord } from './guest-worksheet-contract'

export async function fetchGuestWorksheetData(client: any, weddingId: string): Promise<GuestWorksheetDataRow[]> {
  return (await client.$queryRaw(Prisma.sql`
    SELECT "guestId", "weddingId", "firstName", "lastName", "displayName",
      "guestGroup", "invitationStatus", "responseStatus", "partySize",
      "accessibilityNotes", "transportDetails", "accommodationDetails",
      "seatAssignment", "publicNotes", "privateNotes", "createdAt", "updatedAt"
    FROM wewed_planner."GuestWorksheetData"
    WHERE "weddingId" = ${weddingId}
  `)) as GuestWorksheetDataRow[]
}

export async function fetchGuestWorksheetDataRow(client: any, weddingId: string, guestId: string): Promise<GuestWorksheetDataRow | null> {
  const rows = (await client.$queryRaw(Prisma.sql`
    SELECT "guestId", "weddingId", "firstName", "lastName", "displayName",
      "guestGroup", "invitationStatus", "responseStatus", "partySize",
      "accessibilityNotes", "transportDetails", "accommodationDetails",
      "seatAssignment", "publicNotes", "privateNotes", "createdAt", "updatedAt"
    FROM wewed_planner."GuestWorksheetData"
    WHERE "weddingId" = ${weddingId} AND "guestId" = ${guestId}
    LIMIT 1
  `)) as GuestWorksheetDataRow[]
  return rows[0] ?? null
}

export async function fetchGuestWorksheetRecords(weddingId: string): Promise<GuestWorksheetRecord[]> {
  const [guests, worksheetRows] = await Promise.all([
    db.guest.findMany({
      where: { weddingId },
      include: { rsvp: true, seatingTable: { select: { id: true, name: true, capacity: true } } },
      orderBy: { name: 'asc' },
    }),
    fetchGuestWorksheetData(db, weddingId),
  ])
  const byGuest = new Map(worksheetRows.map((row) => [row.guestId, row]))
  return guests.map((guest) => ({ ...guest, worksheet: byGuest.get(guest.id) ?? null })) as GuestWorksheetRecord[]
}
