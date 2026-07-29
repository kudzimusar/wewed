import { describe, expect, test } from 'bun:test'
import {
  LEGACY_VENDOR_META_PREFIX,
  decodeLegacyTimelineIcon,
  decodeLegacyVendorDescription,
  encodeLegacyTimelineIcon,
  encodeLegacyVendorDescription,
  publicTimelineMetadata,
  publicVendorDescription,
  resolveTimelineFields,
  resolveVendorPlanningFields,
} from './planner-legacy-metadata'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

describe('Stage 2 planner metadata compatibility', () => {
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

  test('normalized vendor fields take precedence while preserving legacy description', () => {
    const description = encodeLegacyVendorDescription('Human supplier description', {
      contact: 'Old contact',
      contractStatus: 'pending',
      paymentStatus: 'unpaid',
      rating: 2,
      notes: 'Old notes',
    })

    expect(
      resolveVendorPlanningFields({
        description,
        contact: 'New contact',
        contractStatus: 'signed',
        paymentStatus: 'deposit',
        planningRating: 4.5,
        notes: 'New notes',
      }),
    ).toEqual({
      description: 'Human supplier description',
      contact: 'New contact',
      contractStatus: 'signed',
      paymentStatus: 'deposit',
      planningRating: 4.5,
      notes: 'New notes',
      legacyEncoded: true,
    })
  })

  test('legacy vendor fields remain readable before or during backfill', () => {
    const description = encodeLegacyVendorDescription('Supplier', {
      contact: 'Legacy contact',
      contractStatus: 'negotiating',
      paymentStatus: 'deposit',
      rating: 4,
      notes: 'Legacy notes',
    })

    expect(
      resolveVendorPlanningFields({
        description,
        contact: null,
        contractStatus: null,
        paymentStatus: null,
        planningRating: null,
        notes: null,
      }),
    ).toEqual({
      description: 'Supplier',
      contact: 'Legacy contact',
      contractStatus: 'negotiating',
      paymentStatus: 'deposit',
      planningRating: 4,
      notes: 'Legacy notes',
      legacyEncoded: true,
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

  test('normalized timeline fields take precedence with legacy fallback', () => {
    expect(
      resolveTimelineFields({
        icon: '{"d":"30 minutes","l":"Old room","i":"music"}',
        duration: '45 minutes',
        location: 'New room',
        displayIcon: 'rings',
      }),
    ).toEqual({
      duration: '45 minutes',
      location: 'New room',
      icon: 'rings',
      legacyEncoded: true,
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

  test('planner routes write normalized fields and retain fallback readers', async () => {
    const routes = await Promise.all([
      source('src/app/api/planner/vendors/route.ts'),
      source('src/app/api/planner/vendors/[id]/route.ts'),
      source('src/app/api/planner/timeline/route.ts'),
      source('src/app/api/planner/timeline/[id]/route.ts'),
    ])

    for (const route of routes) {
      expect(route).toContain("from '@/lib/planner-legacy-metadata'")
    }
    expect(routes[0]).toContain('contact: body.contact?.trim() || null')
    expect(routes[0]).toContain('planningRating: rating')
    expect(routes[0]).not.toContain('encodeLegacyVendorDescription')
    expect(routes[1]).toContain('updates.contractStatus')
    expect(routes[1]).not.toContain('encodeLegacyVendorDescription')
    expect(routes[2]).toContain('duration: body.duration?.trim() || null')
    expect(routes[2]).toContain('displayIcon')
    expect(routes[2]).not.toContain('encodeLegacyTimelineIcon')
    expect(routes[3]).toContain('updates.duration')
    expect(routes[3]).not.toContain('encodeLegacyTimelineIcon')
  })

  test('the public wedding route resolves normalized programme metadata', async () => {
    const route = await source('src/app/api/wedding/route.ts')

    expect(route).toContain('publicVendorDescription(vendor.description)')
    expect(route).toContain('resolveTimelineFields(item)')
    expect(route).toContain('duration: metadata.duration')
    expect(route).toContain('location: metadata.location')
    expect(route).not.toContain('description: vendor.description')
    expect(route).not.toContain('icon: item.icon')
  })

  test('migration is additive and never rewrites legacy source fields', async () => {
    const [schema, migration] = await Promise.all([
      source('prisma/schema.prisma'),
      source('prisma/migrations/20260729131000_normalize_planner_metadata/migration.sql'),
    ])

    for (const field of [
      'contact        String?',
      'contractStatus String',
      'paymentStatus  String',
      'planningRating Float?',
      'notes          String?',
      'duration    String?',
      'location    String?',
      'displayIcon String?',
    ]) {
      expect(schema).toContain(field)
    }
    expect(migration).toContain('ADD COLUMN "contact"')
    expect(migration).toContain('ADD COLUMN "duration"')
    expect(migration).toContain('sync_vendor_planner_metadata_trigger')
    expect(migration).toContain('sync_programme_item_metadata_trigger')
    expect(migration).not.toContain('SET "description" =')
    expect(migration).not.toContain('SET "icon" =')
    expect(migration).not.toContain('DROP COLUMN')
  })

  test('core vendor edits synchronize the retained Phase 3 pipeline', async () => {
    const [createRoute, updateRoute, sync] = await Promise.all([
      source('src/app/api/planner/vendors/route.ts'),
      source('src/app/api/planner/vendors/[id]/route.ts'),
      source('src/lib/planner-vendor-pipeline-sync.ts'),
    ])

    expect(createRoute).toContain('syncVendorPipelineFromNormalizedVendor')
    expect(updateRoute).toContain('syncVendorPipelineFromNormalizedVendor')
    expect(sync).toContain("section: 'planner_vendor_pipeline'")
    expect(sync).toContain('quoteAmount: current?.quoteAmount ?? null')
    expect(sync).toContain('ownerUserId: current?.ownerUserId ?? null')
    expect(sync).toContain('contractUrl: current?.contractUrl ??')
  })

  test('compatibility migration does not alter the original planner baseline', async () => {
    const original = await source('src/components/wedding/wedding-planner.tsx')

    expect(original).toContain('<ImportExportBar moduleKey="vendors"')
    expect(original).toContain('<ImportExportBar moduleKey="timeline"')
    expect(original).toContain('contractStatus')
    expect(original).toContain('paymentStatus')
    expect(original).toContain('form.duration')
    expect(original).toContain('form.location')
  })
})
