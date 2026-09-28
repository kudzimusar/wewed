import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')

describe('invitation social preview trust surface', () => {
  test('brands invitation previews as Wewed without exposing Guest credentials', () => {
    const page = source('src/app/invite/[slug]/open/page.tsx')
    const image = source('src/app/invite/opengraph-image.tsx')
    const brand = source('src/lib/wewed-brand.ts')

    expect(brand).toContain("WEWED_BRAND_NAME = 'Wewed'")
    expect(brand).toContain("WEWED_BRAND_PAYOFF = 'where love lives forever.'")
    expect(page).toContain('WEWED_INVITATION_PREVIEW_TITLE')
    expect(page).toContain("siteName: 'Wewed'")
    expect(page).toContain("url: '/invite/opengraph-image'")
    expect(page).toContain('robots: { index: false, follow: false }')
    expect(page).not.toContain('guestName')
    expect(page).not.toContain('rsvpToken')
    expect(page).not.toContain("searchParams.get('rsvp')")
    expect(image).toContain('wewed.pro')
    expect(image).toContain('WEWED_BRAND_PAYOFF')
  })

  test('preview copy identifies the wedding but not the invited person', () => {
    const page = source('src/app/invite/[slug]/open/page.tsx')
    expect(page).toContain('wedding.title')
    expect(page).toContain('wedding.date')
    expect(page).toContain('Open your secure Wewed digital invitation and RSVP.')
    expect(page).not.toContain('guest.email')
    expect(page).not.toContain('guest.name')
  })
})
