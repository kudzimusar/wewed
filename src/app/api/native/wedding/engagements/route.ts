import { NextRequest } from 'next/server'
import { resolveNativeGrantContext, requireGrantPermission, requireWeddingScope, noStoreJson } from '@/lib/native-domain-context'
import { listManagedServiceEngagements } from '@/lib/contracts/phase2'

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §2.
 *
 * Read-only list of a wedding's managed service engagements, reusing `listManagedServiceEngagements`
 * verbatim — the exact function the PWA's contract-governance surfaces call. No contract lifecycle
 * logic (draft generation, review, acceptance) is ported here; that remains UNSUPPORTED and is
 * tracked in the field classification doc, not silently reimplemented.
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request)
  if (!result.ok) return result.response
  const { grant } = result.context
  const scope = requireWeddingScope(grant)
  if (!scope.ok) return scope.response
  const permission = requireGrantPermission(grant, 'vendors.view')
  if (!permission.ok) return permission.response

  // Matches `/api/planner/engagements/current` GET exactly: a plain passthrough of
  // `listManagedServiceEngagements`'s rows (Prisma `Decimal` fields serialize to strings via their
  // own `toJSON()`, same as that PWA route already relies on) — so native and PWA see byte-identical
  // business data for the same wedding, not two independently-shaped projections of it.
  const engagements = await listManagedServiceEngagements(scope.weddingId)
  return noStoreJson({ success: true, count: engagements.length, data: engagements })
}
