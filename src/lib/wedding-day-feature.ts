import { weddingDayKeyPreflight } from '@/lib/wedding-day-key-preflight'

/**
 * Phase 11A: Wedding Day / WW2 Feature Flag
 *
 * The feature is disabled by default.
 * Activation requires WEWED_WEDDING_DAY_WW2_ENABLED='true' or '1'.
 * When disabled: no pass is issued, no manifest is served, and no check-in write is accepted.
 */

export function isWeddingDayWW2Enabled(): boolean {
  const raw = process.env.WEWED_WEDDING_DAY_WW2_ENABLED?.trim().toLowerCase()
  return raw === 'true' || raw === '1'
}


/**
 * The feature flag authorizes code execution, but never substitutes for key readiness.
 * All production-shaped WW2 surfaces require BOTH independent P-256 signing roles.
 */
export function assertWeddingDayWW2RuntimeReady(): void {
  if (!isWeddingDayWW2Enabled()) {
    throw new Error('WEDDING_DAY_DISABLED')
  }
  if (!weddingDayKeyPreflight().ok) {
    throw new Error('WEDDING_DAY_KEY_CONFIGURATION_INVALID')
  }
}
