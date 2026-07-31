import type { ImportResult } from './types'
import type { GuestWorksheetDataRow } from './guest-worksheet-contract'

export interface SerializedRsvpState {
  id: string
  token: string
  attending: boolean | null
  mealChoice: string | null
  plusOne: boolean
  plusOneName: string | null
  plusOneMeal: string | null
  kidsAttending: boolean
  kidsCount: number
  songRequests: string | null
  dietaryNotes: string | null
  message: string | null
  checkedIn: boolean
  checkedInAt: string | null
  guestId: string
  createdAt: string
  updatedAt: string
}

export interface GuestRollbackState {
  guestId: string
  guest: {
    name: string
    email: string | null
    phone: string | null
    seatingTableId: string | null
    tableNumber: number | null
  }
  rsvp: SerializedRsvpState | null
  worksheet: GuestWorksheetDataRow | null
}

export interface GuestWorksheetRollbackSnapshot {
  kind: 'guest-worksheet-v2'
  jobId: string
  moduleKey: 'guests'
  weddingId: string
  createdIds: string[]
  updatedSnapshots: GuestRollbackState[]
  executedAt: string
}

export interface GuestWorksheetExecution {
  result: ImportResult
  snapshot: GuestWorksheetRollbackSnapshot
}
