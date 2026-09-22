import { NextRequest } from 'next/server'
import { resolveNativeGrantContext, noStoreJson } from '@/lib/native-domain-context'

/**
 * Master plan Phase 8 §12 — Vendor business-portfolio identity. Projected directly from the
 * already-resolved `WewedProductionAuthorityV1.businessMemberships[]` (no new server query needed —
 * the authority document already carries this for the caller's own business).
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request, { workspaceKind: 'vendor' })
  if (!result.ok) return result.response
  const { grant, authority } = result.context

  if (!grant.businessAccountId) {
    return noStoreJson({ success: false, error: 'This workspace grant is not business-scoped.' }, 403)
  }

  const business = authority.businessMemberships.find((m) => m.businessAccountId === grant.businessAccountId)
  if (!business) {
    return noStoreJson({ success: false, error: 'The authorized business no longer exists.' }, 404)
  }

  return noStoreJson({
    success: true,
    business: {
      businessAccountId: business.businessAccountId,
      businessName: business.businessName,
      businessType: business.businessType,
      businessStatus: business.businessStatus,
      onboardingStatus: business.onboardingStatus,
      role: business.role,
    },
  })
}
