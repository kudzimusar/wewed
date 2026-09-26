import { db } from '@/lib/db'
import { withdrawWeddingPassesForAttendance } from '@/lib/wedding-pass-attendance'
import { removeGuestWorksheetData, saveGuestWorksheetData } from './guest-worksheet-write'
import type { GuestWorksheetDataRow } from './guest-worksheet-contract'
import type { GuestWorksheetRollbackSnapshot, SerializedRsvpState } from './guest-worksheet-snapshot'

function dateOrNull(value: string | null): Date | null {
  return value ? new Date(value) : null
}

function restoredRsvpData(state: SerializedRsvpState) {
  return {
    token: state.token,
    attending: state.attending,
    mealChoice: state.mealChoice,
    plusOne: state.plusOne,
    plusOneName: state.plusOneName,
    plusOneMeal: state.plusOneMeal,
    kidsAttending: state.kidsAttending,
    kidsCount: state.kidsCount,
    songRequests: state.songRequests,
    dietaryNotes: state.dietaryNotes,
    message: state.message,
    checkedIn: state.checkedIn,
    checkedInAt: dateOrNull(state.checkedInAt),
  }
}

function restoredWorksheet(row: GuestWorksheetDataRow): GuestWorksheetDataRow {
  return {
    ...row,
    createdAt: row.createdAt ? new Date(row.createdAt as unknown as string) : undefined,
    updatedAt: row.updatedAt ? new Date(row.updatedAt as unknown as string) : undefined,
  }
}

export async function rollbackGuestWorksheetImport(
  snapshot: GuestWorksheetRollbackSnapshot,
  weddingId: string,
): Promise<{ deleted: number; restored: number; failed: number; errors: string[] }> {
  if (snapshot.kind !== 'guest-worksheet-v2' || snapshot.weddingId !== weddingId) {
    throw new Error('Guest worksheet rollback does not belong to the selected wedding.')
  }

  let deleted = 0
  let restored = 0
  let failed = 0
  const errors: string[] = []

  for (const guestId of snapshot.createdIds) {
    try {
      const removed = await db.$transaction(async (tx) => {
        const guest = await tx.guest.findFirst({ where: { id: guestId, weddingId }, select: { id: true } })
        if (!guest) return false
        await tx.rSVP.deleteMany({ where: { guestId } })
        await removeGuestWorksheetData(tx, weddingId, guestId)
        await tx.guest.delete({ where: { id: guestId } })
        return true
      })
      if (removed) deleted += 1
    } catch (error) {
      failed += 1
      errors.push(`Failed to delete imported guest ${guestId}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  for (const state of snapshot.updatedSnapshots) {
    try {
      await db.$transaction(async (tx) => {
        const guest = await tx.guest.findFirst({ where: { id: state.guestId, weddingId }, select: { id: true } })
        if (!guest) throw new Error('Guest no longer exists.')
        await tx.guest.update({ where: { id: state.guestId }, data: state.guest })
        // RSVP ↔ Wedding Pass lifecycle: restoring a pre-import RSVP that is no longer attending
        // (or removing the RSVP) must withdraw any live Pass, exactly as the import itself does.
        // The Guest row is locked by the update above (Guest → RSVP → credential lock order).
        const current = await tx.rSVP.findUnique({ where: { guestId: state.guestId } })
        const restoredAttending = state.rsvp ? state.rsvp.attending : null
        if (current?.attending === true && restoredAttending !== true) {
          await withdrawWeddingPassesForAttendance(tx, { weddingId, guestId: state.guestId })
        }

        if (state.rsvp) {
          const data = restoredRsvpData(state.rsvp)
          if (current) {
            await tx.rSVP.update({ where: { guestId: state.guestId }, data })
          } else {
            await tx.rSVP.create({
              data: {
                id: state.rsvp.id,
                guestId: state.guestId,
                ...data,
                createdAt: new Date(state.rsvp.createdAt),
                updatedAt: new Date(state.rsvp.updatedAt),
              },
            })
          }
        } else {
          await tx.rSVP.deleteMany({ where: { guestId: state.guestId } })
        }

        if (state.worksheet) {
          await saveGuestWorksheetData(tx, restoredWorksheet(state.worksheet))
        } else {
          await removeGuestWorksheetData(tx, weddingId, state.guestId)
        }
      })
      restored += 1
    } catch (error) {
      failed += 1
      errors.push(`Failed to restore guest ${state.guestId}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { deleted, restored, failed, errors }
}
