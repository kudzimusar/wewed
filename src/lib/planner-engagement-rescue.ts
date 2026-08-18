import { db } from '@/lib/db'

export async function calculatePaidVendorRescue(weddingId: string) {
  const vendors = await db.vendor.findMany({
    where: {
      weddingId,
      OR: [
        { paymentStatus: { in: ['paid', 'deposit', 'partial', 'partially_paid'] } },
        { budgetItems: { some: { paidAmount: { gt: 0 } } } },
      ],
    },
    select: {
      id: true,
      name: true,
      category: true,
      paymentStatus: true,
      budgetItems: {
        select: {
          id: true,
          paidAmount: true,
          actualCost: true,
          estimatedCost: true,
          serviceEngagementId: true,
        },
      },
      serviceEngagements: {
        select: { id: true, agreedAmount: true, externalAgreementStatus: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const engagementIds = vendors.flatMap((vendor) => vendor.serviceEngagements.map((item) => item.id))
  const proofLinks = engagementIds.length
    ? await db.vaultLink.findMany({
        where: {
          weddingId,
          entityType: 'service_engagement',
          entityId: { in: engagementIds },
          linkRole: { in: ['proof', 'invoice', 'receipt', 'existing_agreement', 'evidence'] },
        },
        select: { entityId: true },
      })
    : []
  const proofIds = new Set(proofLinks.map((link) => link.entityId))

  const data = vendors.map((vendor) => {
    const paidAmount = vendor.budgetItems.reduce((sum, item) => sum + item.paidAmount, 0)
    const budgetAmount = vendor.budgetItems.reduce(
      (sum, item) => sum + (item.actualCost ?? item.estimatedCost),
      0,
    )
    const hasEngagement = vendor.serviceEngagements.length > 0
    const hasProof = vendor.serviceEngagements.some((item) => proofIds.has(item.id))
    const hasKnownAgreement = vendor.serviceEngagements.some(
      (item) => item.externalAgreementStatus === 'exists',
    )
    const engagementAmount = vendor.serviceEngagements.reduce(
      (sum, item) => sum + (item.agreedAmount == null ? 0 : Number(item.agreedAmount.toString())),
      0,
    )

    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      category: vendor.category,
      paymentStatus: vendor.paymentStatus,
      paidAmount,
      budgetAmount,
      engagementAmount,
      engagementCount: vendor.serviceEngagements.length,
      flags: {
        paidWithoutEngagement: !hasEngagement,
        paidWithoutProof: hasEngagement && !hasProof,
        paidWithoutKnownAgreement: hasEngagement && !hasKnownAgreement,
        partiallyPaid: paidAmount > 0 && budgetAmount > paidAmount,
        budgetEngagementMismatch:
          hasEngagement && engagementAmount > 0 && Math.abs(engagementAmount - budgetAmount) >= 0.01,
      },
    }
  })

  return {
    count: data.length,
    summary: {
      paidVendors: data.length,
      missingEngagement: data.filter((item) => item.flags.paidWithoutEngagement).length,
      missingProof: data.filter((item) => item.flags.paidWithoutProof).length,
      mismatchedAmount: data.filter((item) => item.flags.budgetEngagementMismatch).length,
    },
    data,
  }
}

export type PaidVendorRescueResult = Awaited<ReturnType<typeof calculatePaidVendorRescue>>
