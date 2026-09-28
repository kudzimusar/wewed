import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')

describe('wedding identity isolation', () => {
  test('every wedding slug mounts the same canonical renderer without flagship routing', () => {
    const home = source('src/components/wedding/wedding-home.tsx')
    const provider = source('src/components/wedding/wedding-data-provider.tsx')
    const page = source('src/app/w/[slug]/page.tsx')
    const tracker = source('src/components/wedding/section-tracker.tsx')

    // QRO07: there is no flagship wedding. A route without a wedding identity fails closed.
    expect(provider).not.toContain('FLAGSHIP_WEDDING_SLUG')
    expect(provider).not.toContain('isFlagship')
    expect(source('src/lib/wedding-data.ts')).not.toContain('FLAGSHIP_WEDDING_SLUG')
    expect(source('src/lib/wedding-data.ts')).toContain('No wedding was specified.')
    expect(home).not.toContain('if (!isFlagship) {')
    expect(home).not.toContain('DataBackedWeddingExperience')
    expect(home).not.toContain('isFlagship')

    // The canonical renderer is seeded with the already-authorized wedding
    // projection on the server. This prevents a neutral/other-wedding first
    // paint while preserving the same renderer for every slug.
    expect(home).toContain('<WeddingDataProvider slug={slug} initialData={initialData} canEditSite={canEditSite}>')
    expect(home).toContain('initialData?: WeddingData | null')
    expect(page).toContain('const initialData = await loadWeddingDataBySlug(slug)')
    expect(page).toContain('initialData={initialData}')

    expect(home).toContain('<SiteHero />')
    expect(home).toContain('<SiteStory />')
    expect(home).toContain('<SiteVenue />')
    expect(home).toContain('<SiteTheDay />')
    expect(home).toContain('<SiteSongbook />')
    expect(home).toContain('<SiteGallery />')
    expect(home).toContain(
      '<GlobalWeddingTools accessKind={accessKind} viewerRole={viewerRole} />',
    )
    expect(
      home.split(
        '<GlobalWeddingTools accessKind={accessKind} viewerRole={viewerRole} />',
      ).length - 1,
    ).toBe(1)
    expect(home).toContain("const canContribute = accessKind !== 'public' && accessKind !== null")
    expect(home).toContain('{canContribute ? <MediaUpload /> : null}')
    expect(tracker).toContain('useWeddingContextSafe')
    expect(tracker).toContain('coupleNames(context?.wedding)')
    expect(tracker).toContain('activeSectionId')
    expect(tracker).not.toContain("home: 'Charity & Kudzie'")
    expect(tracker).not.toContain("livewall: 'Live from Imba Manor'")
  })

  test('the retired reduced renderer is gone and not mounted', () => {
    const home = source('src/components/wedding/wedding-home.tsx')
    const { existsSync } = require('node:fs') as typeof import('node:fs')
    expect(existsSync('src/components/wedding/data-backed-wedding-experience.tsx')).toBe(false)
    expect(home).not.toContain('DataBackedWeddingExperience')
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
