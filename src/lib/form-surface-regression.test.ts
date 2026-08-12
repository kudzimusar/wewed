import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(path, 'utf8')
}

describe('Wewed form surface regressions', () => {
  it('keeps the Provider enquiry form element stable across the async submit', () => {
    const profile = source('src/components/providers/public-provider-profile.tsx')

    expect(profile).toContain('const formElement = event.currentTarget')
    expect(profile).toContain('const form = new FormData(formElement)')
    expect(profile).toContain('formElement.reset()')
    expect(profile).not.toContain('event.currentTarget.reset()')
  })

  it('opts the Provider enquiry form into the governed dark form surface', () => {
    const profile = source('src/components/providers/public-provider-profile.tsx')

    expect(profile).toContain('data-wewed-form-surface="dark"')
    expect(profile).toContain('text-espresso caret-espresso')
    expect(profile).toContain('placeholder:text-espresso/40')
  })

  it('protects explicit light controls from inherited light foregrounds', () => {
    const css = source('src/app/product-remediation.css')

    expect(css).toContain(':where(input, textarea, select).bg-white')
    expect(css).toContain(':where(input, textarea, select).bg-ivory')
    expect(css).toContain(':where(input, textarea, select).bg-champagne')
    expect(css).toContain('[data-wewed-form-surface="dark"]')
    expect(css).toContain('-webkit-text-fill-color: var(--wewed-form-field-text) !important;')
  })

  it('makes shared input, textarea and select trigger foregrounds explicit', () => {
    const input = source('src/components/ui/input.tsx')
    const textarea = source('src/components/ui/textarea.tsx')
    const select = source('src/components/ui/select.tsx')

    expect(input).toContain('text-foreground caret-foreground')
    expect(textarea).toContain('text-foreground caret-foreground')
    expect(select).toContain('border-input text-foreground')
  })
})
