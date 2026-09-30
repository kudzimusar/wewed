import type { NextRequest, NextResponse } from 'next/server'
import {
  noStoreJson,
  requireGrantPermission,
  requireWeddingScope,
  resolveNativeGrantContext,
} from '@/lib/native-domain-context'
import { PREVIEW_WRITE_BLOCK_MESSAGE, shouldBlockPreviewWrite } from '@/lib/preview-write-safety'

/**
 * NATIVE-MOBILE-QRO08 — authority for the native Planner invitation/guest write twins.
 *
 * Fresh server-resolved grant (Bearer native account session + `grantId`) → wedding scope → the
 * SAME permission the desktop route requires (`guests.edit`) → the same Preview write block. The
 * wedding and the acting user come only from that grant, never from the request body, and are then
 * handed to the shared operation functions the desktop routes also call.
 */
export async function resolveNativeGuestWrite(
  request: NextRequest,
): Promise<{ ok: true; actor: { weddingId: string; actorId: string } } | { ok: false; response: NextResponse }> {
  const result = await resolveNativeGrantContext(request)
  if (!result.ok) return result
  const scope = requireWeddingScope(result.context.grant)
  if (!scope.ok) return scope
  const permission = requireGrantPermission(result.context.grant, 'guests.edit')
  if (!permission.ok) return permission
  if (shouldBlockPreviewWrite({ method: request.method, weddingId: scope.weddingId })) {
    return {
      ok: false,
      response: noStoreJson({ success: false, code: 'PREVIEW_WRITE_BLOCKED', error: PREVIEW_WRITE_BLOCK_MESSAGE }, 423),
    }
  }
  return { ok: true, actor: { weddingId: scope.weddingId, actorId: result.context.session.accessUserId } }
}

/**
 * The only guest fields a native write response carries. The shared operations return the full
 * record including the RSVP row (the Guest's private invitation token); the native client re-reads
 * the canonical invitations projection instead, so no credential is ever echoed by a write.
 */
export function nativeGuestSummary(guest: { id: string; name: string; email: string | null; phone: string | null; attendanceAllocation?: string }) {
  return { id: guest.id, name: guest.name, email: guest.email, phone: guest.phone }
}
