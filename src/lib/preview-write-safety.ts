const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export interface PreviewWriteSafetyInput {
  method: string
  weddingId: string
  vercelEnvironment?: string
  writablePreviewWeddingId?: string
}

export function shouldBlockPreviewWrite({
  method,
  weddingId,
  vercelEnvironment = process.env.VERCEL_ENV,
  writablePreviewWeddingId = process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID,
}: PreviewWriteSafetyInput): boolean {
  if (SAFE_HTTP_METHODS.has(method.toUpperCase())) return false
  if (vercelEnvironment !== 'preview') return false

  const allowedWeddingId = writablePreviewWeddingId?.trim()
  return !allowedWeddingId || allowedWeddingId !== weddingId
}

export const PREVIEW_WRITE_BLOCK_MESSAGE =
  'This preview is read-only because it shares live wedding data. Use production for approved edits or configure a dedicated preview wedding.'
