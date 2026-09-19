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
