import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')

describe('targeted Wewed preview remediation', () => {
  test('the documented plan limits work to the reported defects', () => {
    const plan = source('docs/africa-ready-product-remediation-2026-08-04.md')
    expect(plan).toContain('implementation source of truth')
    expect(plan).toContain('not authorization for a new system-wide redesign')
    expect(plan).toContain('Landing-page hero media')
    expect(plan).toContain('Original public imagery')
    expect(plan).toContain('Planner marketplace readability')
    expect(plan).toContain('Invitation templates and guest QR cards')
    expect(plan).toContain('Daily Planner Operations layout')
    expect(plan).toContain('Wedding-first wording')
    expect(plan).toContain('Task Test 11')
  })

  test('the public experience uses Wewed-created bride-and-groom media', () => {
    const home = source('src/components/public/public-platform-home-v2.tsx')
    const hero = source('public/media/wewed-couple-hero.svg')
    expect(home).toContain('<video')
    expect(home).toContain('/media/wewed-couple-hero.svg')
    expect(home).toContain('/media/wewed-couple-planning.svg')
    expect(home).toContain('/media/wewed-couple-guests.svg')
    expect(home).not.toContain('pexels.com')
    expect(hero).toContain('Black bride and groom')
  })

  test('marketplace remediation is scoped to marketplace surfaces', () => {
    const css = source('src/app/product-remediation.css')
    const frame = source('src/components/marketplace/marketplace-frame.tsx')
    expect(frame).toContain('data-marketplace-frame')
    expect(css).toContain('--wewed-field-text')
    expect(css).toContain('[data-marketplace-frame] input:disabled')
    expect(css).toContain('padding-bottom: max(7rem')
  })

  test('invitation and Daily Operations containment rules are independently scoped', () => {
    const css = source('src/app/product-remediation.css')
    expect(css).toContain('[data-slot="dialog-content"].bg-ivory.max-w-6xl')
    expect(css).toContain('digital-card-design-heading')
    expect(css).toContain('[data-slot="dialog-content"].bg-espresso.max-w-7xl')
    expect(css).toContain('minmax(11rem, 1fr)')
  })

  test('regional campaign wording is removed from public surfaces', () => {
    const home = source('src/components/public/public-platform-home-v2.tsx')
    const shell = source('src/components/public/public-platform-shell.tsx')
    const info = source('src/components/public/public-info-page.tsx')
    for (const content of [home, shell, info]) {
      expect(content).not.toContain('Zimbabwe first')
      expect(content).not.toContain('Designed for Africa')
      expect(content).not.toContain('Africa ready')
    }
  })
})
