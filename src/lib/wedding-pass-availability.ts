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

export type WeddingPassAdminState =
  | 'pending_rsvp'
  | 'declined'
  | 'not_yet_issuable'
  | 'not_yet_issued'
  | 'active'
  | 'revoked'
  | 'superseded'
  | 'issuance_closed'
  | 'partially_checked_in'
  | 'checked_in'

export const WEDDING_PASS_ADMIN_STATE_LABEL: Record<WeddingPassAdminState, string> = {
  pending_rsvp: 'Pending RSVP',
  declined: 'Declined',
  not_yet_issuable: 'Pass not yet issuable',
  not_yet_issued: 'Pass not yet issued',
  active: 'Pass active',
  revoked: 'Pass revoked',
  superseded: 'Pass superseded',
  issuance_closed: 'Issuance closed',
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
 * Couple/Planner administrative state for one Guest. Pure: it never issues, never reads a token,
 * and is computed only from RSVP, the Guest's most recent credential lifecycle metadata and Gate
 * check-in rows.
 */
export function resolveWeddingPassAdminState(input: {
  attending: boolean | null
  weddingDate: Date
  latest: WeddingPassCredentialLifecycle | null
  householdSize: number
  admittedCount: number
  now?: Date
}): WeddingPassAdminState {
  if (input.attending === null) return 'pending_rsvp'
  if (input.attending === false) return 'declined'

  if (input.householdSize > 0 && input.admittedCount >= input.householdSize) return 'checked_in'
  if (input.admittedCount > 0) return 'partially_checked_in'

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
