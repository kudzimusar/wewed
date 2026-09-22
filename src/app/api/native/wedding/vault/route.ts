import { NextRequest } from 'next/server'
import { resolveNativeGrantContext, requireWeddingScope, noStoreJson } from '@/lib/native-domain-context'
import { listWeddingVaultObjects } from '@/lib/vault/catalog'

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §3.
 *
 * Read-only Documents/Vault, reusing `listWeddingVaultObjects` verbatim (the same function
 * `/api/vault` GET calls for a non-admin PWA session). No upload/write path is ported — `POST
 * /api/vault` remains PWA-only this phase, tracked honestly as UNSUPPORTED rather than a second
 * upload implementation. Matches `requireVaultWeddingAccess`'s own read policy: any wedding-*member*
 * may read, no extra permission beyond membership (uploading is the gated action, not viewing) — but
 * that PWA policy explicitly excludes `session.role === 'vendor'` even though a vendor session never
 * carries a wedding membership role at all. A `vendor:wedding:...` grant here, by contrast, DOES
 * carry `scopeKind: 'wedding'` and a real `weddingId` (Production Authority Contract V1 — it is the
 * Vendor's own wedding-engagement axis), so `requireWeddingScope` alone would incorrectly admit it.
 * Every other wedding-scoped native route additionally requires a wedding-permission-vocabulary
 * string a Vendor grant's business-membership permissions (`account.manage`/`profile.manage`/etc.)
 * never contain — Vault has no such secondary check to read, so the exclusion must be explicit here.
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request)
  if (!result.ok) return result.response
  const { grant } = result.context
  const scope = requireWeddingScope(grant)
  if (!scope.ok) return scope.response
  if (grant.workspaceKind === 'vendor') {
    return noStoreJson({ success: false, code: 'GRANT_SCOPE_INVALID', error: 'Vendor Vault access is limited to authorized conversations and service engagements.' }, 403)
  }

  const data = await listWeddingVaultObjects(scope.weddingId)
  return noStoreJson({ success: true, count: data.length, data })
}
