import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  INVITATION_STATUSES,
  RESPONSE_STATUSES,
  attendingFromStatus,
  guestWorksheetInput,
  inputDisplayName,
  responseStatusFromAttending,
  type GuestWorksheetDataRow,
  type GuestWorksheetInput,
} from './guest-worksheet-contract'
import { fetchGuestWorksheetDataRow } from './guest-worksheet-read'
import { saveGuestWorksheetData } from './guest-worksheet-write'
import type { GuestRollbackState, SerializedRsvpState } from './guest-worksheet-snapshot'

function serializeRsvp(rsvp: any): SerializedRsvpState | null {
  if (!rsvp) return null
  return {
    id: rsvp.id,
    token: rsvp.token,
    attending: rsvp.attending,
    mealChoice: rsvp.mealChoice,
    plusOne: rsvp.plusOne,
    plusOneName: rsvp.plusOneName,
    plusOneMeal: rsvp.plusOneMeal,
    kidsAttending: rsvp.kidsAttending,
    kidsCount: rsvp.kidsCount,
    songRequests: rsvp.songRequests,
    dietaryNotes: rsvp.dietaryNotes,
    message: rsvp.message,
    checkedIn: rsvp.checkedIn,
    checkedInAt: rsvp.checkedInAt?.toISOString() ?? null,
    guestId: rsvp.guestId,
    createdAt: rsvp.createdAt.toISOString(),
    updatedAt: rsvp.updatedAt.toISOString(),
  }
}

export async function snapshotGuestWorksheetState(
  weddingId: string,
  guestId: string,
): Promise<GuestRollbackState> {
  const [guest, worksheet] = await Promise.all([
    db.guest.findFirst({ where: { id: guestId, weddingId }, include: { rsvp: true } }),
    fetchGuestWorksheetDataRow(db, weddingId, guestId),
  ])
  if (!guest) throw new Error('Guest no longer exists in the selected wedding.')
  return {
    guestId,
    guest: {
      name: guest.name,
      email: guest.email,
      phone: guest.phone,
      seatingTableId: guest.seatingTableId,
      tableNumber: guest.tableNumber,
    },
    rsvp: serializeRsvp(guest.rsvp),
    worksheet,
  }
}

async function resolveTable(
  tx: Prisma.TransactionClient,
  weddingId: string,
  name: string,
  guestId: string,
) {
  const tables = await tx.seatingTable.findMany({
    where: { weddingId, name: { equals: name, mode: 'insensitive' } },
    take: 2,
  })
  if (tables.length === 0) throw new Error(`Table Assignment "${name}" does not exist in the selected wedding.`)
  if (tables.length > 1) throw new Error(`Table Assignment "${name}" is ambiguous in the selected wedding.`)
  const table = tables[0]
  const occupied = await tx.guest.count({
    where: { weddingId, seatingTableId: table.id, id: { not: guestId } },
  })
  if (occupied >= table.capacity) throw new Error(`Table Assignment "${table.name}" is full (${occupied}/${table.capacity}).`)
  return table
}

function validInvitationStatus(input: GuestWorksheetInput, existing: GuestWorksheetDataRow | null): string {
  return INVITATION_STATUSES.includes(input.invitationStatus as (typeof INVITATION_STATUSES)[number])
    ? input.invitationStatus
    : existing?.invitationStatus || 'pending'
}

function validResponseStatus(
  input: GuestWorksheetInput,
  existing: GuestWorksheetDataRow | null,
  attending: boolean | null | undefined,
): string {
  return RESPONSE_STATUSES.includes(input.rsvpStatus as (typeof RESPONSE_STATUSES)[number])
    ? input.rsvpStatus
    : existing?.responseStatus || responseStatusFromAttending(attending)
}

function mergedWorksheetData(args: {
  weddingId: string
  guestId: string
  guestName: string
  input: GuestWorksheetInput
  existing: GuestWorksheetDataRow | null
  attending: boolean | null | undefined
  plusOne: boolean | undefined
}): GuestWorksheetDataRow {
  const { weddingId, guestId, guestName, input, existing, attending, plusOne } = args
  const firstName = input.firstName || existing?.firstName || null
  const lastName = input.lastName || existing?.lastName || null
  const changedName = input.firstName || input.lastName
    ? [firstName, lastName].filter(Boolean).join(' ')
    : ''
  const displayName = input.displayName || changedName || existing?.displayName || guestName
  const partySize = input.numberAttending
    ?? existing?.partySize
    ?? (input.plusOneName || plusOne ? 2 : 1)
  const now = new Date()
  return {
    guestId,
    weddingId,
    firstName,
    lastName,
    displayName,
    guestGroup: input.group || existing?.guestGroup || null,
    invitationStatus: validInvitationStatus(input, existing),
    responseStatus: validResponseStatus(input, existing, attending),
    partySize,
    accessibilityNotes: input.accessibility || existing?.accessibilityNotes || null,
    transportDetails: input.transport || existing?.transportDetails || null,
    accommodationDetails: input.accommodation || existing?.accommodationDetails || null,
    seatAssignment: input.seatAssignment || existing?.seatAssignment || null,
    publicNotes: input.publicNotes || existing?.publicNotes || null,
    privateNotes: input.privateNotes || existing?.privateNotes || null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

export async function applyGuestWorksheetRow(
  weddingId: string,
  row: Record<string, string>,
  existingId?: string,
): Promise<{ id: string; created: boolean }> {
  const input = guestWorksheetInput(row)
  return db.$transaction(async (tx) => {
    const existingGuest = existingId
      ? await tx.guest.findFirst({ where: { id: existingId, weddingId }, include: { rsvp: true } })
      : null
    if (existingId && !existingGuest) throw new Error('Matched guest no longer exists in the selected wedding.')

    const existingWorksheet = existingGuest
      ? await fetchGuestWorksheetDataRow(tx, weddingId, existingGuest.id)
      : null
    const existingFirst = existingWorksheet?.firstName || ''
    const existingLast = existingWorksheet?.lastName || ''
    const requestedName = inputDisplayName(input)
    const mergedName = requestedName
      || (input.firstName || input.lastName
        ? [input.firstName || existingFirst, input.lastName || existingLast].filter(Boolean).join(' ')
        : existingWorksheet?.displayName || existingGuest?.name || '')
    if (!mergedName) throw new Error('Guest name is required.')

    const guest = existingGuest
      ? await tx.guest.update({
          where: { id: existingGuest.id },
          data: {
            ...(input.firstName || input.lastName || input.displayName ? { name: mergedName } : {}),
            ...(input.email ? { email: input.email } : {}),
            ...(input.phone ? { phone: input.phone } : {}),
          },
        })
      : await tx.guest.create({
          data: {
            weddingId,
            name: mergedName,
            email: input.email || null,
            phone: input.phone || null,
            role: 'guest',
            side: 'neutral',
          },
        })

    if (input.tableAssignment) {
      const table = await resolveTable(tx, weddingId, input.tableAssignment, guest.id)
      if (guest.seatingTableId !== table.id) {
        await tx.guest.update({ where: { id: guest.id }, data: { seatingTableId: table.id } })
      }
    }

    const currentRsvp = existingGuest?.rsvp
      ?? (existingGuest ? await tx.rSVP.findUnique({ where: { guestId: guest.id } }) : null)
    const hasRsvpInput = Boolean(
      input.rsvpStatus
      || input.numberAttending != null
      || input.plusOneName
      || input.numberOfChildren != null
      || input.dietary,
    )
    let resultingRsvp = currentRsvp
    if (hasRsvpInput) {
      const responseStatus = validResponseStatus(input, existingWorksheet, currentRsvp?.attending)
      const partySize = input.numberAttending
        ?? existingWorksheet?.partySize
        ?? (input.plusOneName || currentRsvp?.plusOne ? 2 : 1)
      const kidsCount = input.numberOfChildren ?? currentRsvp?.kidsCount ?? 0
      const data = {
        ...(input.rsvpStatus ? { attending: attendingFromStatus(responseStatus) } : {}),
        ...(input.numberAttending != null || input.plusOneName
          ? { plusOne: partySize > 1 || Boolean(input.plusOneName) }
          : {}),
        ...(input.plusOneName ? { plusOneName: input.plusOneName } : {}),
        ...(input.numberOfChildren != null ? { kidsCount, kidsAttending: kidsCount > 0 } : {}),
        ...(input.dietary ? { dietaryNotes: input.dietary } : {}),
      }
      resultingRsvp = currentRsvp
        ? await tx.rSVP.update({ where: { guestId: guest.id }, data })
        : await tx.rSVP.create({
            data: {
              guestId: guest.id,
              token: `rsvp_${randomUUID().replace(/-/g, '')}`,
              attending: input.rsvpStatus ? attendingFromStatus(responseStatus) : null,
              plusOne: partySize > 1 || Boolean(input.plusOneName),
              plusOneName: input.plusOneName || null,
              kidsCount,
              kidsAttending: kidsCount > 0,
              dietaryNotes: input.dietary || null,
            },
          })
    }

    await saveGuestWorksheetData(tx, mergedWorksheetData({
      weddingId,
      guestId: guest.id,
      guestName: mergedName,
      input,
      existing: existingWorksheet,
      attending: resultingRsvp?.attending,
      plusOne: resultingRsvp?.plusOne,
    }))

    return { id: guest.id, created: !existingGuest }
  })
}
