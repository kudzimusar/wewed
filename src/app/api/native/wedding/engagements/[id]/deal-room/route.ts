import { NextRequest } from 'next/server'
import { resolveNativeGrantContext, requireGrantPermission, requireWeddingScope, noStoreJson } from '@/lib/native-domain-context'
import { getServiceEngagementDealRoom, Phase2ContractError } from '@/lib/contracts/phase2'

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §2.
 *
 * Mirrors `/api/planner/engagements/[id]/deal-room` GET exactly (same `getServiceEngagementDealRoom`
 * call, same `vendors.view` permission), scoped through the fresh grant instead of a cookie session.
 * `getServiceEngagementDealRoom` itself scopes its query to `{ id: engagementId, weddingId }`, so a
 * foreign engagement (one belonging to a different wedding) is a 404 here exactly as it is on the
 * PWA — never a leak, never a client-supplied weddingId trusted as authority.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await resolveNativeGrantContext(request)
  if (!result.ok) return result.response
  const { grant } = result.context
  const scope = requireWeddingScope(grant)
  if (!scope.ok) return scope.response
  const permission = requireGrantPermission(grant, 'vendors.view')
  if (!permission.ok) return permission.response

  try {
    const { id } = await params
    const data = await getServiceEngagementDealRoom(scope.weddingId, id)
    return noStoreJson({ success: true, data })
  } catch (error) {
    if (error instanceof Phase2ContractError) {
      return noStoreJson({ success: false, error: error.message }, error.status)
    }
    console.error('[NATIVE DEAL ROOM GET] error:', error)
    return noStoreJson({ success: false, error: 'Failed to load the service engagement Deal Room.' }, 500)
  }
}
