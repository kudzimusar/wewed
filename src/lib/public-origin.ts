const PRODUCTION_ORIGIN = 'https://wewed.pro'

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
}

export function publicOrigin(): string {
  if (process.env.NODE_ENV === 'production') return PRODUCTION_ORIGIN

  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) {
    const normalized = normalizeOrigin(configured)
    if (normalized) return normalized
  }

  return 'http://localhost:3000'
}

export function publicUrl(path = '/'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return new URL(normalizedPath, `${publicOrigin()}/`).toString()
}

export { PRODUCTION_ORIGIN }
