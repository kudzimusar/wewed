import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resolveNativeGrantContext, requireGrantPermission, requireWeddingScope, noStoreJson } from '@/lib/native-domain-context'

/**
 * Master plan Phase 8 §9 — Vendors (Planner vendor/service-engagement data, read-only in this
 * phase). Real `Vendor` rows for the wedding — the planning-side model (booking status/contract
 * status/payment status), never fabricated from free-text Wedding-Day `VendorPresence` rows (§9:
 * "Do not fabricate Vendor identity from free-text Vendor presence rows.").
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request)
  if (!result.ok) return result.response
  const { grant } = result.context

  const scope = requireWeddingScope(grant)
  if (!scope.ok) return scope.response
  const permission = requireGrantPermission(grant, 'vendors.view')
  if (!permission.ok) return permission.response

  const vendors = await db.vendor.findMany({
    where: { weddingId: scope.weddingId },
    orderBy: [{ createdAt: 'asc' }],
  })

  return noStoreJson({
    success: true,
    count: vendors.length,
    data: vendors.map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      category: vendor.category,
      contractStatus: vendor.contractStatus,
      paymentStatus: vendor.paymentStatus,
      notes: vendor.notes,
    })),
  })
}
