import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')

describe('wedding identity isolation', () => {
  test('only the flagship slug mounts the flagship wedding experience', () => {
    const home = source('src/components/wedding/wedding-home.tsx')
    const provider = source('src/components/wedding/wedding-data-provider.tsx')

    expect(provider).toContain('isFlagship: activeSlug === FLAGSHIP_WEDDING_SLUG')
    expect(home).toContain('if (!isFlagship) return <DataBackedWeddingExperience />')
    expect(home.indexOf('if (!isFlagship)')).toBeLessThan(home.indexOf('<Navbar />'))
  })

  test('the non-flagship experience uses only active wedding data', () => {
    const generic = source(
      'src/components/wedding/data-backed-wedding-experience.tsx',
    )

    for (const forbidden of [
      'Charity',
      'Kudzie',
      'Imba Manor',
      '23.12.26',
      'Musarurwa',
      '@wewedcharitykudzie',
    ]) {
      expect(generic).not.toContain(forbidden)
    }

    expect(generic).toContain('{wedding.title}')
    expect(generic).toContain('wedding.couple.partner1')
    expect(generic).toContain('wedding.couple.partner2')
    expect(generic).toContain('{formatDate(wedding.date)}')
    expect(generic).toContain('{wedding.venue}')
    expect(generic).toContain('<InvitationRsvpDialog />')
    expect(generic).toContain('<RsvpSection />')
    expect(generic).toContain('<ShareSection />')
  })

  test('the browser gate verifies selected wedding identity and forbids flagship leakage', () => {
    const browser = source(
      'tests/e2e/zz-unified-navigation-privacy.spec.ts',
    )
    expect(browser).toContain('E2E_WEDDINGS.secondary.title')
    expect(browser).toContain("not.toContainText('Charity & Kudzie')")
    expect(browser).toContain("not.toContainText('Imba Manor')")
    expect(browser).toContain("not.toContainText('23 · 12 · 26')")
  })
})
