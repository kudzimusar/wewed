import { previewWriteError } from '@/lib/preview-write-response'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { applyGuestRsvpUpdate, type GuestRsvpField } from '@/lib/guest-rsvp-mutation'
import {
  resolveWeddingAccessForRequest,
  weddingAccessErrorPayload,
  weddingSlugFromRequest,
} from '@/lib/wedding-public-access'

interface RSVPPayload {
  attending?: unknown
  attendance?: unknown
  mealChoice?: unknown
  mealPreference?: unknown
  plusOne?: unknown
  plusOneName?: unknown
  plusOneMeal?: unknown
  kidsAttending?: unknown
  childrenAttending?: unknown
  kidsCount?: unknown
  numberOfChildren?: unknown
  dietaryNotes?: unknown
  dietaryRequirements?: unknown
  message?: unknown
  messageToCouple?: unknown
  slug?: unknown
}

/**
 * Master plan Phase 9 — this transport's own legacy request-body aliases, normalized to the
 * canonical `GuestRsvpField` names the shared `applyGuestRsvpUpdate` operation understands. A field
 * is only added when the caller actually supplied one of its own aliases for it, preserving this
 * endpoint's partial-update contract (an omitted field must never be coerced to `null`/cleared —
 * this used to unconditionally do exactly that for `plusOneName`/`plusOneMeal`/`dietaryNotes`/
 * `message`, silently erasing previously-saved answers on every partial edit; that bug is fixed by
 * routing through the same shared operation `/api/weddings/[slug]/guest-session` PUT uses).
 *
 * `songRequests` (a real, separate `RSVP` column this endpoint used to also write) is intentionally
 * dropped here: it is not part of Phase 9's converged guest RSVP field set, and this endpoint has no
 * current caller that depends on it (see the Phase-9 field classification doc).
 */
function normalizeLegacyRsvpFields(body: RSVPPayload): Partial<Record<GuestRsvpField, unknown>> {
  const fields: Partial<Record<GuestRsvpField, unknown>> = {}
  if (body.attending !== undefined) fields.attending = body.attending
  else if (body.attendance === 'accept') fields.attending = true
  else if (body.attendance === 'decline') fields.attending = false

  if (body.mealChoice !== undefined) fields.mealChoice = body.mealChoice
  else if (body.mealPreference !== undefined) fields.mealChoice = body.mealPreference

  if (body.plusOne !== undefined) fields.plusOne = body.plusOne
  if (body.plusOneName !== undefined) fields.plusOneName = body.plusOneName
  if (body.plusOneMeal !== undefined) fields.plusOneMeal = body.plusOneMeal

  if (body.kidsAttending !== undefined) fields.kidsAttending = body.kidsAttending
  else if (body.childrenAttending !== undefined) fields.kidsAttending = body.childrenAttending

  if (body.kidsCount !== undefined) fields.kidsCount = body.kidsCount
  else if (body.numberOfChildren !== undefined) fields.kidsCount = body.numberOfChildren

  if (body.dietaryNotes !== undefined) fields.dietaryNotes = body.dietaryNotes
  else if (body.dietaryRequirements !== undefined) fields.dietaryNotes = body.dietaryRequirements

  if (body.message !== undefined) fields.message = body.message
  else if (body.messageToCouple !== undefined) fields.message = body.messageToCouple

  return fields
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as RSVPPayload | null
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body.' },
        { status: 400 },
      )
    }

    const slug = weddingSlugFromRequest(
      request,
      typeof body.slug === 'string' ? body.slug : null,
    )
    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'Wedding route context is required.' },
        { status: 400 },
      )
    }

    const access = await resolveWeddingAccessForRequest(request, slug)
    if (!access.allowed || !access.wedding) {
      return NextResponse.json(weddingAccessErrorPayload(access), {
        status: access.status,
      })
    }
    if (!access.guest) {
      return NextResponse.json(
        {
          success: false,
          code: 'guest_invitation_required',
          error: 'Use your personal invitation QR or link to update an RSVP.',
        },
        { status: 403 },
      )
    }

    const blocked = previewWriteError(access.wedding.id)
    if (blocked) return blocked

    // Master plan Phase 9 — shares the SAME mutation semantics (adults-only enforcement,
    // partial-update-only-supplied-fields) as `/api/weddings/[slug]/guest-session` PUT, via
    // `applyGuestRsvpUpdate` (`@/lib/guest-rsvp-mutation.ts`). This is a genuine behavior fix: this
    // endpoint previously had no adults-only check at all.
    const result = await applyGuestRsvpUpdate({
      weddingId: access.wedding.id,
      rsvpToken: access.guest.rsvpToken,
      requestedFields: normalizeLegacyRsvpFields(body),
    })
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error, code: result.code },
        { status: result.status },
      )
    }

    return NextResponse.json({
      success: true,
      updated: true,
      guest: {
        id: access.guest.id,
        name: access.guest.name,
        email: access.guest.email,
      },
      rsvp: result.rsvp,
    })
  } catch (error) {
    console.error('[rsvp POST] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save RSVP.' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'guests.view')
  if (access.error) return access.error

  try {
    const rsvps = await db.rSVP.findMany({
      where: { guest: { weddingId: access.context.weddingId } },
      include: {
        guest: {
          select: { id: true, name: true, email: true, role: true, side: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ success: true, count: rsvps.length, data: rsvps })
  } catch (error) {
    console.error('[rsvp GET] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch RSVPs.' },
      { status: 500 },
    )
  }
}
