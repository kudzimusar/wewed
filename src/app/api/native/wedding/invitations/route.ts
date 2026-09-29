import { NextRequest } from 'next/server'
import { resolveNativeGrantContext, requireGrantPermission, requireWeddingScope } from '@/lib/native-domain-context'
import { privateNoStoreJson } from '@/lib/native-private-json'
import { loadPlannerInvitationProjection } from '@/lib/planner-invitation-projection'
import { resolveNativeGuestWrite } from '@/lib/native-planner-guest-write'
import { repairMissingInvitationLinks, rotateGuestInvitation } from '@/lib/planner-invitation-operations'

/**
 * QRO05-PIQR01 — Planner/Couple Invitations & QR, native read parity. The SAME canonical projection
 * as the desktop Planner `GET /api/planner/guests/invitations`, reached through the native account
 * authority: fresh server-resolved grant → wedding scope → `guests.view`.
 *
 * GET reads the projection. QRO08 adds the two explicit Planner link operations as native twins of
 * the desktop POST (issue links only for guests without one) and PATCH (rotate one guest's link),
 * both calling the SAME shared operations with the same `guests.edit` authority. Invitation design
 * settings (style/message/deadline/children policy) are not written here. Each row's `invitationUrl`/`qrValue`/`shareMessage` carries the Guest's private RSVP credential:
 * the response is private/no-store and must never be logged or persisted by the client.
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request)
  if (!result.ok) return result.response
  const scope = requireWeddingScope(result.context.grant)
  if (!scope.ok) return scope.response
  const permission = requireGrantPermission(result.context.grant, 'guests.view')
  if (!permission.ok) return permission.response

  try {
    const projection = await loadPlannerInvitationProjection(scope.weddingId, request.nextUrl.origin)
    if (!projection) return privateNoStoreJson({ success: false, error: 'Wedding not found.' }, 404)
    return privateNoStoreJson({ success: true, ...projection })
  } catch (error) {
    // Never include the error payload: it could echo credential-bearing values.
    console.error('[native wedding invitations GET] failed', error instanceof Error ? error.name : 'unknown')
    return privateNoStoreJson({ success: false, error: 'Unable to load invitations.' }, 500)
  }
}

/** Issues personal links only for guests that have none (the desktop "Generate missing links"). */
export async function POST(request: NextRequest) {
  const write = await resolveNativeGuestWrite(request)
  if (!write.ok) return write.response
  try {
    const result = await repairMissingInvitationLinks(write.actor)
    return privateNoStoreJson({ success: true, generated: result.ok ? result.data.generated : 0 })
  } catch (error) {
    console.error('[native wedding invitations POST] failed', error instanceof Error ? error.name : 'unknown')
    return privateNoStoreJson({ success: false, error: 'Unable to generate invitation links.' }, 500)
  }
}

/** Destructive: rotates one guest's personal link; the previous link stops working. */
export async function PATCH(request: NextRequest) {
  const write = await resolveNativeGuestWrite(request)
  if (!write.ok) return write.response
  try {
    const body = (await request.json().catch(() => null)) as { guestId?: unknown } | null
    const result = await rotateGuestInvitation(write.actor, { guestId: body?.guestId })
    if (!result.ok) return privateNoStoreJson({ success: false, error: result.error }, result.status)
    return privateNoStoreJson({ success: true })
  } catch (error) {
    console.error('[native wedding invitations PATCH] failed', error instanceof Error ? error.name : 'unknown')
    return privateNoStoreJson({ success: false, error: 'Unable to rotate invitation.' }, 500)
  }
}
