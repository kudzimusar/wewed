import { NextRequest } from 'next/server'
import { resolveNativeGrantContext, requireGrantEngagement, noStoreJson } from '@/lib/native-domain-context'
import { getServiceEngagementDealRoom, Phase2ContractError } from '@/lib/contracts/phase2'

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure round 3 §6.
 *
 * The Vendor's OWN wedding-engagement view — a completely separate authority axis from the Vendor
 * business-portfolio shell (`/api/native/vendor/business`) and from the Planner/Couple/Coordinator
 * Contracts list (`/api/native/wedding/engagements`), which a Vendor's business-membership
 * permissions can never satisfy (proven by `native-domain-context.integration.test.ts`'s F-3 test).
 * Reuses `getServiceEngagementDealRoom` verbatim — the SAME function the Planner-side Deal Room
 * route calls — never a second contract truth, and never routes a Vendor through a Planner-scoped
 * route to get it.
 *
 * `requireGrantEngagement` is what makes a foreign engagement 422 rather than a leak: a
 * `vendor:wedding:...` grant's `serviceEngagementIds` is populated from the Vendor's OWN
 * `BusinessAccountLink` → `Vendor` → `ServiceEngagement` chain (`deriveVendorWeddingGrants`), so a
 * requested id that is not genuinely this Vendor's own engagement is refused before
 * `getServiceEngagementDealRoom` is ever called — and that function's own `{id, weddingId}` query
 * (`weddingId` from the fresh grant, never client-supplied) refuses a foreign wedding regardless.
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request, { workspaceKind: 'vendor' })
  if (!result.ok) return result.response
  const { grant } = result.context

  if (grant.scopeKind !== 'wedding' || !grant.weddingId) {
    return noStoreJson({ success: false, code: 'GRANT_SCOPE_INVALID', error: 'This workspace grant is not a Vendor wedding engagement.' }, 403)
  }

  const requestedEngagementId = request.nextUrl.searchParams.get('engagementId')
  const engagementCheck = requireGrantEngagement(grant, requestedEngagementId)
  if (!engagementCheck.ok) return engagementCheck.response

  const engagementId = engagementCheck.engagementId ?? grant.serviceEngagementIds[0] ?? null
  if (!engagementId) {
    return noStoreJson({ success: false, code: 'ENGAGEMENT_INVALID', error: 'No service engagement exists for this Vendor workspace grant.' }, 422)
  }

  try {
    const data = await getServiceEngagementDealRoom(grant.weddingId, engagementId)
    return noStoreJson({ success: true, engagementIds: grant.serviceEngagementIds, data })
  } catch (error) {
    if (error instanceof Phase2ContractError) {
      return noStoreJson({ success: false, error: error.message }, error.status)
    }
    console.error('[NATIVE VENDOR ENGAGEMENT GET] error:', error)
    return noStoreJson({ success: false, error: 'Failed to load the Vendor service engagement.' }, 500)
  }
}
