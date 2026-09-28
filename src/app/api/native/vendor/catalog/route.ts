import { NextRequest } from 'next/server'
import { catalogForBusiness } from '@/lib/booking-commerce'
import { resolveNativeGrantContext, noStoreJson } from '@/lib/native-domain-context'

/**
 * Master plan Phase 8 §12 — Vendor catalog (read-only in this phase). Reuses the exact query
 * `/api/vendor/catalog` uses (`catalogForBusiness`), scoped by the freshly-resolved grant's own
 * `businessAccountId` — never `providerBusinessForUser`'s pick-one-business assumption, which
 * would be wrong for a caller with more than one qualifying business (Phase 2 contract §3.1: every
 * qualifying business gets its own grant, not `LIMIT 1`). Writes are UNSUPPORTED in this phase —
 * catalog-item creation has significant archetype-specific validation not yet ported.
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request, { workspaceKind: 'vendor' })
  if (!result.ok) return result.response
  const { grant } = result.context

  if (!grant.businessAccountId) {
    return noStoreJson({ success: false, error: 'This workspace grant is not business-scoped.' }, 403)
  }

  const { items, offerings } = await catalogForBusiness(grant.businessAccountId)
  return noStoreJson({ success: true, data: { businessAccountId: grant.businessAccountId, offerings, items } })
}
