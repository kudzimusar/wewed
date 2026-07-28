/* ============================================================
   privacy.ts — Privacy & Canon helpers for wewed
   ------------------------------------------------------------
   This module is **isomorphic**: pure helpers + label tables
   can be safely imported from client components. The one
   DB-touching function (`getWeddingPrivacy`) uses a dynamic
   import of `@/lib/db` so the Prisma Client is never pulled
   into a client bundle.

   Privacy levels
   ──────────────
   • public     — anyone with the URL may view
   • link_only  — only people holding the access token (or the couple)
   • private    — only the couple (admin) may view

   Canon seal
   ──────────
   A "Canon Sealed" wedding is preserved forever — its memory
   vault is locked against edits. Status is stored on the
   Wedding row (`canonSealed`, `canonSealedAt`, `subscriptionTier`).
   ============================================================ */

// ─── Types ───────────────────────────────────────────────────

export type PrivacyLevel = 'public' | 'link_only' | 'private'
export type SubscriptionTier = 'free' | 'canon' | 'forever'

/** A minimally-shaped wedding record for the canon helper. */
export interface PrivacyAwareWedding {
  privacy?: string | null
  canonSealed?: boolean | null
  canonSealedAt?: Date | string | null
  subscriptionTier?: string | null
}

// ─── Constants ───────────────────────────────────────────────

/** The flagship wedding slug — privacy defaults resolve to this. */
export const FLAGSHIP_WEDDING_SLUG = 'charity-and-kudzie'

/**
 * The flagship access token. Hardcoded for the MVP — couples will
 * be able to rotate this from the admin dashboard in a future phase.
 * For Charity & Kudzie's flagship: "charity-kudzie-2026".
 */
export const FLAGSHIP_ACCESS_TOKEN = 'charity-kudzie-2026'

/** Allowed values for `PrivacyLevel` — used for validation. */
export const PRIVACY_LEVELS: readonly PrivacyLevel[] = [
  'public',
  'link_only',
  'private',
] as const

/** Allowed values for `SubscriptionTier` — used for validation. */
export const SUBSCRIPTION_TIERS: readonly SubscriptionTier[] = [
  'free',
  'canon',
  'forever',
] as const

// ─── Label dictionaries ──────────────────────────────────────

export const PRIVACY_LABELS: Record<PrivacyLevel, string> = {
  public: 'Public',
  link_only: 'Link Only',
  private: 'Private Vault',
}

export const PRIVACY_DESCRIPTIONS: Record<PrivacyLevel, string> = {
  public: 'Anyone with the link can view this wedding.',
  link_only:
    'Only guests holding the access token from their invitation may view.',
  private: 'Only the couple can view this wedding.',
}

export const SUBSCRIPTION_LABELS: Record<SubscriptionTier, string> = {
  free: 'Free',
  canon: 'Canon',
  forever: 'Forever',
}

export const SUBSCRIPTION_DESCRIPTIONS: Record<SubscriptionTier, string> = {
  free: 'Standard wewed site — lives for the wedding season.',
  canon: 'Canon-sealed — preserved forever as a digital heirloom.',
  forever:
    'Forever plan — sealed vault, premium hosting, heirloom-grade storage.',
}

// ─── URL helpers (client-safe) ───────────────────────────────

/**
 * Read the `?token=` query parameter from the current URL.
 * Returns `null` on the server, or if no token is present.
 */
export function getAccessTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    return token && token.trim().length > 0 ? token.trim() : null
  } catch {
    return null
  }
}

/**
 * Strip the `?token=` query param from the current URL (in-place, replaces
 * history state). Useful after a visitor has unlocked the vault — keeps the
 * URL clean for sharing without leaking the token.
 *
 * No-op on the server.
 */
export function clearAccessTokenFromUrl(): void {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    url.searchParams.delete('token')
    window.history.replaceState({}, '', url.toString())
  } catch {
    /* ignore */
  }
}

/**
 * True if the current URL carries a `?token=` query param.
 */
export function urlHasAccessToken(): boolean {
  return getAccessTokenFromUrl() !== null
}

// ─── Access logic (pure) ─────────────────────────────────────

/**
 * The canonical access rule for a wedding.
 *
 *  • public    → always true
 *  • link_only → true if the visitor holds a valid access token, OR is the couple
 *  • private   → true only if the visitor is the couple (admin)
 *
 * Note: this function does NOT validate the token itself — that is the
 * caller's responsibility (see `POST /api/privacy/verify-token`). It only
 * answers "given the facts, is access allowed?".
 */
export function canAccessWedding(
  privacy: PrivacyLevel | string | null | undefined,
  hasAccessToken: boolean,
  isCouple: boolean,
): boolean {
  const level = (privacy ?? 'public') as PrivacyLevel
  switch (level) {
    case 'public':
      return true
    case 'link_only':
      return hasAccessToken || isCouple
    case 'private':
      return isCouple
    default:
      // Unknown privacy value — fall back to public (fail-open for safety)
      return true
  }
}

/**
 * True if the wedding has been canon-sealed (preserved forever).
 * Accepts either a boolean or a wedding-shaped object.
 */
export function isCanonSealed(
  wedding: PrivacyAwareWedding | boolean | null | undefined,
): boolean {
  if (typeof wedding === 'boolean') return wedding
  if (!wedding) return false
  return Boolean(wedding.canonSealed)
}

/**
 * Coerce an arbitrary string into a `PrivacyLevel`. Falls back to
 * `'public'` for unknown / missing values.
 */
export function asPrivacyLevel(
  value: string | null | undefined,
): PrivacyLevel {
  if (value && PRIVACY_LEVELS.includes(value as PrivacyLevel)) {
    return value as PrivacyLevel
  }
  return 'public'
}

/**
 * Coerce an arbitrary string into a `SubscriptionTier`. Falls back to
 * `'free'` for unknown / missing values.
 */
export function asSubscriptionTier(
  value: string | null | undefined,
): SubscriptionTier {
  if (value && SUBSCRIPTION_TIERS.includes(value as SubscriptionTier)) {
    return value as SubscriptionTier
  }
  return 'free'
}

/**
 * Constant-time-ish comparison of two strings. Used for token checks
 * so the response time does not leak the token's prefix.
 */
export function safeEqualString(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Verify a supplied access token against the flagship wedding's
 * expected token. Uses constant-time comparison.
 *
 * Pure / isomorphic — does not touch the DB. The flagship token is
 * hardcoded as `FLAGSHIP_ACCESS_TOKEN`. Platform-tier weddings will
 * store per-wedding tokens in the DB (Phase 5).
 */
export function verifyFlagshipAccessToken(token: string): boolean {
  if (typeof token !== 'string' || token.length === 0) return false
  return safeEqualString(token.trim(), FLAGSHIP_ACCESS_TOKEN)
}

// ─── DB helpers (server-only — dynamic import) ───────────────

/**
 * Read a wedding's privacy level from the database.
 *
 * Server-only — uses a dynamic import of `@/lib/db` so this module
 * remains safe to import from client bundles (only callers that
 * actually invoke this function will pull in Prisma).
 *
 * Returns `'public'` if the wedding is missing, so a missing
 * flagship record fails open (visible) rather than locking the
 * couple out of their own site during a seed mishap.
 */
export async function getWeddingPrivacy(
  weddingId: string,
): Promise<PrivacyLevel> {
  try {
    const { db } = await import('@/lib/db')
    const wedding = await db.wedding.findUnique({
      where: { id: weddingId },
      select: { privacy: true },
    })
    return asPrivacyLevel(wedding?.privacy ?? null)
  } catch (error) {
    console.error('[privacy.getWeddingPrivacy] error:', error)
    // Fail open — never lock the couple out due to an internal error
    return 'public'
  }
}

/**
 * Read the flagship wedding's privacy settings + canon seal status.
 * Returns a structured snapshot suitable for the GET /api/privacy route.
 *
 * Server-only.
 */
export async function getFlagshipPrivacySnapshot(): Promise<{
  weddingId: string | null
  privacy: PrivacyLevel
  canonSealed: boolean
  canonSealedAt: Date | string | null
  subscriptionTier: SubscriptionTier
}> {
  try {
    const { db } = await import('@/lib/db')
    const wedding = await db.wedding.findFirst({
      where: { slug: FLAGSHIP_WEDDING_SLUG },
      select: {
        id: true,
        privacy: true,
        canonSealed: true,
        canonSealedAt: true,
        subscriptionTier: true,
      },
    })
    return {
      weddingId: wedding?.id ?? null,
      privacy: asPrivacyLevel(wedding?.privacy ?? null),
      canonSealed: Boolean(wedding?.canonSealed),
      canonSealedAt: wedding?.canonSealedAt ?? null,
      subscriptionTier: asSubscriptionTier(wedding?.subscriptionTier ?? null),
    }
  } catch (error) {
    console.error('[privacy.getFlagshipPrivacySnapshot] error:', error)
    return {
      weddingId: null,
      privacy: 'public',
      canonSealed: false,
      canonSealedAt: null,
      subscriptionTier: 'free',
    }
  }
}

// ─── Bundle default export ───────────────────────────────────

const privacy = {
  FLAGSHIP_WEDDING_SLUG,
  FLAGSHIP_ACCESS_TOKEN,
  PRIVACY_LEVELS,
  SUBSCRIPTION_TIERS,
  PRIVACY_LABELS,
  PRIVACY_DESCRIPTIONS,
  SUBSCRIPTION_LABELS,
  SUBSCRIPTION_DESCRIPTIONS,
  getAccessTokenFromUrl,
  clearAccessTokenFromUrl,
  urlHasAccessToken,
  canAccessWedding,
  isCanonSealed,
  asPrivacyLevel,
  asSubscriptionTier,
  safeEqualString,
  verifyFlagshipAccessToken,
  getWeddingPrivacy,
  getFlagshipPrivacySnapshot,
}

export default privacy
