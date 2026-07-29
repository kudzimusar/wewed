import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, test } from 'bun:test'
import { db } from './db'
import {
  encodeLegacyTimelineIcon,
  encodeLegacyVendorDescription,
} from './planner-legacy-metadata'

const createdWeddingIds: string[] = []
const createdCoupleIds: string[] = []

afterAll(async () => {
  for (const weddingId of createdWeddingIds) {
    await db.contentRevision.deleteMany({ where: { weddingId } })
    await db.programmeItem.deleteMany({ where: { weddingId } })
    await db.vendor.deleteMany({ where: { weddingId } })
    await db.wedding.deleteMany({ where: { id: weddingId } })
  }
  for (const coupleId of createdCoupleIds) {
    await db.couple.deleteMany({ where: { id: coupleId } })
  }
  await db.$disconnect()
})

async function createTestWedding() {
  const suffix = randomUUID()
  const couple = await db.couple.create({
    data: {
      slug: `metadata-couple-${suffix}`,
      partner1: 'Test Partner One',
      partner2: 'Test Partner Two',
    },
  })
  createdCoupleIds.push(couple.id)

  const wedding = await db.wedding.create({
    data: {
      slug: `metadata-wedding-${suffix}`,
      title: 'Metadata Migration Test',
      date: new Date('2027-01-01T00:00:00.000Z'),
      venue: 'Test Venue',
      venueCity: 'Harare',
      venueCountry: 'Zimbabwe',
      coupleId: couple.id,
    },
  })
  createdWeddingIds.push(wedding.id)
  return wedding
}

describe('Stage 2 additive planner metadata migration', () => {
  test('legacy vendor writes populate normalized fields without changing description', async () => {
    const wedding = await createTestWedding()
    const description = encodeLegacyVendorDescription('Human vendor description', {
      contact: 'Legacy Contact',
      contractStatus: 'signed',
      paymentStatus: 'deposit',
      rating: 4.5,
      notes: 'Legacy planning notes',
    })

    const vendor = await db.vendor.create({
      data: {
        name: 'Legacy Vendor',
        category: 'venue',
        description,
        weddingId: wedding.id,
      },
    })

    expect(vendor.description).toBe(description)
    expect(vendor.contact).toBe('Legacy Contact')
    expect(vendor.contractStatus).toBe('signed')
    expect(vendor.paymentStatus).toBe('deposit')
    expect(vendor.planningRating).toBe(4.5)
    expect(vendor.notes).toBe('Legacy planning notes')
  })

  test('legacy vendor updates synchronize columns and keep source text intact', async () => {
    const wedding = await createTestWedding()
    const vendor = await db.vendor.create({
      data: {
        name: 'Transitional Vendor',
        category: 'caterer',
        description: 'Human description',
        contact: 'Initial Contact',
        contractStatus: 'pending',
        paymentStatus: 'unpaid',
        weddingId: wedding.id,
      },
    })
    const description = encodeLegacyVendorDescription('Human description', {
      contact: 'Pipeline Contact',
      contractStatus: 'negotiating',
      paymentStatus: 'paid',
      notes: 'Updated from Phase 3',
    })

    const updated = await db.vendor.update({
      where: { id: vendor.id },
      data: { description },
    })

    expect(updated.description).toBe(description)
    expect(updated.contact).toBe('Pipeline Contact')
    expect(updated.contractStatus).toBe('negotiating')
    expect(updated.paymentStatus).toBe('paid')
    expect(updated.notes).toBe('Updated from Phase 3')
  })

  test('legacy timeline JSON populates normalized fields without changing icon', async () => {
    const wedding = await createTestWedding()
    const icon = encodeLegacyTimelineIcon({
      d: '40 minutes',
      l: 'Ceremony lawn',
      i: 'rings',
    })

    const item = await db.programmeItem.create({
      data: {
        time: '14:00',
        title: 'Ceremony',
        icon,
        order: 1,
        weddingId: wedding.id,
      },
    })

    expect(item.icon).toBe(icon)
    expect(item.duration).toBe('40 minutes')
    expect(item.location).toBe('Ceremony lawn')
    expect(item.displayIcon).toBe('rings')
  })

  test('normalized records remain ordinary human-readable records', async () => {
    const wedding = await createTestWedding()
    const vendor = await db.vendor.create({
      data: {
        name: 'Normalized Vendor',
        category: 'photographer',
        description: 'Human-readable description only',
        contact: 'Photographer Contact',
        contractStatus: 'signed',
        paymentStatus: 'paid',
        planningRating: 5,
        notes: 'No sentinel required',
        weddingId: wedding.id,
      },
    })
    const item = await db.programmeItem.create({
      data: {
        time: '16:00',
        title: 'Portraits',
        description: 'Family portraits',
        icon: 'camera',
        displayIcon: 'camera',
        duration: '30 minutes',
        location: 'Gardens',
        order: 2,
        weddingId: wedding.id,
      },
    })

    expect(vendor.description).toBe('Human-readable description only')
    expect(vendor.description).not.toContain('__wewed_meta__:')
    expect(item.icon).toBe('camera')
    expect(item.duration).toBe('30 minutes')
    expect(item.location).toBe('Gardens')
  })
})
