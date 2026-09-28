import 'server-only'

import type { NextRequest } from 'next/server'
import { readBearerNativeAccountSession } from '@/lib/native-account-session'
import { noStoreJson } from '@/lib/native-domain-context'
import { resolveProductionAuthority } from '@/lib/production-authority/resolver'
import type { GateCapability, OperationalGrant, WewedProductionAuthorityV1 } from '@/lib/production-authority/contract'
import { requireGateOperationalGrant } from '@/lib/gate-authority'

export type NativeGateOperationalContext = {
  authority: WewedProductionAuthorityV1
  grant: OperationalGrant
}

export type NativeGateOperationalContextResult =
  | { ok: true; context: NativeGateOperationalContext }
  | { ok: false; response: Response }

/**
 * Re-resolves account authority on every call, then requires the exact selected operational grant.
 * A caller never submits weddingId/gateId/operatorUserId as authority; those values come only from
 * the freshly-resolved server grant.
 */
export async function resolveNativeGateOperationalContext(
  request: NextRequest,
  options: { grantIdOverride?: string; requiredCapability?: GateCapability } = {},
): Promise<NativeGateOperationalContextResult> {
  const session = readBearerNativeAccountSession(request)
  if (!session) {
    return {
      ok: false,
      response: noStoreJson(
        { success: false, code: 'SESSION_INVALID', error: 'Your session is no longer valid.' },
        401,
      ),
    }
  }

  const grantId = (options.grantIdOverride ?? request.nextUrl.searchParams.get('grantId'))?.trim() ?? ''
  if (!grantId) {
    return {
      ok: false,
      response: noStoreJson(
        { success: false, code: 'GATE_GRANT_REQUIRED', error: 'A gate operational grant is required.' },
        400,
      ),
    }
  }

  const authority = await resolveProductionAuthority(session.accessUserId, {
    authUserId: session.authUserId,
  })
  const grant = requireGateOperationalGrant({
    authority,
    grantId,
    requiredCapability: options.requiredCapability,
  })

  if (!grant) {
    return {
      ok: false,
      response: noStoreJson(
        { success: false, code: 'GATE_GRANT_REVOKED', error: 'This gate assignment is no longer authorized.' },
        403,
      ),
    }
  }

  return { ok: true, context: { authority, grant } }
}
