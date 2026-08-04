import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(path, 'utf8')

describe('Africa-ready authenticated product remediation', () => {
  test('the documented plan remains the release source of truth', () => {
    const plan = source('docs/africa-ready-product-remediation-2026-08-04.md')
    expect(plan).toContain('implementation source of truth')
    expect(plan).toContain('Do not merge this release')
    expect(plan).toContain('planner marketplace')
    expect(plan).toContain('invitations and QR')
    expect(plan).toContain('Daily Planner Operations')
  })

  test('the rendered hero uses local Wewed-owned artwork rather than the remote film', () => {
    const css = source('src/app/product-remediation.css')
    const artwork = source('public/media/wewed-zimbabwe-couple.svg')
    expect(css).toContain("url('/media/wewed-zimbabwe-couple.svg')")
    expect(css).toContain('[data-testid="africa-ready-hero"] > video')
    expect(css).toContain('display: none !important')
    expect(artwork).toContain('Black Zimbabwean bride and groom')
  })

  test('marketplace and operational surfaces expose contrast and containment rules', () => {
    const css = source('src/app/product-remediation.css')
    const frame = source('src/components/marketplace/marketplace-frame.tsx')
    expect(frame).toContain('data-marketplace-frame')
    expect(css).toContain('--wewed-field-text')
    expect(css).toContain('[data-slot="dialog-content"].max-w-7xl')
    expect(css).toContain('minmax(11rem, 1fr)')
    expect(css).toContain('digital-card-design-heading')
  })
})
