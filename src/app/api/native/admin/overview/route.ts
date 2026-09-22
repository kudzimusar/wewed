import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { resolveNativeGrantContext, requireGrantAdminPermission, noStoreJson } from '@/lib/native-domain-context'
import { hasWewedAdminPermission, resolveWewedAdminPermissions } from '@/lib/wewed-admin-policy'
import { loadAdminOverview } from '@/lib/admin/overview'

/**
 * Master plan Phase 8 §13, closure §4 — the Admin system overview. Admin is system-scoped, never
 * wedding-scoped ("Do not create a fake Admin wedding"), so this returns no `weddingId` and derives
 * nothing from one.
 *
 * `counts.pendingOnboarding` is unchanged from Phase 8's original pass: the exact WHERE clause
 * `/api/admin/onboarding` GET already uses for that queue (public-registration accounts awaiting
 * review) — a narrower, Phase-7-specific metric, deliberately NOT the same number as
 * `summary.incompleteOnboarding` below (which counts every non-internal account with incomplete
 * onboarding, any source). Conflating the two would silently change what this field has always meant
 * to existing native callers.
 *
 * `summary`/`analytics`/`accounts`/`supportCases`/`incidents` now reuse `loadAdminOverview` — the
 * SAME function `/api/admin/overview` GET calls — gated per-section by the exact same
 * `resolveWewedAdminPermissions`/`hasWewedAdminPermission` check `requireGrantAdminPermission`
 * already uses, so a support-only administrator sees `supportCases` but not `accounts`/billing
 * fields, identically on both transports. `accountMembers`/`accountLinks`/`adminUsers`/`payments`/
 * `auditLog` remain UNSUPPORTED on native this phase (see field classification doc) — smaller,
 * deliberately incremental scope, not a silent drop of data the PWA shows.
 */
export async function GET(request: NextRequest) {
  const result = await resolveNativeGrantContext(request, { workspaceKind: 'admin' })
  if (!result.ok) return result.response
  const { grant } = result.context

  const permission = requireGrantAdminPermission(grant, 'admin.overview.read')
  if (!permission.ok) return permission.response

  const [pendingOnboardingCount] = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*) AS count
       FROM public."BusinessAccount" ba
      WHERE ba."sourceType" = 'public_registration'
        AND ba.status = 'active'
        AND ba."onboardingStatus" <> 'complete'`,
  )

  const adminPermissions = resolveWewedAdminPermissions(grant.platformRoles[0])
  const overview = await loadAdminOverview({
    canReadBilling: hasWewedAdminPermission(adminPermissions, 'admin.billing.read'),
    canReadSupport: hasWewedAdminPermission(adminPermissions, 'admin.support.read'),
    canReadIncidents: hasWewedAdminPermission(adminPermissions, 'admin.incidents.read'),
    canReadAudit: false,
    canReadMembers: false,
  })

  return noStoreJson({
    success: true,
    scopeKind: 'system',
    platformRoles: grant.platformRoles,
    counts: {
      pendingOnboarding: Number(pendingOnboardingCount?.count ?? 0),
    },
    summary: overview.summary,
    analytics: overview.analytics,
    // Matches `/api/admin/overview` GET exactly: `accounts` (like `summary`/`analytics`) is not
    // itself gated by a supplementary `canReadX` permission — the base `admin.overview.read` grant
    // is the only gate, same as the PWA route's `accountRows` query which runs unconditionally.
    accounts: overview.accounts,
    supportCases: overview.supportCases,
    incidents: overview.incidents,
  })
}
