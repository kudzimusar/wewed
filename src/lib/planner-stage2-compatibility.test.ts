import { describe, expect, test } from 'bun:test'
import {
  LEGACY_VENDOR_META_PREFIX,
  decodeLegacyTimelineIcon,
  decodeLegacyVendorDescription,
  encodeLegacyTimelineIcon,
  encodeLegacyVendorDescription,
  publicTimelineMetadata,
  publicVendorDescription,
} from './planner-legacy-metadata'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

describe('Stage 2 legacy planner metadata compatibility', () => {
  test('vendor metadata round-trips without changing the human description', () => {
    const encoded = encodeLegacyVendorDescription('Human description ||| retained', {
      contact: 'Tariro',
      contractStatus: 'signed',
      paymentStatus: 'deposit',
      rating: 4.5,
      notes: 'Bring the signed agreement.',
    })
    const decoded = decodeLegacyVendorDescription(encoded)

    expect(encoded.startsWith(LEGACY_VENDOR_META_PREFIX)).toBe(true)
    expect(decoded).toEqual({
      encoded: true,
      humanDescription: 'Human description ||| retained',
      meta: {
        contact: 'Tariro',
        contractStatus: 'signed',
        paymentStatus: 'deposit',
        rating: 4.5,
        notes: 'Bring the signed agreement.',
      },
    })
  })

  test('invalid vendor metadata never leaks the internal sentinel', () => {
    const invalid = `${LEGACY_VENDOR_META_PREFIX}{invalid|||Visible supplier description`

    expect(decodeLegacyVendorDescription(invalid)).toEqual({
      encoded: true,
      humanDescription: 'Visible supplier description',
      meta: {},
    })
    expect(publicVendorDescription(invalid)).toBe('Visible supplier description')
    expect(publicVendorDescription(invalid)).not.toContain(LEGACY_VENDOR_META_PREFIX)
  })

  test('ordinary vendor descriptions are preserved exactly', () => {
    expect(publicVendorDescription('Local florist and décor supplier.')).toBe(
      'Local florist and décor supplier.',
    )
  })

  test('timeline metadata round-trips and plain icons remain compatible', () => {
    const encoded = encodeLegacyTimelineIcon({
      d: '45 minutes',
      l: 'Main lawn',
      i: 'rings',
    })

    expect(decodeLegacyTimelineIcon(encoded)).toEqual({
      encoded: true,
      duration: '45 minutes',
      location: 'Main lawn',
      icon: 'rings',
    })
    expect(decodeLegacyTimelineIcon('church')).toEqual({
      encoded: false,
      duration: '',
      location: '',
      icon: 'church',
    })
  })

  test('public timeline metadata exposes fields rather than internal JSON', () => {
    const encoded = '{"d":"30 minutes","l":"Reception","i":"music"}'
    expect(publicTimelineMetadata(encoded)).toEqual({
      duration: '30 minutes',
      location: 'Reception',
      icon: 'music',
    })
    expect(publicTimelineMetadata(encoded).icon).not.toContain('{')
  })

  test('planner vendor and timeline routes share one compatibility layer', async () => {
    const routes = await Promise.all([
      source('src/app/api/planner/vendors/route.ts'),
      source('src/app/api/planner/vendors/[id]/route.ts'),
      source('src/app/api/planner/timeline/route.ts'),
      source('src/app/api/planner/timeline/[id]/route.ts'),
    ])

    for (const route of routes) {
      expect(route).toContain("from '@/lib/planner-legacy-metadata'")
    }
    expect(routes[0]).not.toContain("const META_PREFIX = '__wewed_meta__:'")
    expect(routes[2]).not.toContain('function decodeTimelineIcon')
  })

  test('the public wedding route sanitizes vendors and programme metadata', async () => {
    const route = await source('src/app/api/wedding/route.ts')

    expect(route).toContain('publicVendorDescription(vendor.description)')
    expect(route).toContain('publicTimelineMetadata(item.icon)')
    expect(route).toContain('duration: metadata.duration')
    expect(route).toContain('location: metadata.location')
    expect(route).not.toContain('description: vendor.description')
    expect(route).not.toContain('icon: item.icon')
  })

  test('compatibility hardening does not alter the original planner baseline', async () => {
    const original = await source('src/components/wedding/wedding-planner.tsx')

    expect(original).toContain('<ImportExportBar moduleKey="vendors"')
    expect(original).toContain('<ImportExportBar moduleKey="timeline"')
    expect(original).toContain('contractStatus')
    expect(original).toContain('paymentStatus')
    expect(original).toContain('form.duration')
    expect(original).toContain('form.location')
  })
})
