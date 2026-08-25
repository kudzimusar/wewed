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

  test('uses verified published provider/service records and preserves deterministic boundaries', () => {
    const route = source('src/app/api/ai/marketplace/route.ts')
    expect(route).toContain("p.visibility = 'published'")
    expect(route).toContain('ba."onboardingStatus" = \'complete\'')
    expect(route).toContain('p."listingStatus" IN (\'claimed\', \'verified\')')
    expect(route).toContain("status = 'published'")
    expect(route).toContain("dataProfile: 'public'")
    expect(route).toContain("allowedTools: ['marketplace.read']")
    expect(route).toContain("'price', 'availability', 'booking', 'payment', 'contribution', 'contract-consent'")
  })

  test('projects pricing through visibility rules and blocks prepare when enquiries are paused', () => {
    const route = source('src/app/api/ai/marketplace/route.ts')
    expect(route).toContain('marketplaceAiPricingFacts(offering)')
    expect(route).toContain("outcome === 'prepare_enquiry' && !acceptingEnquiries")
    expect(route).toContain("actionBoundary: acceptingEnquiries ? 'prepare' : 'suggest'")
  })

  test('ordinary public provider responses use the same fail-closed pricing projection', () => {
    const providerRoute = source('src/app/api/providers/[slug]/route.ts')
    expect(providerRoute).toContain("from '@/lib/providers/public-pricing'")
    expect(providerRoute).toContain('marketplacePublicPricingFacts(offering)')
    expect(providerRoute).not.toContain("startingPriceCents: typeof offering.startingPriceCents")
    expect(providerRoute).not.toContain("maximumPriceCents: typeof offering.maximumPriceCents")
  })

  test('public response is explicitly allow-listed and cannot leak provider, model or token usage', () => {
    const route = source('src/app/api/ai/marketplace/route.ts')
    expect(route).toContain('const { modelReleaseId, promptReleaseId, skillVersion, generatedAt } = result.provenance')
    expect(route).not.toContain('result: { ...result')
    expect(route).not.toContain('usage: result.usage')
    expect(route).not.toContain('provider: result.provenance.provider')
    expect(route).not.toContain('model: result.provenance.model')
  })

  test('provider page mounts AI chrome only for claimed or verified providers and carries enquiry capability', () => {
    const page = source('src/app/vendors/[slug]/page.tsx')
    expect(page).toContain('p."listingStatus" IN (\'claimed\',\'verified\')')
    expect(page).toContain('enquiryEnabled={profile.acceptingEnquiries !== false}')
  })

  test('keeps AI guidance progressive and hands commitment back to the existing enquiry flow', () => {
    const component = source('src/components/providers/provider-ai-concierge.tsx')
    expect(component).toContain('Nothing is booked or sent by asking.')
    expect(component).toContain('Continue to enquiry')
    expect(component).toContain('openExistingEnquiry')
    expect(component).toContain("starter.outcome !== 'prepare_enquiry'")
    expect(component).not.toContain("fetch('/api/providers/enquiries'")
    expect(component).not.toContain("fetch('/api/bookings'")
  })

  test('keeps an executable browser qualification for the Marketplace Concierge surface', () => {
    const browser = source('tests/e2e/provider-ai-concierge.spec.ts')
    expect(browser).toContain('Nothing is booked or sent by asking.')
    expect(browser).toContain('Continue to enquiry')
    expect(browser).toContain('Quote based')
    expect(browser).toContain("listingStatus: 'unclaimed'")
    expect(browser).toContain('@mobile')
  })
})
