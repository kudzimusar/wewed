import { NextRequest } from 'next/server'
import { resolveNativeGrantContext, requireGrantPermission, requireWeddingScope } from '@/lib/native-domain-context'
import { privateNoStoreJson } from '@/lib/native-private-json'
import { loadPlannerInvitationProjection } from '@/lib/planner-invitation-projection'

/**
 * QRO05-PIQR01 — Planner/Couple Invitations & QR, native read parity. The SAME canonical projection
 * as the desktop Planner `GET /api/planner/guests/invitations`, reached through the native account
 * authority: fresh server-resolved grant → wedding scope → `guests.view`.
 *
 * GET only. No token backfill, rotation, style change or any other write exists on this route.
 * Each row's `invitationUrl`/`qrValue`/`shareMessage` carries the Guest's private RSVP credential:
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
