import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Wewed sitewide brand UX contract', () => {
  test('official W-heart identity replaces the legacy generic glyph', () => {
    const logo = source('public/logo.svg')
    expect(logo).toContain('Wewed intertwined W-heart wedding mark')
    expect(logo).toContain('#BF9B5F')
    expect(logo).toContain('#1A1410')
    expect(logo).not.toContain('class="z-breathe"')
  })

  test('public navigation and footer use the shared Wewed brand primitive', () => {
    const shell = source('src/components/public/public-platform-shell.tsx')
    expect(shell).toContain("import { WewedBrand } from '@/components/brand/wewed-brand'")
    expect(shell.match(/<WewedBrand/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
    expect(shell).not.toContain('HeartHandshake')
  })

  test('private workspaces inherit one route-aware brand dock', () => {
    const layout = source('src/app/layout.tsx')
    const dock = source('src/components/brand/workspace-brand-dock.tsx')
    expect(layout).toContain('<WorkspaceBrandDock />')
    for (const route of ['/planner', '/couple', '/vendor', '/admin', '/messages', '/vault', '/billing']) {
      expect(dock).toContain(`'${route}'`)
    }
  })

  test('standalone registration and PWA metadata use the same identity', () => {
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
