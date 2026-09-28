import { NextRequest } from 'next/server'
import { resolveNativeGrantContext, requireGrantPermission, requireWeddingScope } from '@/lib/native-domain-context'
import { privateNoStoreJson } from '@/lib/native-private-json'
import { loadPhysicalInvitationProjection } from '@/lib/planner-invitation-projection'

/**
 * QRO05-PIQR01 — Printed Invitation Access, native read parity. The SAME projection as the desktop
 * Planner `GET /api/planner/guests/invitations/physical`, behind the native account authority
 * (fresh grant → wedding scope → `guests.view`). GET only: this route never creates a physical QR.
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request)
  if (!result.ok) return result.response
  const scope = requireWeddingScope(result.context.grant)
  if (!scope.ok) return scope.response
  const permission = requireGrantPermission(result.context.grant, 'guests.view')
  if (!permission.ok) return permission.response

  try {
    const projection = await loadPhysicalInvitationProjection(scope.weddingId)
    if (!projection) return privateNoStoreJson({ success: false, error: 'Wedding not found.' }, 404)
    return privateNoStoreJson({ success: true, ...projection })
  } catch (error) {
    console.error('[native wedding physical invitation GET] failed', error instanceof Error ? error.name : 'unknown')
    return privateNoStoreJson({ success: false, error: 'Unable to load printed invitation access.' }, 500)
  }
}
