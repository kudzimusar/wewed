export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path, 'https://wewed.pro')
    const pathname = url.pathname

    if (pathname === '/' || pathname.startsWith('/app')) return '/'
    if (pathname.startsWith('/planner')) return '/(tabs)/plan'
    if (pathname.startsWith('/messages')) return '/(tabs)/messages'
    if (pathname.startsWith('/vendor')) return '/(tabs)/marketplace'

    const canonical = url.protocol === 'https:' && url.hostname === 'wewed.pro'
      ? url.toString()
      : `https://wewed.pro${pathname}${url.search}`
    return `/handoff?url=${encodeURIComponent(canonical)}`
  } catch {
    return '/handoff'
  }
}
