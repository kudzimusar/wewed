const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
export interface PreviewWriteSafetyInput {
  method: string
  weddingId: string
  vercelEnvironment?: string
  writablePreviewWeddingId?: string
  /** @deprecated Branch identity never authorizes preview writes. */
  gitCommitRef?: string
}

/**
 * Preview deployments currently share the live database. Keep them readable,
 * but reject planner mutations unless the deployment is explicitly scoped to
 * one non-production UAT wedding.
 *
 * Preview branch identity is never an authorization boundary. A preview may
 * mutate data only when WEWED_PREVIEW_WRITABLE_WEDDING_ID explicitly names
 * the wedding being mutated. This keeps all other production-backed preview
 * data read-only, including stale or forgotten PR branches.
 */
export function shouldBlockPreviewWrite({
  method,
  weddingId,
  vercelEnvironment = process.env.VERCEL_ENV,
  writablePreviewWeddingId = process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID,
  gitCommitRef: _gitCommitRef = process.env.VERCEL_GIT_COMMIT_REF,
}: PreviewWriteSafetyInput): boolean {
  if (SAFE_HTTP_METHODS.has(method.toUpperCase())) return false
  if (vercelEnvironment !== 'preview') return false

  const allowedWeddingId = writablePreviewWeddingId?.trim()
  if (!allowedWeddingId) return true

  return allowedWeddingId !== weddingId
}

export const PREVIEW_WRITE_BLOCK_MESSAGE =
  'This preview is read-only because it shares live wedding data. Use production for approved edits or configure a dedicated preview wedding.'

/** Use for actual writes, including counters or token consumption behind GET. */
export function previewWeddingMutationBlocked(weddingId: string): boolean {
  return shouldBlockPreviewWrite({ method: 'POST', weddingId })
}

export const PREVIEW_WRITE_BLOCKED_CODE = 'PREVIEW_WRITE_BLOCKED'

export class PreviewWriteBlockedError extends Error {
  readonly code = PREVIEW_WRITE_BLOCKED_CODE
  constructor(readonly weddingId: string) {
    super(PREVIEW_WRITE_BLOCKED_CODE)
    this.name = 'PreviewWriteBlockedError'
  }
}

export function isPreviewWriteBlockedError(error: unknown): error is PreviewWriteBlockedError {
  return error instanceof PreviewWriteBlockedError
}

/**
 * Domain-layer backstop. Every function that mutates wedding-scoped Wedding Day, Wedding Pass,
 * Gate or RSVP state calls this with the authoritative (server-resolved) wedding ID immediately
 * before its first write, independent of HTTP method or caller. A route that forgets its own
 * guard, or a GET that issues a credential, therefore still cannot mutate a production-backed
 * wedding from Preview. Routes translate the error to 423 PREVIEW_WRITE_BLOCKED.
 */
export function assertPreviewWeddingMutationAllowed(weddingId: string): void {
  if (previewWeddingMutationBlocked(weddingId)) throw new PreviewWriteBlockedError(weddingId)
}

/**
 * Account-level sign-in bookkeeping — `User.lastLoginAt`, the `UserProfile` sync and the
 * `User.currentWeddingId` landing preference — is not wedding-scoped, so the writable-wedding
 * allowlist cannot authorize it. Preview never performs it: authenticating a real account against
 * a Preview must not mutate that account. The signed session cookie remains the per-request
 * wedding authority, so wedding switching still works without the landing-preference write.
 */
export function previewAccountBookkeepingSuppressed(
  vercelEnvironment: string | undefined = process.env.VERCEL_ENV,
): boolean {
  return vercelEnvironment === 'preview'
}

export type PendingMembershipAcceptanceScope =
  | { mode: 'all' }
  | { mode: 'wedding'; weddingId: string }
  | { mode: 'none' }

/**
 * Accepting a pending (`invited`) WeddingMembership changes a real relationship on that wedding.
 * Outside Preview every pending invitation of the signing-in account is accepted (the existing
 * production lifecycle). In Preview only an invitation to the one writable UAT wedding may be
 * accepted; with no writable wedding configured nothing is accepted.
 */
export function pendingMembershipAcceptanceScope(
  vercelEnvironment: string | undefined = process.env.VERCEL_ENV,
  writablePreviewWeddingId: string | undefined = process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID,
): PendingMembershipAcceptanceScope {
  if (vercelEnvironment !== 'preview') return { mode: 'all' }
  const weddingId = writablePreviewWeddingId?.trim()
  return weddingId ? { mode: 'wedding', weddingId } : { mode: 'none' }
}
