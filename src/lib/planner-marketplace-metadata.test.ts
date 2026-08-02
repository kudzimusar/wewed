import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

const directoryPage = source('src/app/planners/page.tsx')
const publicProfilePage = source('src/app/planners/[slug]/page.tsx')
const coupleMarketplacePage = source('src/app/couple/planners/page.tsx')
const plannerMarketplacePage = source('src/app/planner/marketplace/page.tsx')
const adminMarketplacePage = source('src/app/admin/planner-profiles/page.tsx')

describe('planner marketplace metadata isolation', () => {
  test('public marketplace pages use marketplace-specific metadata', () => {
    expect(directoryPage).toContain('Find a Wedding Planner | Wewed')
    expect(directoryPage).toContain('verified wedding planners')
    expect(publicProfilePage).toContain('generateMetadata')
    expect(publicProfilePage).toContain('Wewed Planner Marketplace')
  })

  test('public profile metadata is restricted to a published active planner', () => {
    expect(publicProfilePage).toContain("p.status = 'published'")
    expect(publicProfilePage).toContain("ba.type = 'planning_company'")
    expect(publicProfilePage).toContain("ba.status = 'active'")
    expect(publicProfilePage).toContain('ba."onboardingStatus" = \'complete\'')
    expect(publicProfilePage).toContain("robots: { index: false, follow: false }")
  })

  test('protected marketplace pages are explicitly non-indexable', () => {
    for (const page of [coupleMarketplacePage, plannerMarketplacePage, adminMarketplacePage]) {
      expect(page).toContain('robots: { index: false, follow: false }')
    }
  })

  test('marketplace route metadata contains no flagship wedding identity', () => {
    for (const page of [
      directoryPage,
      publicProfilePage,
      coupleMarketplacePage,
      plannerMarketplacePage,
      adminMarketplacePage,
    ]) {
      expect(page).not.toContain('Charity &')
      expect(page).not.toContain('Imba Manor')
      expect(page).not.toContain('23.12.26')
    }
  })
})
