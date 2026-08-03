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
const plannerWorkspaceLayout = source('src/app/planner/layout.tsx')

const plannerRouteMetadata = [
  directoryPage,
  publicProfilePage,
  coupleMarketplacePage,
  plannerMarketplacePage,
  adminMarketplacePage,
  plannerWorkspaceLayout,
]

describe('planner route metadata isolation', () => {
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

  test('every planner route overrides inherited keywords and social metadata', () => {
    for (const page of plannerRouteMetadata) {
      expect(page).toContain('keywords:')
      expect(page).toContain('openGraph:')
      expect(page).toContain('twitter:')
    }
  })

  test('protected planner routes are explicitly non-indexable', () => {
    for (const page of [
      coupleMarketplacePage,
      plannerMarketplacePage,
      adminMarketplacePage,
      plannerWorkspaceLayout,
    ]) {
      expect(page).toContain('index: false')
      expect(page).toContain('follow: false')
    }
  })

  test('planner route metadata contains no flagship wedding identity', () => {
    for (const page of plannerRouteMetadata) {
      expect(page).not.toContain('Charity &')
      expect(page).not.toContain('Imba Manor')
      expect(page).not.toContain('23.12.26')
    }
  })
})
