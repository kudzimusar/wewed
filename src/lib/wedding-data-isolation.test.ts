import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')

describe('wedding identity isolation', () => {
  test('every wedding slug mounts the same canonical renderer without flagship routing', () => {
    const home = source('src/components/wedding/wedding-home.tsx')
    const provider = source('src/components/wedding/wedding-data-provider.tsx')

    // The provider may retain a flagship marker for migrated fixture/media
    // compatibility, but renderer selection must never depend on it.
    expect(provider).toContain('isFlagship: activeSlug === FLAGSHIP_WEDDING_SLUG')
    expect(home).not.toContain('if (!isFlagship) {')
    expect(home).not.toContain('DataBackedWeddingExperience')
    expect(home).not.toContain('isFlagship')

    expect(home).toContain('<WeddingDataProvider slug={slug}>')
    expect(home).toContain('<HeroSection />')
    expect(home).toContain('<OurStory />')
    expect(home).toContain('<VenueSection />')
    expect(home).toContain('<TheDay />')
    expect(home).toContain('<SongbookEnhanced />')
    expect(home).toContain('<PhotoGallery />')
    expect(home).toContain('<MemoryCapsule />')
    expect(home).toContain(
      '<GlobalWeddingTools accessKind={accessKind} viewerRole={viewerRole} />',
    )
    expect(
      home.split(
        '<GlobalWeddingTools accessKind={accessKind} viewerRole={viewerRole} />',
      ).length - 1,
    ).toBe(1)
    expect(home).toContain("const canContribute = accessKind !== 'public' && accessKind !== null")
    expect(home).toContain('{canContribute && <MediaUpload />}')
    expect(home).toContain('<LiveWall canPost={canContribute} />')
  })

  test('the retained legacy reduced renderer is neutral and is not mounted', () => {
    const home = source('src/components/wedding/wedding-home.tsx')
    const generic = source(
      'src/components/wedding/data-backed-wedding-experience.tsx',
    )

    expect(home).not.toContain('data-backed-wedding-experience')
    expect(home).not.toContain('DataBackedWeddingExperience')

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
  })

  test('the browser gate verifies selected wedding identity and forbids flagship leakage', () => {
    const browser = source(
      'tests/e2e/zz-unified-navigation-privacy.spec.ts',
    )
    expect(browser).toContain("const selectedWedding = page.locator('#main-content')")
    expect(browser).toContain("toContainText('Cedar')")
    expect(browser).toContain("toContainText('Drew')")
    expect(browser).toContain("toContainText('Secondary Test Gardens')")
    expect(browser).toContain("not.toContainText('Charity & Kudzie')")
    expect(browser).toContain("not.toContainText('Imba Manor')")
    expect(browser).toContain("not.toContainText('23 · 12 · 26')")
    expect(browser).toContain("not.toContainText('Musarurwa')")
  })
})
