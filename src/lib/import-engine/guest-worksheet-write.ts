import { Prisma } from '@prisma/client'
import type { GuestWorksheetDataRow } from './guest-worksheet-contract'

export async function saveGuestWorksheetData(tx: Prisma.TransactionClient, row: GuestWorksheetDataRow): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO wewed_planner."GuestWorksheetData" (
      "guestId", "weddingId", "firstName", "lastName", "displayName",
      "guestGroup", "invitationStatus", "responseStatus", "partySize",
      "accessibilityNotes", "transportDetails", "accommodationDetails",
      "seatAssignment", "publicNotes", "privateNotes", "createdAt", "updatedAt"
    ) VALUES (
      ${row.guestId}, ${row.weddingId}, ${row.firstName}, ${row.lastName}, ${row.displayName},
      ${row.guestGroup}, ${row.invitationStatus}, ${row.responseStatus}, ${row.partySize},
      ${row.accessibilityNotes}, ${row.transportDetails}, ${row.accommodationDetails},
      ${row.seatAssignment}, ${row.publicNotes}, ${row.privateNotes},
      ${row.createdAt ?? new Date()}, ${row.updatedAt ?? new Date()}
    )
    ON CONFLICT ("guestId") DO UPDATE SET
      "weddingId" = EXCLUDED."weddingId",
      "firstName" = EXCLUDED."firstName",
      "lastName" = EXCLUDED."lastName",
      "displayName" = EXCLUDED."displayName",
      "guestGroup" = EXCLUDED."guestGroup",
      "invitationStatus" = EXCLUDED."invitationStatus",
      "responseStatus" = EXCLUDED."responseStatus",
      "partySize" = EXCLUDED."partySize",
      "accessibilityNotes" = EXCLUDED."accessibilityNotes",
      "transportDetails" = EXCLUDED."transportDetails",
      "accommodationDetails" = EXCLUDED."accommodationDetails",
      "seatAssignment" = EXCLUDED."seatAssignment",
      "publicNotes" = EXCLUDED."publicNotes",
      "privateNotes" = EXCLUDED."privateNotes",
      "updatedAt" = EXCLUDED."updatedAt"
  `)
}

export async function removeGuestWorksheetData(tx: Prisma.TransactionClient, weddingId: string, guestId: string): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    DELETE FROM wewed_planner."GuestWorksheetData"
    WHERE "guestId" = ${guestId} AND "weddingId" = ${weddingId}
  `)
}
