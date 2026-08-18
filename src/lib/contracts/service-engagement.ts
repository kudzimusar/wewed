import { db } from '@/lib/db'

export class CurrentEngagementError extends Error {
  status: number
  field?: string
  constructor(message: string, status = 400, field?: string) {
    super(message)
    this.name = 'CurrentEngagementError'
    this.status = status
    this.field = field
  }
}

export type CurrentEngagementInput = {
  vendorId: string
  serviceCategory: string
  serviceDescription?: string | null
  agreedAmount?: number | null
  currency?: string
  serviceDate?: string | null
  serviceLocation?: string | null
  budgetItemIds?: string[]
}

function cleanText(value: unknown, max = 5000): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  return text.slice(0, max)
}

export function normalizeCurrentEngagementInput(raw: unknown): CurrentEngagementInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new CurrentEngagementError('Engagement details are required.')
  const value = raw as Record<string, unknown>
  const vendorId = cleanText(value.vendorId, 200)
  const serviceCategory = cleanText(value.serviceCategory, 160)
  if (!vendorId) throw new CurrentEngagementError('Vendor is required.', 400, 'vendorId')
  if (!serviceCategory) throw new CurrentEngagementError('Service category is required.', 400, 'serviceCategory')

  const amountRaw = value.agreedAmount
  const agreedAmount = amountRaw == null || amountRaw === '' ? null : Number(amountRaw)
  if (agreedAmount != null && (!Number.isFinite(agreedAmount) || agreedAmount < 0)) {
    throw new CurrentEngagementError('Agreed amount must be zero or greater.', 400, 'agreedAmount')
  }
  const currency = (cleanText(value.currency, 3) ?? 'USD').toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) throw new CurrentEngagementError('Currency must be a three-letter code.', 400, 'currency')
  const serviceDate = cleanText(value.serviceDate, 80)
  if (serviceDate && Number.isNaN(new Date(serviceDate).getTime())) throw new CurrentEngagementError('Service date is invalid.', 400, 'serviceDate')

  const budgetItemIds = Array.isArray(value.budgetItemIds)
    ? [...new Set(value.budgetItemIds.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim()))]
    : []

  return {
    vendorId,
    serviceCategory,
    serviceDescription: cleanText(value.serviceDescription),
    agreedAmount,
    currency,
    serviceDate,
    serviceLocation: cleanText(value.serviceLocation, 500),
    budgetItemIds,
  }
}

export async function createCurrentServiceEngagement(args: {
  weddingId: string
  actorId: string
  actorName: string
  actorEmail?: string | null
  input: CurrentEngagementInput
}) {
  const { weddingId, actorId, actorName, actorEmail, input } = args
  const [wedding, vendor] = await Promise.all([
    db.wedding.findUnique({
      where: { id: weddingId },
      include: { couple: true },
    }),
    db.vendor.findFirst({ where: { id: input.vendorId, weddingId } }),
  ])
  if (!wedding) throw new CurrentEngagementError('Wedding was not found.', 404)
  if (!vendor) throw new CurrentEngagementError('Vendor does not belong to the active wedding.', 400, 'vendorId')

  const budgetItems = input.budgetItemIds?.length
    ? await db.budgetItem.findMany({
        where: { id: { in: input.budgetItemIds }, weddingId },
        select: { id: true, vendorId: true, serviceEngagementId: true },
      })
    : []
  if (budgetItems.length !== (input.budgetItemIds?.length ?? 0)) {
    throw new CurrentEngagementError('One or more Budget items do not belong to the active wedding.', 400, 'budgetItemIds')
  }
  if (budgetItems.some((item) => item.serviceEngagementId || (item.vendorId && item.vendorId !== vendor.id))) {
    throw new CurrentEngagementError('A selected Budget item is already committed to another engagement or vendor.', 409, 'budgetItemIds')
  }

  return db.$transaction(async (tx) => {
    const engagement = await tx.serviceEngagement.create({
      data: {
        origin: 'current',
        recordMode: 'managed_contract',
        lifecycleStatus: 'draft',
        serviceCategory: input.serviceCategory,
        serviceDescription: input.serviceDescription ?? null,
        agreedAmount: input.agreedAmount ?? null,
        currency: input.currency ?? 'USD',
        serviceDate: input.serviceDate ? new Date(input.serviceDate) : null,
        serviceLocation: input.serviceLocation ?? null,
        externalAgreementStatus: 'none',
        createdById: actorId,
        weddingId,
        vendorId: vendor.id,
        parties: {
          create: [
            {
              weddingId,
              partyRole: 'CLIENT',
              partyKind: 'COUPLE',
              displayName: `${wedding.couple.partner1} & ${wedding.couple.partner2}`,
              entityId: wedding.couple.id,
              authorityBasis: 'client_couple_record',
              requiredForReview: true,
              createdById: actorId,
            },
            {
              weddingId,
              partyRole: 'PLANNER',
              partyKind: 'PERSON',
              displayName: actorName || actorEmail || 'Planner',
              email: actorEmail ?? null,
              userId: actorId,
              entityId: actorId,
              authorityBasis: 'planning_workflow_approver_not_inferred_legal_agency',
              requiredForReview: true,
              createdById: actorId,
            },
            {
              weddingId,
              partyRole: 'SERVICE_PROVIDER',
              partyKind: 'VENDOR',
              displayName: vendor.name,
              legalName: vendor.name,
              email: vendor.email,
              phone: vendor.phone,
              entityId: vendor.id,
              authorityBasis: 'service_provider_record',
              requiredForReview: true,
              createdById: actorId,
            },
          ],
        },
      },
      include: { parties: true, vendor: true, budgetItems: true, payments: true, contracts: true },
    })

    if (budgetItems.length) {
      const linked = await tx.budgetItem.updateMany({
        where: { id: { in: budgetItems.map((item) => item.id) }, weddingId, serviceEngagementId: null },
        data: { serviceEngagementId: engagement.id },
      })
      if (linked.count !== budgetItems.length) throw new CurrentEngagementError('Budget linkage changed while saving. Refresh and retry.', 409)
    }

    return tx.serviceEngagement.findUniqueOrThrow({
      where: { id: engagement.id },
      include: {
        vendor: true,
        parties: { orderBy: [{ partyRole: 'asc' }, { createdAt: 'asc' }] },
        budgetItems: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }] },
        contracts: { include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } }, orderBy: { createdAt: 'desc' } },
      },
    })
  })
}

export async function getCurrentServiceEngagement(weddingId: string, engagementId: string) {
  const engagement = await db.serviceEngagement.findFirst({
    where: { id: engagementId, weddingId, origin: 'current', recordMode: 'managed_contract' },
    include: {
      wedding: { include: { couple: true } },
      vendor: true,
      parties: { orderBy: [{ partyRole: 'asc' }, { createdAt: 'asc' }] },
      budgetItems: { orderBy: { createdAt: 'asc' } },
      payments: { orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }] },
      contracts: {
        include: {
          template: true,
          versions: { orderBy: { versionNumber: 'desc' } },
          events: { orderBy: { createdAt: 'desc' }, take: 100 },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!engagement) throw new CurrentEngagementError('Service Engagement was not found.', 404)
  return engagement
}

export async function listCurrentServiceEngagements(weddingId: string) {
  return db.serviceEngagement.findMany({
    where: { weddingId, origin: 'current', recordMode: 'managed_contract' },
    include: {
      vendor: true,
      parties: true,
      budgetItems: true,
      payments: true,
      contracts: { include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } }, orderBy: { createdAt: 'desc' } },
    },
    orderBy: [{ serviceDate: 'asc' }, { createdAt: 'desc' }],
  })
}

export async function updateCurrentServiceEngagement(args: {
  weddingId: string
  engagementId: string
  input: Partial<Pick<CurrentEngagementInput, 'serviceCategory' | 'serviceDescription' | 'agreedAmount' | 'currency' | 'serviceDate' | 'serviceLocation'>>
}) {
  const { weddingId, engagementId, input } = args
  const existing = await db.serviceEngagement.findFirst({
    where: { id: engagementId, weddingId, origin: 'current', recordMode: 'managed_contract' },
    include: { contracts: { include: { versions: { where: { issuedAt: { not: null } }, select: { id: true }, take: 1 } } } },
  })
  if (!existing) throw new CurrentEngagementError('Service Engagement was not found.', 404)
  if (existing.contracts.some((contract) => contract.versions.length > 0)) {
    throw new CurrentEngagementError('Issued commercial terms cannot be edited in place. A governed amendment is required in Phase 3.', 409)
  }
  return db.serviceEngagement.update({
    where: { id: existing.id },
    data: {
      ...(input.serviceCategory !== undefined ? { serviceCategory: input.serviceCategory } : {}),
      ...(input.serviceDescription !== undefined ? { serviceDescription: input.serviceDescription } : {}),
      ...(input.agreedAmount !== undefined ? { agreedAmount: input.agreedAmount } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.serviceDate !== undefined ? { serviceDate: input.serviceDate ? new Date(input.serviceDate) : null } : {}),
      ...(input.serviceLocation !== undefined ? { serviceLocation: input.serviceLocation } : {}),
    },
  })
}
