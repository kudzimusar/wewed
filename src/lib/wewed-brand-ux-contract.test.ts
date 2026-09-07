import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Wewed sitewide brand UX contract', () => {
  test('official identity is sourced from the approved master artwork rather than a redrawn glyph', () => {
    const logo = source('public/logo.svg')
    const brand = source('src/components/brand/wewed-brand.tsx')
    expect(logo).toContain('/brand/wewed-mark-master.jpg')
    expect(logo).toContain('Approved Wewed W-heart and rings master brand mark')
    expect(brand).toContain("const MARK_SRC = '/brand/wewed-mark-master.jpg'")
    expect(brand).toContain("const WORDMARK_SRC = '/brand/wewed-wordmark-master.jpg'")
    expect(brand).toContain('data-wewed-brand-source="approved-master"')
    expect(brand).not.toContain('<svg')
    expect(brand).not.toContain('font-serif font-semibold')
  })

  test('public navigation and footer use the shared approved-master Wewed brand primitive', () => {
    const shell = source('src/components/public/public-platform-shell.tsx')
    expect(shell).toContain("import { WewedBrand } from '@/components/brand/wewed-brand'")
    expect(shell.match(/<WewedBrand/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
    expect(shell).not.toContain('HeartHandshake')
  })

  test('private workspaces inherit branding without blocking workspace navigation', () => {
    const layout = source('src/app/layout.tsx')
    const dock = source('src/components/brand/workspace-brand-dock.tsx')
    expect(layout).toContain('<WorkspaceBrandDock />')
    for (const route of ['/planner', '/couple', '/vendor', '/admin', '/messages', '/vault', '/billing']) {
      expect(dock).toContain(`'${route}'`)
    }
    expect(dock).toContain('pointer-events-none')
    expect(dock).toContain('aria-hidden="true"')
    expect(dock).not.toContain('z-[360]')
    expect(dock).not.toContain('<Link')
  })

  test('registration and browser/app metadata use the same approved mark path', () => {
    const registration = source('src/app/register/page.tsx')
    const manifest = source('public/manifest.json')
    const layout = source('src/app/layout.tsx')
    expect(registration).toContain('<WewedBrand')
    expect(manifest).toContain('"src": "/logo.svg"')
    expect(layout).toContain("url: '/logo.svg'")
  })

  test('brand hardening remains additive and uses the established palette', () => {
    const css = source('src/app/brand-system.css')
    expect(css).toContain('#BF9B5F')
    expect(css).toContain('#1A1410')
    expect(css).toContain('.wewed-premium-surface')
    expect(css).toContain('.wewed-workspace-brand-dock')
  })
})
