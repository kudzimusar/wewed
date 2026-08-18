import { randomUUID } from 'node:crypto'
import { describe, expect, test } from 'bun:test'
import { db } from '@/lib/db'
import {
  createHistoricalEngagement,
  HistoricalEngagementConflictError,
} from '@/lib/planner-engagement-route-core'
import { normalizeHistoricalEngagementInput } from '@/lib/planner-historical-engagement'

async function createWeddingFixture(nonce: string, suffix: string) {
  const couple = await db.couple.create({
    data: {
      slug: `phase0-couple-${suffix}-${nonce}`,
      partner1: `Partner ${suffix} One`,
      partner2: `Partner ${suffix} Two`,
    },
  })
  const wedding = await db.wedding.create({
    data: {
      slug: `phase0-wedding-${suffix}-${nonce}`,
      title: `Phase 0 Wedding ${suffix}`,
      date: new Date('2027-06-20T10:00:00.000Z'),
      venue: 'Phase 0 Venue',
      venueCity: 'Harare',
      venueCountry: 'Zimbabwe',
      coupleId: couple.id,
    },
  })
  return { couple, wedding }
}

async function expectDatabaseRejection(operation: () => PromiseLike<unknown>): Promise<void> {
  let rejected = false
  try {
    await operation()
  } catch {
    rejected = true
  }
  expect(rejected).toBe(true)
}

describe('Phase 0 paid vendor rescue PostgreSQL integrity', () => {
  test('historical engagement round-trips facts and preserves tenant boundaries', async () => {
    const nonce = randomUUID().replaceAll('-', '').slice(0, 12)
    const first = await createWeddingFixture(nonce, 'one')
    const second = await createWeddingFixture(nonce, 'two')

    try {
      const actor = await db.user.create({
        data: {
          email: `phase0-${nonce}@example.com`,
          name: 'Phase 0 Planner',
          role: 'planner',
          currentWeddingId: first.wedding.id,
        },
      })
      const firstVendor = await db.vendor.create({
        data: {
          weddingId: first.wedding.id,
          name: 'Phase 0 Photographer',
          category: 'photographer',
          paymentStatus: 'deposit',
        },
      })
      const secondVendor = await db.vendor.create({
        data: {
          weddingId: second.wedding.id,
          name: 'Other Wedding Photographer',
          category: 'photographer',
          paymentStatus: 'deposit',
        },
      })
      const firstBudget = await db.budgetItem.create({
        data: {
          weddingId: first.wedding.id,
          vendorId: firstVendor.id,
          vendorName: firstVendor.name,
          category: 'photo_video',
          description: 'Photography package',
          estimatedCost: 3500,
          actualCost: 3500,
          paidAmount: 1000,
          currency: 'USD',
        },
      })
      const secondBudget = await db.budgetItem.create({
        data: {
          weddingId: second.wedding.id,
          vendorId: secondVendor.id,
          vendorName: secondVendor.name,
          category: 'photo_video',
          description: 'Other wedding photography',
          estimatedCost: 2500,
          paidAmount: 500,
          currency: 'USD',
        },
      })

      const input = normalizeHistoricalEngagementInput({
        vendorId: firstVendor.id,
        serviceCategory: 'Photography',
        serviceDescription: 'Existing photography engagement',
        agreedAmount: '3500.00',
        currency: 'USD',
        serviceDate: '2027-06-20T08:00:00.000Z',
        externalAgreementStatus: 'exists',
        externalAgreementReference: 'Paper agreement retained by planner',
        historicalBasis: 'Recorded from existing Vendor and Budget facts.',
        budgetItemIds: [firstBudget.id],
        payments: [
          {
            amount: '1000.00',
            paidAt: '2026-08-01T10:00:00.000Z',
            method: 'bank transfer',
            reference: `PHASE0-${nonce}`,
          },
        ],
      })

      const created = await createHistoricalEngagement({
        weddingId: first.wedding.id,
        actorId: actor.id,
        input,
      })

      expect(created).toMatchObject({
        origin: 'historical',
        recordMode: 'record_only',
        weddingId: first.wedding.id,
        vendorId: firstVendor.id,
        externalAgreementStatus: 'exists',
      })
      expect(created.agreedAmount?.toString()).toBe('3500')
      expect(created.payments).toHaveLength(1)
      expect(created.payments[0].amount.toString()).toBe('1000')
      expect(created.budgetItems.map((item) => item.id)).toEqual([firstBudget.id])

      const linkedBudget = await db.budgetItem.findUniqueOrThrow({ where: { id: firstBudget.id } })
      expect(linkedBudget.serviceEngagementId).toBe(created.id)

      await expect(createHistoricalEngagement({
        weddingId: first.wedding.id,
        actorId: actor.id,
        input: normalizeHistoricalEngagementInput({
          vendorId: secondVendor.id,
          serviceCategory: 'Photography',
          currency: 'USD',
        }),
      })).rejects.toBeInstanceOf(HistoricalEngagementConflictError)

      await expect(createHistoricalEngagement({
        weddingId: first.wedding.id,
        actorId: actor.id,
        input: normalizeHistoricalEngagementInput({
          vendorId: firstVendor.id,
          serviceCategory: 'Photography',
          currency: 'USD',
          budgetItemIds: [secondBudget.id],
        }),
      })).rejects.toBeInstanceOf(HistoricalEngagementConflictError)

      await expectDatabaseRejection(() => db.serviceEngagement.create({
        data: {
          weddingId: first.wedding.id,
          vendorId: firstVendor.id,
          origin: 'generated',
          recordMode: 'record_only',
          serviceCategory: 'Photography',
          currency: 'USD',
        },
      }))

      await expectDatabaseRejection(() => db.serviceEngagement.create({
        data: {
          weddingId: first.wedding.id,
          vendorId: firstVendor.id,
          origin: 'historical',
          recordMode: 'accepted',
          serviceCategory: 'Photography',
          currency: 'USD',
        },
      }))

      await expectDatabaseRejection(() => db.vendor.delete({ where: { id: firstVendor.id } }))

      const vaultObject = await db.vaultObject.create({
        data: {
          weddingId: first.wedding.id,
          storageProvider: 'supabase',
          objectKey: `phase0/${first.wedding.id}/${nonce}.pdf`,
          originalFilename: 'existing-agreement.pdf',
          displayName: 'Existing agreement',
          mimeType: 'application/pdf',
          extension: 'pdf',
          byteSize: 1234n,
          checksumSha256: 'a'.repeat(64),
          uploaderActorId: actor.id,
          uploadSource: 'planner_historical_engagement',
          storageState: 'stored',
          scanState: 'clean',
        },
      })
      const vaultLink = await db.vaultLink.create({
        data: {
          vaultObjectId: vaultObject.id,
          weddingId: first.wedding.id,
          entityType: 'service_engagement',
          entityId: created.id,
          linkRole: 'existing_agreement',
          createdById: actor.id,
        },
      })
      expect(vaultLink.weddingId).toBe(first.wedding.id)

      await expectDatabaseRejection(() => db.vaultLink.create({
        data: {
          vaultObjectId: vaultObject.id,
          weddingId: second.wedding.id,
          entityType: 'service_engagement',
          entityId: created.id,
          linkRole: 'proof',
          createdById: actor.id,
        },
      }))
    } finally {
      await db.vaultLink.deleteMany({
        where: { weddingId: { in: [first.wedding.id, second.wedding.id] } },
      })
      await db.vaultObject.deleteMany({
        where: { weddingId: { in: [first.wedding.id, second.wedding.id] } },
      })
      await db.engagementPayment.deleteMany({
        where: { serviceEngagement: { weddingId: { in: [first.wedding.id, second.wedding.id] } } },
      })
      await db.budgetItem.updateMany({
        where: { weddingId: { in: [first.wedding.id, second.wedding.id] } },
        data: { serviceEngagementId: null },
      })
      await db.serviceEngagement.deleteMany({
        where: { weddingId: { in: [first.wedding.id, second.wedding.id] } },
      })
      await db.budgetItem.deleteMany({
        where: { weddingId: { in: [first.wedding.id, second.wedding.id] } },
      })
      await db.vendor.deleteMany({
        where: { weddingId: { in: [first.wedding.id, second.wedding.id] } },
      })
      await db.user.deleteMany({ where: { email: `phase0-${nonce}@example.com` } })
      await db.wedding.deleteMany({ where: { id: { in: [first.wedding.id, second.wedding.id] } } })
      await db.couple.deleteMany({ where: { id: { in: [first.couple.id, second.couple.id] } } })
    }
  })
})
