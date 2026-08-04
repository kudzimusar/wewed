import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')

describe('targeted Africa-ready preview remediation', () => {
  test('the documented plan limits work to the reported defects', () => {
    const plan = source('docs/africa-ready-product-remediation-2026-08-04.md')
    expect(plan).toContain('implementation source of truth')
    expect(plan).toContain('not authorization for a new system-wide redesign')
    expect(plan).toContain('Landing-page hero media')
    expect(plan).toContain('Planner marketplace readability')
    expect(plan).toContain('Invitation templates and guest QR cards')
    expect(plan).toContain('Daily Planner Operations layout')
    expect(plan).toContain('Explicitly out of scope')
    expect(plan).toContain('Task Test 11')
    expect(plan).toContain('Do not merge this release')
  })

  test('the rendered hero uses local bride-and-groom artwork instead of the reviewed film', () => {
    const css = source('src/app/product-remediation.css')
    const artwork = source('public/media/wewed-zimbabwe-couple.svg')
    expect(css).toContain("url('/media/wewed-zimbabwe-couple.svg')")
    expect(css).toContain('[data-testid="africa-ready-hero"] > video')
    expect(css).toContain('[data-testid="hero-video-control"]')
    expect(css).toContain('display: none !important')
    expect(artwork).toContain('Black Zimbabwean bride and groom')
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
    expect(css).not.toContain('[data-slot="dialog-content"].max-w-7xl,')
  })
})
