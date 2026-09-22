import { NextRequest } from 'next/server'
import { bookingsForBusiness } from '@/lib/booking-commerce'
import { resolveNativeGrantContext, noStoreJson } from '@/lib/native-domain-context'

/**
 * Master plan Phase 8 §12 — Vendor bookings (read-only in this phase). Reuses the exact query
 * `/api/vendor/bookings` uses (`bookingsForBusiness`), scoped by the freshly-resolved grant's own
 * `businessAccountId` for the same multi-business reason as the catalog adapter. Booking action
 * writes (approve/decline/quote/amendments) are UNSUPPORTED in this phase — `booking-governance.ts`
 * has its own state-machine and notification side effects not yet audited for native reuse.
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request, { workspaceKind: 'vendor' })
  if (!result.ok) return result.response
  const { grant } = result.context

  if (!grant.businessAccountId) {
    return noStoreJson({ success: false, error: 'This workspace grant is not business-scoped.' }, 403)
  }

  const bookings = await bookingsForBusiness(grant.businessAccountId)
  return noStoreJson({ success: true, count: bookings.length, data: bookings })
}
