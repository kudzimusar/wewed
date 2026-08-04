import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')

describe('Wewed wedding-first product experience', () => {
  test('the public home is media-rich, wedding-first and free of stock-media references', () => {
    const home = source('src/components/public/public-platform-home-v2.tsx')
    expect(home).toContain("'use client'")
    expect(home).toContain('data-testid="africa-ready-hero"')
    expect(home).toContain('<video')
    expect(home).toContain('/media/wewed-couple-hero.svg')
    expect(home).toContain('/media/wewed-couple-planning.svg')
    expect(home).toContain('/media/wewed-couple-guests.svg')
    expect(home).toContain('data-testid="featured-planner-carousel"')
    expect(home).toContain('data-testid="wedding-inspiration-carousel"')
    expect(home).toContain('id="vendors"')
    expect(home).toContain('Everything for a beautifully planned wedding')
    expect(home).toContain("marketplaceFetch<{ planners: PublicPlannerProfile[] }>")
    expect(home).not.toContain('pexels.com')
    expect(home).not.toContain('Zimbabwe first')
    expect(home).not.toContain('designed for Africa')
  })

  test('featured planner presentation uses only marketplace records with honest loading states', () => {
    const home = source('src/components/public/public-platform-home-v2.tsx')
    expect(home).toContain("type PlannerLoadState = 'loading' | 'ready' | 'empty' | 'error'")
    expect(home).toContain("setPlannerLoadState(published.length ? 'ready' : 'empty')")
    expect(home).toContain('aria-live="polite"')
    expect(home).toContain('We never substitute test accounts or fabricated profiles for real marketplace data.')
    expect(home).not.toContain('eleven-eleven-testing-uat')
  })

  test('the public shell exposes discovery routes with neutral wedding-first copy', () => {
    const shell = source('src/components/public/public-platform-shell.tsx')
    for (const label of ['Find a planner', 'For couples', 'For planners', 'Vendors & venues', 'How it works', 'Pricing']) expect(shell).toContain(label)
    expect(shell).toContain("['For couples', '/#couples']")
    expect(shell).toContain('Made for weddings. Built to bring people together.')
    expect(shell).not.toContain('Built in Zimbabwe')
    expect(shell).not.toContain('Designed for Africa')
  })

  test('text-heavy public pages use local artwork and neutral copy', () => {
    const info = source('src/components/public/public-info-page.tsx')
    expect(info).toContain('/media/wewed-couple-hero.svg')
    expect(info).toContain('Made for meaningful celebrations.')
    expect(info).toContain('PublicPlatformShell')
    expect(info).not.toContain('pexels.com')
    expect(info).not.toContain('Zimbabwe first')
  })

  test('the couple dashboard keeps its routes', () => {
    const couple = source('src/components/couple/couple-dashboard.tsx')
    for (const route of ['/couple/planners', '/couple/invitations', '/couple/privacy', '/planner', '/billing']) expect(couple).toContain(route)
  })

  test('marketplace pages share the role-aware visual frame', () => {
    const frame = source('src/components/marketplace/marketplace-frame.tsx')
    for (const label of ['Planner business centre', 'Marketplace governance', 'Couple planner journey', 'Public planner marketplace', 'Planner directory']) expect(frame).toContain(label)
  })

  test('desktop and mobile Chromium exercise the experience', () => {
    const browser = source('tests/e2e/zz-africa-ready-experience.spec.ts')
    expect(browser).toContain('mobile homepage keeps media, discovery and navigation operable @mobile')
    expect(browser).toContain('expectNoHorizontalOverflow')
  })

  test('the redesign remains frontend-only', () => {
    const plan = source('docs/africa-ready-ui-release.md')
    expect(plan).toContain('frontend-only')
    expect(plan).toContain('no schema, database, permission, privacy, subscription, billing or API contract changes')
  })
})
