import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')

describe('invitation social preview trust surface', () => {
  test('brands invitation previews as Wewed without exposing Guest credentials', () => {
    const page = source('src/app/invite/[slug]/open/page.tsx')
    // The preview artwork is a static asset (a Next file-convention image under /invite collided with
    // /invite/[slug] and stalled dev hydration). Its generator is kept in scripts/brand for provenance.
    const image = source('scripts/brand/invitation-preview-image.tsx')
    const brand = source('src/lib/wewed-brand.ts')

    expect(brand).toContain("WEWED_BRAND_NAME = 'Wewed'")
    expect(brand).toContain("WEWED_BRAND_PAYOFF = 'where love lives forever.'")
    expect(page).toContain('WEWED_INVITATION_PREVIEW_TITLE')
    expect(page).toContain("siteName: 'Wewed'")
    expect(page).toContain("url: '/og/wewed-private-invitation.png'")
    const { existsSync, readFileSync: readBinary } = require('node:fs') as typeof import('node:fs')
    expect(existsSync('src/app/invite/opengraph-image.tsx')).toBe(false)
    const png = readBinary('public/og/wewed-private-invitation.png')
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(1200)
    expect(png.readUInt32BE(20)).toBe(630)
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
