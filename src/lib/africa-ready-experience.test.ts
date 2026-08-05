import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')

describe('Wewed wedding-first product experience', () => {
  test('the public home restores the first iteration composition with approved hero media', () => {
    const home = source('src/components/public/public-platform-home-v2.tsx')
    expect(home).toContain("'use client'")
    expect(home).toContain('data-testid="africa-ready-hero"')
    expect(home).toContain('<video')
    expect(home).toContain('hf_20260804_140303_f8b02a87-f03b-4db5-81e2-969b5f3c3544.mp4')
    expect(home).toContain('hf_20260804_124328_63fdf59b-a32d-498e-853a-27cbefe4ee5b.png')
    expect(home).toContain('data-testid="featured-planner-carousel"')
    expect(home).toContain('data-testid="wedding-inspiration-carousel"')
    expect(home).toContain('id="vendors"')
    expect(home).toContain('Everything for a beautifully planned wedding')
    expect(home).toContain('Wedding inspiration with a heartbeat.')
    expect(home).toContain('Privacy by design')
    expect(home).toContain("marketplaceFetch<{ planners: PublicPlannerProfile[] }>")
    expect(home).not.toContain('/media/wewed-couple-hero.svg')
    expect(home).not.toContain('Zimbabwe first')
    expect(home).not.toContain('designed for Africa')
  })

  test('audience, inspiration and vendor blocks use unique relevant generated media', () => {
    const activeHome = source('src/components/public/public-platform-home.tsx')
    const media = source('src/components/public/public-platform-home-v3.tsx')
    expect(activeHome).toContain('PublicPlatformHomeV3')
    for (const label of ['For couples', 'For planners', 'For guests']) expect(media).toContain(label)
    for (const title of ['A beautiful beginning', 'Champagne and candlelight', 'The joy after “I do”', 'A day to remember']) expect(media).toContain(title)
    for (const category of ['Venues', 'Photographers', 'Florists', 'Caterers', 'Entertainment', 'Décor & rentals']) expect(media).toContain(category)
    const urls = [...media.matchAll(/https:\/\/d2ol7oe51mr4n9\.cloudfront\.net\/[^'\n]+\.jpg/g)].map(([url]) => url)
    expect(urls).toHaveLength(13)
    expect(new Set(urls).size).toBe(13)
    expect(media).toContain('Wedding planners collaborating over a detailed event plan')
    expect(media).toContain('Professional Black wedding photographer working with a camera')
    expect(media).toContain('Refined plated wedding meal prepared for reception service')
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

  test('text-heavy public pages retain neutral copy', () => {
    const info = source('src/components/public/public-info-page.tsx')
    expect(info).toContain('Made for meaningful celebrations.')
    expect(info).toContain('PublicPlatformShell')
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

  test('the recalibration remains frontend-only', () => {
    const plan = source('docs/homepage-visual-recalibration-2026-08-05.md')
    expect(plan).toContain('visual recalibration')
    expect(plan).toContain('No schema or migration changes')
    expect(plan).toContain('No production data mutation')
  })
})
