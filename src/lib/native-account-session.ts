import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { primarySessionSigningSecret } from '@/lib/session-signing-secret'

/**
 * Native account identity session — master plan Phase 5.
 *
 * This credential proves ONE thing only: that its holder has already verified a Wewed/Supabase
 * account via password sign-in. It carries no role, no wedding, no business, no grant of any
 * kind. Every workspace authority decision is re-resolved server-side, on every use, through
 * `resolveProductionAuthority` (WewedProductionAuthorityV1) — never read out of this token.
 *
 * This is deliberately a NEW, narrow transport, not the existing `AppSession` (whose flat `role`
 * and single `activeWeddingId` are themselves treated as authority by browser code) and not a
 * bearer re-export of it. A stored token is not authority by itself (master plan §8): it only
 * re-identifies the account so the authority endpoint has someone to resolve grants for.
 *
 * Guest Session v2 remains completely separate. This file must never be imported by, or import,
 * anything under the Guest identity path.
 */

export const NATIVE_ACCOUNT_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60

export interface NativeAccountSession {
  version: 1
  accessUserId: string
  authUserId: string
  email: string
  expiresAt: number
}

function sign(encodedPayload: string): string {
  return createHmac('sha256', primarySessionSigningSecret())
    .update(encodedPayload)
    .digest('base64url')
}

function signaturesMatch(actual: string, expected: string): boolean {
  try {
    const actualBuffer = Buffer.from(actual, 'base64url')
    const expectedBuffer = Buffer.from(expected, 'base64url')
    return (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    )
  } catch {
    return false
  }
}

export function createNativeAccountSessionToken(input: {
  accessUserId: string
  authUserId: string
  email: string
}): string {
  const payload: NativeAccountSession = {
    version: 1,
    accessUserId: input.accessUserId,
    authUserId: input.authUserId,
    email: input.email,
    expiresAt: Date.now() + NATIVE_ACCOUNT_SESSION_TTL_SECONDS * 1000,
  }

  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

export function verifyNativeAccountSessionToken(token: string): NativeAccountSession | null {
  try {
    const [encoded, signature, extra] = token.split('.')
    if (!encoded || !signature || extra) return null
    if (!signaturesMatch(signature, sign(encoded))) return null

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as Record<string, unknown>

    if (
      payload.version !== 1 ||
      typeof payload.accessUserId !== 'string' ||
      !payload.accessUserId ||
      typeof payload.authUserId !== 'string' ||
      !payload.authUserId ||
      typeof payload.email !== 'string' ||
      !payload.email ||
      typeof payload.expiresAt !== 'number' ||
      payload.expiresAt <= Date.now() ||
      // Defense-in-depth: this transport proves identity only. Reject outright — never merely
      // ignore — any payload that also carries a workspace-authority-shaped field, so a future
      // signer bug can never smuggle authority through this credential (master plan §5).
      'role' in payload ||
      'weddingId' in payload ||
      'grantId' in payload ||
      'workspaceKind' in payload ||
      'workspaceGrants' in payload ||
      // Phase 10 adds a separate Gate operational-authority axis. The identity token must remain
      // identity-only across that axis as well: even a validly-signed future payload carrying
      // Gate scope/capabilities is rejected rather than silently ignored.
      'operationalGrants' in payload ||
      'gateContextSelection' in payload ||
      'gateId' in payload ||
      'assignmentId' in payload ||
      'operatorUserId' in payload ||
      'capabilities' in payload
    ) {
      return null
    }

    return payload as unknown as NativeAccountSession
  } catch {
    return null
  }
}

export function readBearerNativeAccountSession(
  request: NextRequest,
): NativeAccountSession | null {
  const header = request.headers.get('authorization')
  if (!header || !header.startsWith('Bearer ')) return null
  return verifyNativeAccountSessionToken(header.slice('Bearer '.length).trim())
}
