/**
 * QRO 02 §29 — safe network evidence for live parity runs. Pure helpers shared by the collector.
 * Evidence carries a redacted path, the status and a classification — never headers, cookies,
 * bodies, tokens or credential-bearing query values.
 */

type Json = Record<string, any>

/** Keeps query keys, replaces every value (tokens, grant IDs, emails alike). */
export function redactPath(path: string): string {
  const [base, query] = path.split('?', 2)
  if (!query) return base
  const keys = query.split('&').map((pair) => pair.split('=')[0]).filter(Boolean)
  return `${base}?${keys.map((key) => `${key}=<redacted>`).join('&')}`
}

/**
 * Distinguishes Vercel Deployment Protection (a 302 to vercel.com for plain requests, a 401 JSON
 * `Protected deployment` for API-style requests) from the application's own answers, so a
 * protected Preview can never be mistaken for a live route or a Wedding Day state.
 */
export function classifyParityResponse(status: number, body: Json, location: string | null): string {
  if (status >= 300 && status < 400) {
    try {
      const host = location ? new URL(location).hostname : 'unknown'
      return host === 'vercel.com' ? 'vercel-deployment-protection' : `redirect:${host}`
    } catch {
      return 'redirect'
    }
  }
  // Vercel Deployment Protection answers API-style requests with 401 JSON rather than a redirect.
  if (body.protection || body.error?.message === 'Protected deployment') return 'vercel-deployment-protection'
  if (typeof body.code === 'string') return body.code
  if (body.success === true) return body.authorized === false ? 'unauthorized' : 'success'
  if (body.success === false) return 'refused'
  return status >= 500 ? 'server-error' : 'no-json'
}
