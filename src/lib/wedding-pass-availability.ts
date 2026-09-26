/**
 * Shared Wedding Pass state vocabulary (client-safe: no server-only imports).
 *
 * The Wedding Pass is the canonical WW2 venue-admission credential. It is distinct from the Open
 * Invitation (private Guest Session bootstrap), Printed Invitation Access (shared physical-card
 * access), the Wedding Website and Vendor / Booking Page QR codes, and must never be labelled as
 * any of them.
 *
 * Guest-facing availability is resolved on the server (`@/lib/wedding-day`) and returned as
 * `availability.state`; web, iOS and Android render that state rather than inferring it locally.
 * The Couple/Planner administrative state adds issuance and check-in detail on top.
 */

export type WeddingPassAvailabilityState =
  | 'rsvp_required'
  | 'declined'
  | 'not_yet_issuable'
  | 'active'
  | 'issuance_closed'
  | 'revoked'

export type WeddingPassAvailabilityCode =
  | 'ATTENDANCE_REQUIRED'
  | 'ATTENDANCE_DECLINED'
  | 'PASS_NOT_YET_ISSUABLE'
  | 'PASS_ACTIVE'
  | 'PASS_ISSUANCE_CLOSED'
  | 'PASS_REVOKED'

export interface WeddingPassAvailability {
  state: WeddingPassAvailabilityState
  code: WeddingPassAvailabilityCode
  opensAt: string
  cutoffAt: string
  expiresAt: string
}

export const WEDDING_PASS_AVAILABILITY_STATES: readonly WeddingPassAvailabilityState[] = [
  'rsvp_required',
  'declined',
  'not_yet_issuable',
  'active',
  'issuance_closed',
  'revoked',
]

export function isWeddingPassAvailabilityState(value: unknown): value is WeddingPassAvailabilityState {
  return typeof value === 'string' && (WEDDING_PASS_AVAILABILITY_STATES as readonly string[]).includes(value)
}

/** Guest-facing copy per state. Native clients carry the same sentences. */
export const GUEST_PASS_AVAILABILITY_COPY: Record<Exclude<WeddingPassAvailabilityState, 'active'>, string> = {
  rsvp_required: 'Confirm your attendance to receive your Wedding Pass.',
  declined: 'You declined this invitation, so no Wedding Pass is issued.',
  not_yet_issuable: 'Your Wedding Pass will be available closer to the wedding.',
  issuance_closed: 'Wedding Pass issuance has closed for this wedding.',
  revoked: 'This Wedding Pass is no longer valid. Please contact the couple or the wedding team.',
}

/** Revocation reason recorded when a Guest's attendance stops being `true`. */
export const ATTENDANCE_WITHDRAWN_REASON = 'rsvp_attendance_withdrawn'

/**
 * Couple/Planner view of a Guest's Wedding Pass has two independent dimensions (QRO 01 §19):
 * the *credential* (is there a valid admission credential?) and *arrival* (how much of the party
 * has been admitted?). They are never compressed into one status: a revoked Pass whose party is
 * half admitted is "Wedding Pass: Revoked · Arrival: 1 of 2 checked in", not "Partially checked in".
 */
export type WeddingPassCredentialAdminState =
  | 'pending_rsvp'
  | 'declined'
  | 'not_yet_issuable'
  | 'not_yet_issued'
  | 'active'
  | 'revoked'
  | 'superseded'
  | 'issuance_closed'

export type WeddingArrivalState = 'not_checked_in' | 'partially_checked_in' | 'checked_in'

export const WEDDING_PASS_CREDENTIAL_STATE_LABEL: Record<WeddingPassCredentialAdminState, string> = {
  pending_rsvp: 'Pending RSVP',
  declined: 'Declined',
  not_yet_issuable: 'Not yet issuable',
  not_yet_issued: 'Not yet issued',
  active: 'Active',
  revoked: 'Revoked',
  superseded: 'Superseded',
  issuance_closed: 'Issuance closed',
}

export const WEDDING_ARRIVAL_STATE_LABEL: Record<WeddingArrivalState, string> = {
  not_checked_in: 'Not checked in',
  partially_checked_in: 'Partially checked in',
  checked_in: 'Checked in',
}

export interface WeddingPassCredentialLifecycle {
  revokedAt: Date | string | null
  revocationReason: string | null
  supersededAt: Date | string | null
  expiresAt: Date | string | null
}

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
// Mirrors the canonical issuance policy in `@/lib/wedding-day` (asserted equal by tests).
const OPENS_BEFORE_MS = 14 * DAY_MS
const CUTOFF_AFTER_MS = 24 * HOUR_MS

function time(value: Date | string | null): number | null {
  if (value === null) return null
  const ms = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

/** Household attendee keys, identical to the Gate's `checkInWeddingGuest` expansion. */
export function weddingHouseholdAttendeeKeys(rsvp: {
  plusOne: boolean | null
  kidsAttending: boolean | null
  kidsCount: number | null
}): string[] {
  const keys = ['primary']
  if (rsvp.plusOne) keys.push('plus-one')
  if (rsvp.kidsAttending && (rsvp.kidsCount ?? 0) > 0) {
    for (let index = 1; index <= (rsvp.kidsCount ?? 0); index += 1) keys.push(`child-${index}`)
  }
  return keys
}

/**
 * Couple/Planner *credential* state for one Guest. Pure: it never issues, never reads a token, and
 * is computed only from RSVP and the Guest's most recent credential lifecycle metadata. Arrival
 * is deliberately not an input: see `resolveWeddingArrivalState`.
 */
export function resolveWeddingPassCredentialAdminState(input: {
  attending: boolean | null
  weddingDate: Date
  latest: WeddingPassCredentialLifecycle | null
  now?: Date
}): WeddingPassCredentialAdminState {
  if (input.attending === null) return 'pending_rsvp'
  if (input.attending === false) return 'declined'

  const now = (input.now ?? new Date()).getTime()
  const latest = input.latest
  if (latest) {
    const expires = time(latest.expiresAt)
    if (latest.revokedAt) {
      return latest.revocationReason === ATTENDANCE_WITHDRAWN_REASON ? 'superseded' : 'revoked'
    }
    if (latest.supersededAt) return 'superseded'
    if (expires !== null && expires <= now) return 'issuance_closed'
    return 'active'
  }

  const anchor = input.weddingDate.getTime()
  if (now < anchor - OPENS_BEFORE_MS) return 'not_yet_issuable'
  if (now > anchor + CUTOFF_AFTER_MS) return 'issuance_closed'
  return 'not_yet_issued'
}

/** Couple/Planner *arrival* state: Gate check-ins against the Guest's canonical household. */
export function resolveWeddingArrivalState(input: {
  householdSize: number
  admittedCount: number
}): WeddingArrivalState {
  if (input.admittedCount <= 0) return 'not_checked_in'
  if (input.householdSize > 0 && input.admittedCount >= input.householdSize) return 'checked_in'
  return 'partially_checked_in'
}
