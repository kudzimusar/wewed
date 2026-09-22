import 'server-only'

/**
 * Primary signer for all newly-issued Wewed guest/invitation session credentials.
 *
 * Production requires a dedicated WEWED_SESSION_SECRET. The historical
 * SUPABASE_SERVICE_ROLE_KEY fallback is retained only as a verifier for legacy
 * v1 cookies during the migration window; it is never used to sign new
 * production credentials once the dedicated secret is configured.
 */
export function primarySessionSigningSecret(): string {
  const dedicated = process.env.WEWED_SESSION_SECRET?.trim()
  const isProduction = process.env.NODE_ENV === 'production' && !isLocalCiBrowserMode()

  if (isProduction) {
    if (!dedicated) {
      throw new Error('[wewed] Missing dedicated WEWED_SESSION_SECRET in production.')
    }
    return dedicated
  }

  const secret = dedicated || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!secret) {
    throw new Error('[wewed] Missing WEWED_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY.')
  }
  return secret
}

/**
 * Verification keys for pre-v2 cookies.
 *
 * Before Guest Session v2, production could sign these cookies with
 * SUPABASE_SERVICE_ROLE_KEY when WEWED_SESSION_SECRET was absent. Rotating to a
 * dedicated secret must not log every remembered guest out at once. Therefore
 * legacy v1 formats may verify against the old service-role signer as a
 * temporary migration compatibility key.
 *
 * New v2 guest-session credentials MUST use only primarySessionSigningSecret().
 */
export function legacySessionVerificationSecrets(): string[] {
  const primary = primarySessionSigningSecret()
  const legacy = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return legacy && legacy !== primary ? [primary, legacy] : [primary]
}

function isLocalCiBrowserMode(): boolean {
  const databaseUrl = process.env.DATABASE_URL?.toLowerCase() ?? ''
  const localDatabase =
    databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')

  return (
    process.env.WEWED_E2E_MODE === '1' &&
    process.env.CI === 'true' &&
    !process.env.VERCEL &&
    localDatabase
  )
}
