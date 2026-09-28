import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const component = readFileSync('src/app/guest-handoff/[slug]/guest-browser-handoff.tsx', 'utf8')

describe('QRO07 production AT01: native Gifts/Couple Website handoff stays in the browser', () => {
  test('lands with a client-side transition, never a top-level navigation to an App Link path', () => {
    // wewed.pro/w/* is a verified Android App Link. A full navigation from this intent-launched
    // page was handed back to the installed Wewed app, so the Guest never reached the site.
    expect(component).toContain("import { useRouter } from 'next/navigation'")
    expect(component).toContain('router.replace(path)')
    expect(component).toContain('router.replace(gateway)')
    expect(component).not.toMatch(/window\.location\.(replace|assign)\(/)
    expect(component).not.toMatch(/window\.location\.href\s*=/)
  })

  test('still follows only a same-origin wedding path and still removes the fragment secret first', () => {
    expect(component).toContain("data.path.startsWith('/w/') ? data.path : gateway")
    expect(component).toContain("window.history.replaceState(null, '', window.location.pathname)")
  })
})
