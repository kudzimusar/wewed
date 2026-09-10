export type WewedLinkResolution = {
  canonicalUrl: string
  nativePath: string | null
  requiresAuthentication: boolean
  secureWebOnly: boolean
}

function fromCustomScheme(input: string) {
  if (!input.startsWith('wewed://')) return input
  const value = input.slice('wewed://'.length)
  const slash = value.indexOf('/')
  const host = slash >= 0 ? value.slice(0, slash) : value
  const remainder = slash >= 0 ? value.slice(slash) : ''
  return `https://wewed.pro/${host}${remainder}`
}

function canonicalize(input: string) {
  const normalized = fromCustomScheme(input)
  const url = new URL(normalized, 'https://wewed.pro')
  if (url.hostname !== 'wewed.pro' && url.hostname !== 'www.wewed.pro') {
    return new URL('https://wewed.pro/app')
  }
  url.protocol = 'https:'
  url.hostname = 'wewed.pro'
  return url
}

export function resolveWewedLink(input: string): WewedLinkResolution {
  const url = canonicalize(input)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const segments = path.split('/').filter(Boolean)

  if (path === '/' || path === '/app') {
    return { canonicalUrl: url.toString(), nativePath: '/(tabs)', requiresAuthentication: true, secureWebOnly: false }
  }
  if (path === '/planner' || path.startsWith('/planner/')) {
    return { canonicalUrl: url.toString(), nativePath: '/(tabs)/plan', requiresAuthentication: true, secureWebOnly: false }
  }
  if (path === '/messages') {
    return { canonicalUrl: url.toString(), nativePath: '/(tabs)/messages', requiresAuthentication: true, secureWebOnly: false }
  }
  if (segments[0] === 'messages' && segments[1]) {
    return { canonicalUrl: url.toString(), nativePath: `/messages/${encodeURIComponent(segments[1])}`, requiresAuthentication: true, secureWebOnly: false }
  }
  if (path === '/vendors' || path === '/vendor') {
    return { canonicalUrl: url.toString(), nativePath: '/(tabs)/marketplace', requiresAuthentication: false, secureWebOnly: false }
  }
  if ((segments[0] === 'vendors' || segments[0] === 'vendor') && segments[1]) {
    return { canonicalUrl: url.toString(), nativePath: `/providers/${encodeURIComponent(segments[1])}`, requiresAuthentication: false, secureWebOnly: false }
  }
  if (path === '/bookings' || path === '/booking') {
    return { canonicalUrl: url.toString(), nativePath: '/bookings', requiresAuthentication: true, secureWebOnly: false }
  }
  if ((segments[0] === 'bookings' || segments[0] === 'booking') && segments[1]) {
    return { canonicalUrl: url.toString(), nativePath: `/bookings/${encodeURIComponent(segments[1])}`, requiresAuthentication: true, secureWebOnly: false }
  }

  const secureWebOnly =
    path.startsWith('/contracts/review/') ||
    path.startsWith('/contracts/verify/') ||
    path.startsWith('/invite/') ||
    path.startsWith('/rsvp/') ||
    path.startsWith('/contribute/') ||
    path.startsWith('/wedding/')

  return {
    canonicalUrl: url.toString(),
    nativePath: null,
    requiresAuthentication: false,
    secureWebOnly,
  }
}

export function handoffPath(input: string) {
  const resolved = resolveWewedLink(input)
  return `/handoff?url=${encodeURIComponent(resolved.canonicalUrl)}`
}
