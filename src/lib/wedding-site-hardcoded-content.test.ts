import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'

/**
 * QRO07-SHIP01 — CI guard: the guest-facing wedding site renders only the wedding's own data.
 * Every component the site mounts is scanned for another wedding's identity, example/sample copy,
 * stock photography, fabricated social proof and platform marketing.
 */
const SITE_DIR = 'src/components/wedding/site'
const GUEST_MOUNTED = [
  ...readdirSync(SITE_DIR).filter((file) => file.endsWith('.tsx')).map((file) => `${SITE_DIR}/${file}`),
  'src/components/wedding/wedding-home.tsx',
  'src/components/wedding/navbar.tsx',
  'src/components/wedding/rsvp-section.tsx',
  'src/components/wedding/qr-checkin.tsx',
  'src/components/wedding/media-upload.tsx',
  'src/components/wedding/share-section.tsx',
  'src/components/wedding/gift-registry-campaign-bridge.tsx',
  'src/components/wedding/section-tracker.tsx',
  'src/lib/wedding-site/format.ts',
  'src/lib/wedding-data-server.ts',
]

const FORBIDDEN: Array<[RegExp, string]> = [
  [/Charity|Kudzie|Musarurwa|Imba Manor|charity-and-kudzie/, 'a specific real wedding'],
  [/\bExample\b|Lorem ipsum|\bSample\b|Add your chosen|Replace this/, 'example / placeholder copy'],
  [/unsplash\.com|images\.pexels|picsum\.photos|randomuser\.me/, 'stock photography'],
  [/\b\d{2,} (messages|guests are|people have)\b/, 'fabricated social proof'],
  [/Find a Planner|Powered by Wewed|Pricing|Apply as Vendor|Coming Soon/, 'platform marketing'],
  [/STARTER_[A-Z_]+/, 'starter data'],
]

describe('guest wedding site contains no hardcoded or fabricated content', () => {
  test.each(GUEST_MOUNTED)('%s', (file) => {
    const text = readFileSync(file, 'utf8')
    for (const [pattern, reason] of FORBIDDEN) {
      const match = text.match(pattern)
      expect(match ? `${file}: ${reason} (“${match[0]}”)` : null).toBeNull()
    }
  })

  test('owner setup prompts are server-gated and never shown to guests', () => {
    const primitives = readFileSync(`${SITE_DIR}/primitives.tsx`, 'utf8')
    expect(primitives).toContain('if (!canEditSite) return null')
    const page = readFileSync('src/app/w/[slug]/page.tsx', 'utf8')
    expect(page).toContain("contextHasPermission(editorContext, 'content.edit')")
  })

  test('the public projection is an allowlist, not every stored content row', () => {
    const server = readFileSync('src/lib/wedding-data-server.ts', 'utf8')
    expect(server).toContain('if (!isPublicScalarField(row.section, row.field)) continue')
    expect(server).toContain('ordered,')
    expect(server).not.toContain('contentItems: true')
  })
})
