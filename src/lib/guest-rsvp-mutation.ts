import 'server-only'
import { db } from '@/lib/db'

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 9 — Digital Invitation + RSVP
 * convergence.
 *
 * The one place guest-submitted RSVP field-mutation business rules live, shared by every guest
 * self-service write transport: `PUT /api/weddings/[slug]/guest-session` (Guest Session v2 — used
 * by the PWA's premium invitation RSVP dialog and, as of Phase 9, Android/iOS) and
 * `POST /api/rsvp` (a second, older guest-facing transport with its own cookie-based
 * authorization). Before Phase 9 these had drifted into two separate implementations — `/api/rsvp`
 * lacked the adults-only enforcement entirely and unconditionally overwrote
 * `plusOneName`/`plusOneMeal`/`dietaryNotes`/`message` with `null` whenever a caller omitted them,
 * silently erasing previously-saved answers on any partial edit.
 *
 * Transport-specific identity/authorization (Guest Session v2's `originGuestId` stale-context
 * check, `/api/rsvp`'s cookie-based `resolveWeddingAccessForRequest`) stays in each route. This
 * function only ever runs once a real `(weddingId, rsvpToken)` pair has already been authorized by
 * the caller — it owns exactly the mutation semantics: which fields may change, what "adults only"
 * means for `kidsAttending`/`kidsCount`, and that an omitted field is left completely untouched
 * (never coerced to null, never overwritten) so a partial edit never erases an unrelated,
 * already-saved answer.
 *
 * `songRequests` (a real, separate `RSVP` column `/api/rsvp` used to also expose) is deliberately
 * excluded — it is not part of Phase 9's converged field set and no current caller depends on it
 * through this operation.
 */

export type ChildrenPolicy = 'welcome' | 'adults_only'

export async function loadWeddingChildrenPolicy(weddingId: string): Promise<ChildrenPolicy> {
  const row = await db.weddingContent.findUnique({
    where: {
      weddingId_section_field: {
        weddingId,
        section: 'rsvp',
        field: 'childrenPolicy',
      },
    },
    select: { value: true },
  })
  return row?.value.trim().toLowerCase() === 'adults_only' ? 'adults_only' : 'welcome'
}

/** The converged Phase-9 guest-editable RSVP field set. Order matches the shared native DTOs. */
export const GUEST_RSVP_FIELDS = [
  'attending',
  'mealChoice',
  'plusOne',
  'plusOneName',
  'plusOneMeal',
  'kidsAttending',
  'kidsCount',
  'dietaryNotes',
  'message',
] as const

export type GuestRsvpField = (typeof GUEST_RSVP_FIELDS)[number]

export interface GuestRsvpRecord {
  attending: boolean | null
  mealChoice: string | null
  plusOne: boolean
  plusOneName: string | null
  plusOneMeal: string | null
  kidsAttending: boolean
  kidsCount: number
  dietaryNotes: string | null
  message: string | null
  checkedIn: boolean
  checkedInAt: Date | null
}

export type GuestRsvpUpdateResult =
  | { ok: true; rsvp: GuestRsvpRecord }
  | { ok: false; code: 'CHILDREN_NOT_ALLOWED'; status: 400; error: string }

const GUEST_RSVP_SELECT = {
  attending: true,
  mealChoice: true,
  plusOne: true,
  plusOneName: true,
  plusOneMeal: true,
  kidsAttending: true,
  kidsCount: true,
  dietaryNotes: true,
  message: true,
  checkedIn: true,
  checkedInAt: true,
} as const

/**
 * Builds the Prisma patch for one guest RSVP write. A key absent from `requestedFields` (as
 * opposed to present with value `null`) is never added to the patch — the caller's route is
 * responsible for only including fields the request body actually named, so this cannot be
 * accidentally bypassed by passing a fully-populated object.
 */
function buildGuestRsvpPatch(requestedFields: Partial<Record<GuestRsvpField, unknown>>): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const field of GUEST_RSVP_FIELDS) {
    if (!(field in requestedFields) || requestedFields[field] === undefined) continue
    const value = requestedFields[field]
    switch (field) {
      case 'attending':
      case 'plusOne':
      case 'kidsAttending':
        if (typeof value === 'boolean') data[field] = value
        break
      case 'kidsCount': {
        const numeric = typeof value === 'number' ? value : Number(value)
        if (Number.isFinite(numeric)) data[field] = Math.max(0, Math.trunc(numeric))
        break
      }
      case 'mealChoice':
      case 'plusOneName':
      case 'plusOneMeal':
      case 'dietaryNotes':
      case 'message':
        if (value === null) data[field] = null
        else if (typeof value === 'string') data[field] = value.trim() || null
        break
    }
  }
  return data
}

/**
 * Applies one guest RSVP edit. `requestedFields` must already be normalized to the canonical field
 * names above — each transport owns translating its own legacy request-body aliases (`attendance`,
 * `mealPreference`, `childrenAttending`, `numberOfChildren`, `messageToCouple`, ...) before calling
 * this, so this function itself carries no transport-specific vocabulary.
 */
export async function applyGuestRsvpUpdate(params: {
  weddingId: string
  rsvpToken: string
  requestedFields: Partial<Record<GuestRsvpField, unknown>>
}): Promise<GuestRsvpUpdateResult> {
  const { weddingId, rsvpToken, requestedFields } = params
  const childrenPolicy = await loadWeddingChildrenPolicy(weddingId)

  if (childrenPolicy === 'adults_only' && requestedFields.kidsAttending === true) {
    return {
      ok: false,
      code: 'CHILDREN_NOT_ALLOWED',
      status: 400,
      error: 'This celebration is configured as adults only.',
    }
  }

  const data = buildGuestRsvpPatch(requestedFields)
  if (childrenPolicy === 'adults_only') {
    // Cached/older clients may still submit the guest's historical child count. Adults-only makes
    // current attendance false, but never destroys that history.
    data.kidsAttending = false
    delete data.kidsCount
  }

  const updated = await db.rSVP.update({
    where: { token: rsvpToken },
    data,
    select: GUEST_RSVP_SELECT,
  })

  return { ok: true, rsvp: updated }
}
