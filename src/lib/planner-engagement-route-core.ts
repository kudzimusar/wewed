import { db } from '@/lib/db'
import type { HistoricalEngagementInput } from '@/lib/planner-historical-engagement'

export const historicalEngagementInclude = {
  vendor: { select: { id: true, name: true, category: true } },
  budgetItems: {
    select: {
      id: true,
      description: true,
      paidAmount: true,
      actualCost: true,
      estimatedCost: true,
      currency: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
  payments: { orderBy: [{ paidAt: 'asc' as const }, { createdAt: 'asc' as const }] },
}

export class HistoricalEngagementConflictError extends Error {
  field?: string
  status: number

  constructor(message: string, field?: string, status = 400) {
    super(message)
    this.name = 'HistoricalEngagementConflictError'
    this.field = field
    this.status = status
  }
}

export async function createHistoricalEngagement(args: {
  weddingId: string
  actorId: string
  input: HistoricalEngagementInput
}) {
  const { weddingId, actorId, input } = args
  const vendor = await db.vendor.findFirst({
    where: { id: input.vendorId, weddingId },
    select: { id: true },
  })
  if (!vendor) {
    throw new HistoricalEngagementConflictError(
      'Vendor does not belong to the active wedding.',
      'vendorId',
    )
  }

  const budgetItems = input.budgetItemIds.length
    ? await db.budgetItem.findMany({
        where: { id: { in: input.budgetItemIds }, weddingId },
        select: { id: true, vendorId: true, serviceEngagementId: true },
      })
    : []

  if (budgetItems.length !== input.budgetItemIds.length) {
    throw new HistoricalEngagementConflictError(
      'One or more budget items do not belong to the active wedding.',
      'budgetItemIds',
    )
  }

  const conflictingBudget = budgetItems.find(
    (item) => item.serviceEngagementId || (item.vendorId && item.vendorId !== vendor.id),
  )
  if (conflictingBudget) {
    throw new HistoricalEngagementConflictError(
      conflictingBudget.serviceEngagementId
        ? 'A selected budget item is already linked to another service engagement.'
        : 'A selected budget item is linked to a different vendor.',
      'budgetItemIds',
      409,
    )
  }

  return db.$transaction(async (tx) => {
    const engagement = await tx.serviceEngagement.create({
      data: {
        origin: input.origin,
        recordMode: input.recordMode,
        serviceCategory: input.serviceCategory,
        serviceDescription: input.serviceDescription,
        agreedAmount: input.agreedAmount,
        currency: input.currency,
        serviceDate: input.serviceDate ? new Date(input.serviceDate) : null,
        serviceLocation: input.serviceLocation,
        externalAgreementStatus: input.externalAgreementStatus,
        externalAgreementReference: input.externalAgreementReference,
        historicalBasis: input.historicalBasis,
        recordedById: actorId,
        weddingId,
        vendorId: vendor.id,
        payments: {
          create: input.payments.map((payment) => ({
            amount: payment.amount,
            currency: input.currency,
            paidAt: payment.paidAt ? new Date(payment.paidAt) : null,
            method: payment.method,
            reference: payment.reference,
            notes: payment.notes,
            recordedById: actorId,
          })),
        },
      },
    })

    if (budgetItems.length) {
      const linked = await tx.budgetItem.updateMany({
        where: {
          id: { in: budgetItems.map((item) => item.id) },
          weddingId,
          serviceEngagementId: null,
        },
        data: { serviceEngagementId: engagement.id },
      })
      if (linked.count !== budgetItems.length) {
        throw new HistoricalEngagementConflictError(
          'A selected budget item changed while the engagement was being saved. Refresh and retry.',
          'budgetItemIds',
          409,
        )
      }
    }

    return tx.serviceEngagement.findUniqueOrThrow({
      where: { id: engagement.id },
      include: historicalEngagementInclude,
    })
  })
}

export async function listHistoricalEngagements(weddingId: string) {
  return db.serviceEngagement.findMany({
    where: { weddingId, origin: 'historical' },
    include: historicalEngagementInclude,
    orderBy: [{ serviceDate: 'asc' }, { createdAt: 'desc' }],
  })
}

export function formatHistoricalEngagement(engagement: Awaited<ReturnType<typeof listHistoricalEngagements>>[number]) {
  const payments = engagement.payments.map((payment) => ({
    id: payment.id,
    amount: Number(payment.amount.toString()),
    currency: payment.currency,
    paidAt: payment.paidAt?.toISOString() ?? null,
    method: payment.method,
    reference: payment.reference,
    notes: payment.notes,
    createdAt: payment.createdAt.toISOString(),
  }))
  const totalRecordedPaid = payments.reduce((sum, payment) => sum + payment.amount, 0)
  const budgetPaid = engagement.budgetItems.reduce((sum, item) => sum + item.paidAmount, 0)

  return {
    id: engagement.id,
    origin: engagement.origin,
    recordMode: engagement.recordMode,
    serviceCategory: engagement.serviceCategory,
    serviceDescription: engagement.serviceDescription,
    agreedAmount: engagement.agreedAmount == null ? null : Number(engagement.agreedAmount.toString()),
    currency: engagement.currency,
    serviceDate: engagement.serviceDate?.toISOString() ?? null,
    serviceLocation: engagement.serviceLocation,
    externalAgreementStatus: engagement.externalAgreementStatus,
    externalAgreementReference: engagement.externalAgreementReference,
    historicalBasis: engagement.historicalBasis,
    recordedById: engagement.recordedById,
    weddingId: engagement.weddingId,
    vendorId: engagement.vendorId,
    vendor: engagement.vendor,
    budgetItems: engagement.budgetItems,
    payments,
    reconciliation: {
      totalRecordedPaid,
      budgetPaid,
      paymentDifference: Math.round((totalRecordedPaid - budgetPaid) * 100) / 100,
    },
    createdAt: engagement.createdAt.toISOString(),
    updatedAt: engagement.updatedAt.toISOString(),
  }
}
