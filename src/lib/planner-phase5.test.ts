import { describe, expect, test } from 'bun:test'
import {
  buildMapsSearchUrl,
  cleanStringList,
  cleanUrl,
  clientProfileCompleteness,
} from '@/lib/planner-phase5'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

describe('Phase 5 real client data', () => {
  test('normalizes saved venue URLs safely', () => {
    expect(cleanUrl('https://example.com/venue')).toBe('https://example.com/venue')
    expect(cleanUrl('http://example.com', { allowHttp: true })).toBe('http://example.com/')
    expect(cleanUrl('/uploads/venue.jpg', { allowRelative: true })).toBe('/uploads/venue.jpg')
    expect(cleanUrl('javascript:alert(1)', { allowHttp: true })).toBeNull()
    expect(cleanUrl('//evil.example', { allowRelative: true })).toBeNull()
  })

  test('deduplicates planner-entered lists', () => {
    expect(cleanStringList(['Garden ceremony', 'Garden ceremony', ' Reception '])).toEqual([
      'Garden ceremony',
      'Reception',
    ])
  })

  test('builds a directions URL from real address fields', () => {
    const url = buildMapsSearchUrl([
      'Imba Manor',
      '1 Worplestone Way',
      'Glen Lorne',
      'Harare',
      'Zimbabwe',
    ])
    expect(url).toContain('google.com/maps/search')
    expect(decodeURIComponent(url)).toContain('1 Worplestone Way')
  })

  test('reports missing real-data fields', () => {
    const result = clientProfileCompleteness({
      partner1: 'Charity',
      partner2: 'Kudzie',
      title: 'Charity & Kudzie',
      date: '2026-12-23',
      venue: 'Imba Manor',
      venueCity: 'Harare',
      venueCountry: 'Zimbabwe',
      venueAddress: '',
      venueMapUrl: '',
      venuePhone: '',
      venueDescription: '',
    })
    expect(result.percent).toBeLessThan(100)
    expect(result.missing).toContain('Venue address')
  })

  test('planner profile API is active-wedding scoped and permission gated', async () => {
    const route = await source('src/app/api/planner/client-profile/route.ts')
    expect(route).toContain("requireWeddingPermission(request, 'planner.view')")
    expect(route).toContain("requireWeddingPermission(request, 'content.edit')")
    expect(route).toContain('access.context.weddingId')
    expect(route).not.toContain("slug: 'charity-and-kudzie'")
  })

  test('public venue renders saved wedding content instead of fixed client markup', async () => {
    const venue = await source('src/components/wedding/venue-section.tsx')
    expect(venue).toContain('useWeddingContextSafe')
    expect(venue).toContain("getOrdered('venue', 'feature')")
    expect(venue).toContain('wedding?.venueMapUrl')
    expect(venue).not.toContain('href="https://www.google.com/search?q=Imba')
  })

  test('public wedding API resolves the requested slug', async () => {
    const route = await source('src/app/api/wedding/route.ts')
    expect(route).toContain("searchParams.get('slug')")
    expect(route).toContain('where: { slug }')
    expect(route).not.toContain('where: { slug: "charity-and-kudzie" }')
  })

  test('first-client venue restoration is durable and slug-based', async () => {
    const migration = await source(
      'prisma/migrations/20260729102000_phase5_restore_flagship_venue/migration.sql',
    )
    expect(migration).toContain("WHERE slug = 'charity-and-kudzie'")
    expect(migration).toContain('1 Worplestone Way')
    expect(migration).toContain('Glen Lorne')
    expect(migration).toContain('first_client.venue_restored')
    expect(migration).not.toContain('cmqos70cb0004q6vxe9g9aiu5')
  })
})
