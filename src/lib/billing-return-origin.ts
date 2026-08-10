import 'server-only'

import { publicOrigin } from '@/lib/public-origin'

const VERCEL_PREVIEW_SUFFIX = ['.vercel', '.app'].join('')

function trustedVercelPreviewOrigin(value: string | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null

  try {
    const candidate = new URL(raw.includes('://') ? raw : `https://${raw}`)
    if (candidate.protocol !== 'https:') return null
    if (!candidate.hostname.endsWith(VERCEL_PREVIEW_SUFFIX)) return null
    return candidate.origin
  } catch {
    return null
  }
}

/**
 * Stripe test-mode sessions created from Vercel Preview must return to that
 * Preview, not cross into the Production cookie/session boundary. Public auth,
 * email and canonical links continue to use publicOrigin().
 */
export function billingReturnOrigin(): string {
  if (process.env.VERCEL_ENV === 'production') return publicOrigin()

  if (process.env.VERCEL_ENV === 'preview') {
    const previewOrigin =
      trustedVercelPreviewOrigin(process.env.VERCEL_BRANCH_URL) ||
      trustedVercelPreviewOrigin(process.env.VERCEL_URL)

    if (!previewOrigin) {
      throw new Error('[wewed] Preview billing requires a trusted Vercel preview origin.')
    }
    return previewOrigin
  }

  return publicOrigin()
}
