/**
 * One projection of a Guest's account-side authority fields, shared by the desktop Planner/Couple
 * guest list, the native wedding guest list and the invitation-bound Guest session (QRO 01 §24).
 *
 * Previously each transport derived these inline — the native list computed RSVP status itself
 * and took the table name without the same-wedding containment the Guest session applies — which
 * is how two clients drift into showing the same Guest differently. Party size is the canonical
 * household expansion the Gate admits against and the Planner Wedding Pass surface reports.
 *
 * Pure: no database, Next or server-only import.
 */

import { weddingHouseholdAttendeeKeys } from '@/lib/wedding-pass-availability'

export type GuestRsvpStatus = 'pending' | 'attending' | 'declined'

export function guestRsvpStatus(attending: boolean | null | undefined): GuestRsvpStatus {
  if (attending === true) return 'attending'
  if (attending === false) return 'declined'
  return 'pending'
}

/** A table is part of this Guest's authority only when it belongs to the same wedding. */
export function guestSeatingIdentity(
  seatingTable: { id: string; name: string; weddingId: string } | null | undefined,
  weddingId: string,
): { seatingTableId: string | null; tableName: string | null } {
  if (!seatingTable || seatingTable.weddingId !== weddingId) return { seatingTableId: null, tableName: null }
  return { seatingTableId: seatingTable.id, tableName: seatingTable.name }
}

/** The canonical household size (primary + plus-one + attending children). */
export function guestPartySize(
  rsvp: { plusOne: boolean | null; kidsAttending: boolean | null; kidsCount: number | null } | null | undefined,
): number {
  return weddingHouseholdAttendeeKeys(rsvp ?? { plusOne: false, kidsAttending: false, kidsCount: 0 }).length
}
