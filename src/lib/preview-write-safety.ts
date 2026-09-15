const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const PR202_UAT_BRANCH = 'feature/private-invitation-android-delivery-20260912'
const PR202_UAT_WEDDING_ID = 'wewed-pr202-uat-20260912'

export interface PreviewWriteSafetyInput {
  method: string
  weddingId: string
  vercelEnvironment?: string
  writablePreviewWeddingId?: string
  gitCommitRef?: string
}

/**
 * Preview deployments currently share the live database. Keep them readable,
 * but reject planner mutations unless the deployment is explicitly scoped to
 * one non-production UAT wedding.
 *
 * PR #202 predates the writable-preview environment variable on uat.wewed.pro,
 * so its dedicated synthetic wedding is allowed only on that exact preview
 * branch. This keeps every real wedding read-only while manual UAT completes.
 */
export function shouldBlockPreviewWrite({
  method,
  weddingId,
  vercelEnvironment = process.env.VERCEL_ENV,
  writablePreviewWeddingId = process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID,
  gitCommitRef = process.env.VERCEL_GIT_COMMIT_REF,
}: PreviewWriteSafetyInput): boolean {
  if (SAFE_HTTP_METHODS.has(method.toUpperCase())) return false
  if (vercelEnvironment !== 'preview') return false

  const allowedWeddingId = writablePreviewWeddingId?.trim()
  if (allowedWeddingId) return allowedWeddingId !== weddingId

  const isPr202SyntheticUat =
    gitCommitRef === PR202_UAT_BRANCH && weddingId === PR202_UAT_WEDDING_ID

  return !isPr202SyntheticUat
}

export const PREVIEW_WRITE_BLOCK_MESSAGE =
  'This preview is read-only because it shares live wedding data. Use production for approved edits or configure a dedicated preview wedding.'

/** Use for actual writes, including counters or token consumption behind GET. */
export function previewWeddingMutationBlocked(weddingId: string): boolean {
  return shouldBlockPreviewWrite({ method: 'POST', weddingId })
}
