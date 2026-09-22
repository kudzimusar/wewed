import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { readBearerNativeAccountSession, type NativeAccountSession } from '@/lib/native-account-session'
import { resolveProductionAuthority } from '@/lib/production-authority/resolver'
import type { WewedProductionAuthorityV1, WorkspaceGrant } from '@/lib/production-authority/contract'
import { hasWewedAdminPermission, resolveWewedAdminPermissions, type WewedAdminPermission } from '@/lib/wewed-admin-policy'

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 §6.
 *
 * Every native production-domain route (Planner/Couple/Coordinator/Vendor/Admin) must resolve its
 * scope the same way `/api/native/account/workspace` already does (Phase 5/6): a fresh
 * `resolveProductionAuthority` call on every request, a `grantId` accepted only as a selection
 * hint and matched against that fresh contract, and a client-supplied `engagementId` accepted only
 * once proven to belong to that fresh grant. A `weddingId`/`businessAccountId`/`vendorId` is never
 * accepted from the client as authority — callers must read it off the returned `grant`, not off
 * request input. This module exists so that rule cannot silently drift between domain routes.
 */

export function noStoreJson(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { 'cache-control': 'no-store' } })
}

export type NativeGrantContext = {
  session: NativeAccountSession
  authority: WewedProductionAuthorityV1
  grant: WorkspaceGrant
}

export type NativeGrantContextResult =
  | { ok: true; context: NativeGrantContext }
  | { ok: false; response: NextResponse }

/**
 * Resolves the caller's session and fresh grant for `grantId` (read from the `grantId` query
 * param unless `grantIdOverride` is given — POST/PATCH bodies pass their own copy).
 *
 * When `workspaceKind` is given, the grant is additionally required to be of that kind — this is
 * how a Couple-only route refuses a Planner grant id and vice versa, without trusting anything the
 * client claims about its own role.
 */
export async function resolveNativeGrantContext(
  request: NextRequest,
  options: { workspaceKind?: WorkspaceGrant['workspaceKind']; grantIdOverride?: string } = {},
): Promise<NativeGrantContextResult> {
  const session = readBearerNativeAccountSession(request)
  if (!session) {
    return { ok: false, response: noStoreJson({ success: false, code: 'SESSION_INVALID', error: 'Your session is no longer valid.' }, 401) }
  }

  const grantId = (options.grantIdOverride ?? request.nextUrl.searchParams.get('grantId'))?.trim() ?? ''
  if (!grantId) {
    return { ok: false, response: noStoreJson({ success: false, code: 'GRANT_REQUIRED', error: 'A workspace grant is required.' }, 400) }
  }

  const authority = await resolveProductionAuthority(session.accessUserId, { authUserId: session.authUserId })
  if (authority.accountStatus !== 'authorized') {
    return { ok: false, response: noStoreJson({ success: false, code: 'AUTHORITY_UNAVAILABLE', error: 'This account has no active workspace authority.' }, 403) }
  }

  const grant = authority.workspaceGrants.find((item) => item.grantId === grantId)
  if (!grant) {
    return { ok: false, response: noStoreJson({ success: false, code: 'GRANT_REVOKED', error: 'This workspace is no longer authorized.' }, 403) }
  }

  if (options.workspaceKind && grant.workspaceKind !== options.workspaceKind) {
    return { ok: false, response: noStoreJson({ success: false, code: 'GRANT_SCOPE_INVALID', error: 'This workspace is no longer authorized.' }, 403) }
  }

  return { ok: true, context: { session, authority, grant } }
}

/**
 * Validates a client-supplied engagement id against a Vendor grant's own fresh engagement list.
 * Returns 422 (not 403/404) so the client can clear only the stale engagement selection, matching
 * the distinction already established by `/api/native/account/workspace` (Phase 6 §5).
 */
export function requireGrantEngagement(
  grant: WorkspaceGrant,
  requestedEngagementId: string | null,
): { ok: true; engagementId: string | null } | { ok: false; response: NextResponse } {
  if (!requestedEngagementId) return { ok: true, engagementId: null }
  if (!grant.serviceEngagementIds.includes(requestedEngagementId)) {
    return {
      ok: false,
      response: noStoreJson({ success: false, code: 'ENGAGEMENT_INVALID', error: 'This engagement is not part of this workspace grant.' }, 422),
    }
  }
  return { ok: true, engagementId: requestedEngagementId }
}

/** A wedding-scoped grant (couple/planner/coordinator "wedding") with a non-null weddingId. */
export function requireWeddingScope(
  grant: WorkspaceGrant,
): { ok: true; weddingId: string } | { ok: false; response: NextResponse } {
  if (grant.scopeKind !== 'wedding' || !grant.weddingId) {
    return { ok: false, response: noStoreJson({ success: false, code: 'GRANT_SCOPE_INVALID', error: 'This workspace grant is not wedding-scoped.' }, 403) }
  }
  return { ok: true, weddingId: grant.weddingId }
}

/**
 * Mirrors `contextHasPermission` (`src/lib/wedding-access.ts`) exactly: a wedding-scoped grant's
 * `permissions[]` is already derived by `resolveWeddingPermissions` inside
 * `resolveProductionAuthority` — the SAME function the PWA's `getWeddingContext` calls — so this
 * performs the identical check without re-deriving anything. Couple/Planner/Coordinator share this
 * one check; the difference between them is entirely which permissions their WeddingMembership.role
 * resolves to (owner/admin get `*`; coordinator's set excludes budget.edit/vendors.edit — see
 * wedding-access.ts DEFAULT_ROLE_PERMISSIONS), never a workspaceKind branch in the route itself.
 */
export function requireGrantPermission(
  grant: WorkspaceGrant,
  permission: string,
): { ok: true } | { ok: false; response: NextResponse } {
  if (grant.permissions.includes('*') || grant.permissions.includes(permission)) {
    return { ok: true }
  }
  return {
    ok: false,
    response: noStoreJson({ success: false, code: 'PERMISSION_DENIED', error: `Forbidden — requires ${permission} permission.` }, 403),
  }
}

/**
 * Admin permission gate for an `admin:system` grant. `platformRoles[0]` is the effective role
 * `resolveProductionAuthority` already verified (entry gate + sanctioned role, contract §3.1) —
 * this calls the SAME `resolveWewedAdminPermissions` that `requireWewedAdmin` (cookie-based) uses,
 * so the permission vocabulary and role→permission mapping never drifts between transports. It
 * resolves the role's own baseline permission set only (no per-membership extra grants, which live
 * in a JSON column `requireWewedAdmin` reads from the cookie-session's business membership row —
 * not yet threaded through the production-authority grant; a real, honestly-tracked limitation).
 */
export function requireGrantAdminPermission(
  grant: WorkspaceGrant,
  permission: WewedAdminPermission,
): { ok: true } | { ok: false; response: NextResponse } {
  if (grant.workspaceKind !== 'admin' || grant.scopeKind !== 'system' || grant.platformRoles.length === 0) {
    return { ok: false, response: noStoreJson({ success: false, code: 'GRANT_SCOPE_INVALID', error: 'This workspace grant is not admin-scoped.' }, 403) }
  }
  const permissions = resolveWewedAdminPermissions(grant.platformRoles[0])
  if (!hasWewedAdminPermission(permissions, permission)) {
    return {
      ok: false,
      response: noStoreJson({ success: false, code: 'PERMISSION_DENIED', error: `This administrator role does not have ${permission} permission.` }, 403),
    }
  }
  return { ok: true }
}
