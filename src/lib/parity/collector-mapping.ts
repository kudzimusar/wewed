/**
 * Pure mappings used by the live parity collector (scripts/parity/wewed-parity.ts), kept here so
 * they are regression-tested (QRO02B1).
 */
import type { ParityActivationBlocker, ParityClient } from '@/lib/parity/wewed-parity-v1'

type Json = Record<string, any>

/**
 * WewedProductionAuthorityV1 carries the account identity at `authority.identity.accessUserId`
 * (src/lib/production-authority/contract.ts). QRO02B's first live run read `authority.accessUserId`
 * and silently recorded null.
 */
export function nativeAccessUserId(authorityResponse: Json): string | null {
  const id = authorityResponse?.authority?.identity?.accessUserId
  return typeof id === 'string' && id.trim() ? id : null
}

/**
 * Wedding Day activation from an unauthenticated `GET /api/wedding-day/pass` — no Guest cookie, so
 * it cannot issue anything. The route checks the feature before any session, so a disabled or
 * misconfigured Wedding Day answers with its own code; an enabled one answers 401.
 */
export function weddingDayBlockerFromPassProbe(status: number, body: Json): ParityActivationBlocker | null {
  if (status === 503 && body?.code === 'WEDDING_DAY_DISABLED') {
    return { kind: 'wedding-day-activation', state: 'BLOCKED-ACTIVATION', evidence: 'WEDDING_DAY_DISABLED' }
  }
  if (status === 503 && body?.code === 'WEDDING_DAY_KEY_CONFIGURATION_INVALID') {
    return { kind: 'wedding-day-activation', state: 'BLOCKED-ACTIVATION', evidence: 'WEDDING_DAY_KEY_CONFIGURATION_INVALID' }
  }
  return null
}

/**
 * Default actor-specific client requirements for a Guest + account run. The Guest is observed by
 * the browser and the two apps; it has no account identity, so never `native-api`. The account
 * and its view of the Guest are observed through the browser and the native account API.
 */
export function defaultRequiredClientsByLabel(accountLabel: string | null, hasGuest: boolean): Record<string, ParityClient[]> {
  const requirements: Record<string, ParityClient[]> = {}
  if (hasGuest) requirements.G = ['desktop', 'ios', 'android']
  if (accountLabel) {
    requirements[accountLabel] = ['desktop', 'native-api']
    if (hasGuest) requirements[`G-VIA-${accountLabel}`] = ['desktop', 'native-api']
  }
  return requirements
}
