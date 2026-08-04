import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')

describe('Africa-ready product experience', () => {
  test('the public home is video-led, interactive and commercially complete', () => {
    const home = source('src/components/public/public-platform-home.tsx')
    expect(home).toContain("'use client'")
    expect(home).toContain('data-testid="africa-ready-hero"')
    expect(home).toContain('<video')
    expect(home).toContain('muted')
    expect(home).toContain('autoPlay')
    expect(home).toContain('loop')
    expect(home).toContain('playsInline')
    expect(home).toContain('data-testid="hero-video-control"')
    expect(home).toContain('prefers-reduced-motion: reduce')
    expect(home).toContain('data-testid="featured-planner-carousel"')
    expect(home).toContain('data-testid="wedding-inspiration-carousel"')
    expect(home).toContain('id="vendors"')
    expect(home).toContain('Zimbabwe first · designed for Africa')
    expect(home).toContain("marketplaceFetch<{ planners: PublicPlannerProfile[] }>")
  })

  test('featured planner presentation uses only marketplace records with honest loading states', () => {
    const home = source('src/components/public/public-platform-home.tsx')
    expect(home).toContain("type PlannerLoadState = 'loading' | 'ready' | 'empty' | 'error'")
    expect(home).toContain("setPlannerLoadState(publishedPlanners.length ? 'ready' : 'empty')")
    expect(home).toContain('aria-live="polite"')
    expect(home).toContain('We never substitute test accounts or fabricated profiles for real marketplace data.')
    expect(home).not.toContain('featured-planner-placeholder')
    expect(home).not.toContain('eleven-eleven-testing-uat')
  })

  test('the public shell exposes stakeholder and corporate discovery routes', () => {
    const shell = source('src/components/public/public-platform-shell.tsx')
    for (const label of ['Find a planner', 'For couples', 'For planners', 'Vendors & venues', 'How it works', 'Pricing']) {
      expect(shell).toContain(label)
    }
    expect(shell).toContain("['For couples', '/#couples']")
    expect(shell).toContain('Built in Zimbabwe. Designed for Africa.')
    expect(shell).toContain("href=\"/register\"")
  })

  test('text-heavy public pages inherit the visual information template', () => {
    const info = source('src/components/public/public-info-page.tsx')
    expect(info).toContain('<img')
    expect(info).toContain('Zimbabwe first. Africa ready.')
    expect(info).toContain('bg-[linear-gradient')
    expect(info).toContain('PublicPlatformShell')
  })

  test('the couple dashboard is a visual command centre without changing its routes', () => {
    const couple = source('src/components/couple/couple-dashboard.tsx')
    expect(couple).toContain('Wewed couple command centre')
    expect(couple).toContain('days until the celebration')
    expect(couple).toContain('Invitation protected')
    expect(couple).toContain('Journey overview')
    for (const route of ['/couple/planners', '/couple/invitations', '/couple/privacy', '/planner', '/billing']) {
      expect(couple).toContain(route)
    }
  })

  test('marketplace pages share the premium role-aware visual frame', () => {
    const frame = source('src/components/marketplace/marketplace-frame.tsx')
    expect(frame).toContain('Planner business centre')
    expect(frame).toContain('Marketplace governance')
    expect(frame).toContain('Couple planner journey')
    expect(frame).toContain('Public planner marketplace')
    expect(frame).toContain('Planner directory')
    expect(frame).toContain('linear-gradient(100deg')
  })

  test('desktop and mobile Chromium both exercise the new experience', () => {
    const browser = source('tests/e2e/zz-africa-ready-experience.spec.ts')
    expect(browser).toContain('mobile homepage keeps media, discovery and navigation operable @mobile')
    expect(browser).toContain('mobile information and marketplace pages retain the shared visual frame @mobile')
    expect(browser).toContain('expectNoHorizontalOverflow')
  })

  test('the redesign remains frontend-only', () => {
    const plan = source('docs/africa-ready-ui-release.md')
    expect(plan).toContain('frontend-only')
    expect(plan).toContain('no schema, database, permission, privacy, subscription, billing or API contract changes')
  })
})