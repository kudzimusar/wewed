import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function source(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('Marketplace Concierge global AI contract', () => {
  test('enters through the Wewed AI Core rather than the low-level router', () => {
    const route = source('src/app/api/ai/marketplace/route.ts')
    expect(route).toContain('runWewedAi')
    expect(route).not.toContain('generateAiText')
    expect(route).toContain("skill: 'marketplace_concierge'")
  })

  test('uses published provider/service records and preserves deterministic boundaries', () => {
    const route = source('src/app/api/ai/marketplace/route.ts')
    expect(route).toContain("p.visibility = 'published'")
    expect(route).toContain("status = 'published'")
    expect(route).toContain("dataProfile: 'public'")
    expect(route).toContain("allowedTools: ['marketplace.read']")
    expect(route).toContain("'price', 'availability', 'booking', 'payment', 'contribution', 'contract-consent'")
  })

  test('does not expose the underlying provider or model on the public response', () => {
    const route = source('src/app/api/ai/marketplace/route.ts')
    expect(route).toContain('const { provider: _provider, model: _model, ...publicProvenance }')
    expect(route).toContain('provenance: publicProvenance')
  })

  test('keeps AI guidance progressive and hands commitment back to the existing enquiry flow', () => {
    const component = source('src/components/providers/provider-ai-concierge.tsx')
    expect(component).toContain('Nothing is booked or sent by asking.')
    expect(component).toContain('Continue to enquiry')
    expect(component).toContain('openExistingEnquiry')
    expect(component).not.toContain("fetch('/api/providers/enquiries'")
    expect(component).not.toContain("fetch('/api/bookings'")
  })
})
