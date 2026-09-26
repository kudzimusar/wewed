/**
 * The qualification origin policy for tooling (the parity collector), identical to the native
 * productionPreview allowlist (apps/ios NativeServerLane.swift, apps/android NativeServerLane.kt):
 * https `wewed-<id>-11-11.vercel.app`, or http(s) loopback. Production is refused: live parity is
 * collected against the integration Preview, never against https://wewed.pro.
 */
export type QualificationOriginResult =
  | { ok: true; origin: string }
  | { ok: false; reason: 'missing' | 'malformed' | 'insecureScheme' | 'productionHost' | 'unexpectedComponents' | 'hostNotAllowlisted' }

const APPROVED_PREVIEW_HOST = /^wewed-[a-z0-9]([a-z0-9-]*[a-z0-9])?-11-11\.vercel\.app$/
const PRODUCTION_HOSTS = new Set(['wewed.pro', 'www.wewed.pro', 'api.wewed.pro'])

export function validateQualificationOrigin(raw: string | null | undefined): QualificationOriginResult {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) return { ok: false, reason: 'missing' }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  const scheme = url.protocol.replace(/:$/, '').toLowerCase()
  const host = url.hostname.toLowerCase()
  if (!host) return { ok: false, reason: 'malformed' }
  if (url.username || url.password || url.search || url.hash || !(url.pathname === '' || url.pathname === '/')) {
    return { ok: false, reason: 'unexpectedComponents' }
  }
  if (PRODUCTION_HOSTS.has(host)) return { ok: false, reason: 'productionHost' }
  if (host === '127.0.0.1' || host === 'localhost') {
    if (scheme !== 'http' && scheme !== 'https') return { ok: false, reason: 'insecureScheme' }
  } else {
    if (scheme !== 'https') return { ok: false, reason: 'insecureScheme' }
    if (url.port || !APPROVED_PREVIEW_HOST.test(host)) return { ok: false, reason: 'hostNotAllowlisted' }
  }
  return { ok: true, origin: `${scheme}://${host}${url.port ? `:${url.port}` : ''}` }
}
