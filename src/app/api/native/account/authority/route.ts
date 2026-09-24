import { NextRequest, NextResponse } from 'next/server'
import { readBearerNativeAccountSession } from '@/lib/native-account-session'
import { resolveProductionAuthority } from '@/lib/production-authority/resolver'

function noStore(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { 'cache-control': 'no-store' } })
}

/**
 * Native production authority — master plan Phase 5.
 *
 * Read-only. Verifies the native identity session, then re-resolves `WewedProductionAuthorityV1`
 * for that account on every call. Writes nothing: no pending-membership acceptance, no
 * `currentWeddingId` mutation, no context selection. The full contract is returned as-is —
 * `workspaceGrants[]` is never flattened into one role, and no wedding/business/vendor context is
 * selected on the caller's behalf. A non-`authorized` `accountStatus` is still a 200 response,
 * exactly mirroring the resolver's own fail-closed evidence redaction (contract §9.2): the native
 * client denies workspace access on anything other than `authorized`, the same way it would deny
 * an unrecognised contract or version.
 */
export async function GET(request: NextRequest) {
  const session = readBearerNativeAccountSession(request)
  if (!session) {
    return noStore({ success: false, error: 'Your session is no longer valid.' }, 401)
  }

  const authority = await resolveProductionAuthority(session.accessUserId, {
    authUserId: session.authUserId,
  })

  return noStore({ success: true, authority })
}
