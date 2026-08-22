import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contributionDatabaseUnavailable } from '@/lib/contributions'
import { budgetContributionAllocations, budgetContributionContexts, budgetFundingRows } from '@/lib/contributions/store'
import { listBudgetCommercialDocuments } from '@/lib/vault/commercial-documents'
import { requireWeddingPermission } from '@/lib/wedding-access'

const BUDGET_CATEGORIES = [
  'venue',
  'catering',
  'attire',
  'roora',
  'decor',
  'photo_video',
  'music',
  'transport',
  'stationery',
  'miscellaneous',
] as const

function formatItem(item: {
  id: string
  category: string
  description: string
  estimatedCost: number
  actualCost: number | null
  paidAmount: number
  currency: string
  vendorId: string | null
  vendorName: string | null
  notes: string | null
  dueDate: Date | null
  serviceEngagementId: string | null
  weddingId: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    ...item,
    dueDate: item.dueDate?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

function summarize(items: Array<{
  category: string
  estimatedCost: number
  actualCost: number | null
  paidAmount: number
  currency: string
}>) {
  const totalEstimated = items.reduce((sum, item) => sum + item.estimatedCost, 0)
  const totalActual = items.reduce(
    (sum, item) => sum + (item.actualCost ?? item.estimatedCost),
    0
  )
  const totalPaid = items.reduce((sum, item) => sum + item.paidAmount, 0)
  const totalOutstanding = Math.max(0, totalActual - totalPaid)

  const categories = new Map<
    string,
    { estimated: number; actual: number; paid: number; count: number }
  >()
  for (const item of items) {
    const current = categories.get(item.category) ?? {
      estimated: 0,
      actual: 0,
      paid: 0,
      count: 0,
    }
    current.estimated += item.estimatedCost
    current.actual += item.actualCost ?? item.estimatedCost
    current.paid += item.paidAmount
    current.count += 1
    categories.set(item.category, current)
  }

  return {
    summary: {
      totalEstimated,
      totalActual,
      totalPaid,
      totalOutstanding,
      currency: items[0]?.currency ?? 'USD',
      percentPaid: totalActual > 0 ? Math.round((totalPaid / totalActual) * 100) : 0,
      percentActualOfEstimated:
        totalEstimated > 0 ? Math.round((totalActual / totalEstimated) * 100) : 0,
    },
    byCategory: Array.from(categories.entries())
      .map(([category, value]) => ({
        category,
        ...value,
        outstanding: Math.max(0, value.actual - value.paid),
      }))
      .sort((a, b) => b.estimated - a.estimated),
  }
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'budget.view')
  if (access.error) return access.error

  try {
    const items = await db.budgetItem.findMany({
      where: { weddingId: access.context.weddingId },
      orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
    })
    const totals = summarize(items)
    const documentsByBudget = await listBudgetCommercialDocuments({
      weddingId: access.context.weddingId,
      budgetItems: items.map((item) => ({ id: item.id, serviceEngagementId: item.serviceEngagementId })),
    })

    let fundingRows: Awaited<ReturnType<typeof budgetFundingRows>> = []
    let contributionAllocations: Awaited<ReturnType<typeof budgetContributionAllocations>> = []
    let contributionContexts: Awaited<ReturnType<typeof budgetContributionContexts>> = []
    try {
      ;[fundingRows, contributionAllocations, contributionContexts] = await Promise.all([
        budgetFundingRows(access.context.weddingId),
        budgetContributionAllocations(access.context.weddingId),
        budgetContributionContexts(access.context.weddingId),
      ])
    } catch (error) {
      if (!contributionDatabaseUnavailable(error)) throw error
      // During an ordered deployment the existing Budget remains usable.
      // Every existing paid amount therefore stays source-not-recorded until the migration is active.
    }

    const data = items.map((item) => {
      const sources = fundingRows.filter((row) => row.budgetItemId === item.id && row.currency === item.currency)
      const coupleFunded = sources.filter((row) => row.sourceKind === 'COUPLE').reduce((sum, row) => sum + Number(row.amount), 0)
      const contributorFunded = sources.filter((row) => row.sourceKind === 'CONTRIBUTION').reduce((sum, row) => sum + Number(row.amount), 0)
      const explicitlyLegacy = sources.filter((row) => row.sourceKind === 'LEGACY_UNATTRIBUTED').reduce((sum, row) => sum + Number(row.amount), 0)
      const otherAttributed = sources.filter((row) => row.sourceKind === 'OTHER').reduce((sum, row) => sum + Number(row.amount), 0)
      const attributed = coupleFunded + contributorFunded + explicitlyLegacy + otherAttributed
      const legacyUnattributed = Math.max(0, item.paidAmount - attributed) + explicitlyLegacy
      const itemAllocations = contributionAllocations.filter((row) => row.budgetItemId === item.id && row.currency === item.currency)
      const inKindValue = itemAllocations.filter((row) => row.allocationKind === 'IN_KIND' && ['DELIVERED','COMPLETED'].includes(row.fulfillmentState)).reduce((sum, row) => sum + Number(row.amount), 0)
      const contributionAllocated = itemAllocations.filter((row) => row.allocationKind === 'CASH').reduce((sum, row) => sum + Number(row.amount), 0)
      const linkedContributions = Array.from(new Map(
        contributionContexts
          .filter((row) => row.budgetItemId === item.id && row.currency === item.currency)
          .map((row) => {
            const promisedAmount = Number(row.contributionAmount ?? 0)
            const paidAmount = Number(row.directPaidAmount ?? 0)
            return [row.contributionId, {
              contributionId: row.contributionId,
              contributorName: row.contributorName,
              title: row.title,
              notes: row.notes,
              type: row.type,
              commitmentState: row.commitmentState,
              fulfillmentState: row.fulfillmentState,
              promisedAmount,
              paidAmount,
              remainingAmount: row.type === 'DIRECT_VENDOR_PAYMENT' ? Math.max(0, promisedAmount - paidAmount) : 0,
              currency: row.currency,
            }] as const
          })
      ).values())
      return {
        ...formatItem(item),
        funding: { coupleFunded, contributorFunded, legacyUnattributed, otherAttributed, inKindValue, contributionAllocated },
        contributions: linkedContributions,
        documents: documentsByBudget.get(item.id) ?? [],
      }
    })

    const fundingSummary = data.reduce((sum, item) => ({
      coupleFunded: sum.coupleFunded + item.funding.coupleFunded,
      contributorFunded: sum.contributorFunded + item.funding.contributorFunded,
      legacyUnattributed: sum.legacyUnattributed + item.funding.legacyUnattributed,
      inKindValue: sum.inKindValue + item.funding.inKindValue,
    }), { coupleFunded: 0, contributorFunded: 0, legacyUnattributed: 0, inKindValue: 0 })

    return NextResponse.json({
      success: true,
      count: items.length,
      data,
      ...totals,
      fundingSummary,
    })
  } catch (error) {
    console.error('[PLANNER BUDGET GET] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch budget items' },
      { status: 500 }
    )
  }
}

interface CreateBudgetPayload {
  category?: string
  description?: string
  estimatedCost?: number
  actualCost?: number | null
  paidAmount?: number
  currency?: string
  vendorId?: string
  vendorName?: string | null
  notes?: string | null
  dueDate?: string | null
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error

  try {
    const body = (await request.json()) as CreateBudgetPayload
    if (!body.description || typeof body.description !== 'string' || !body.description.trim()) {
      return NextResponse.json(
        { success: false, error: 'Description is required' },
        { status: 400 }
      )
    }

    const category = BUDGET_CATEGORIES.includes(
      body.category as (typeof BUDGET_CATEGORIES)[number]
    )
      ? body.category!
      : 'miscellaneous'
    const estimatedCost =
      typeof body.estimatedCost === 'number' && Number.isFinite(body.estimatedCost)
        ? Math.max(0, body.estimatedCost)
        : 0
    const actualCost =
      typeof body.actualCost === 'number' && Number.isFinite(body.actualCost)
        ? Math.max(0, body.actualCost)
        : null
    const paidAmount =
      typeof body.paidAmount === 'number' && Number.isFinite(body.paidAmount)
        ? Math.max(0, body.paidAmount)
        : 0
    const currency =
      typeof body.currency === 'string' && /^[A-Za-z]{3,6}$/.test(body.currency)
        ? body.currency.toUpperCase()
        : 'USD'

    let dueDate: Date | null = null
    if (body.dueDate) {
      const parsed = new Date(body.dueDate)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid dueDate' },
          { status: 400 }
        )
      }
      dueDate = parsed
    }

    if (body.vendorId) {
      const vendor = await db.vendor.findFirst({
        where: { id: body.vendorId, weddingId: access.context.weddingId },
        select: { id: true },
      })
      if (!vendor) {
        return NextResponse.json(
          { success: false, error: 'Vendor does not belong to the active wedding.' },
          { status: 400 }
        )
      }
    }

    const item = await db.budgetItem.create({
      data: {
        category,
        description: body.description.trim(),
        estimatedCost,
        actualCost,
        paidAmount,
        currency,
        vendorId: body.vendorId || null,
        vendorName: body.vendorName?.trim() || null,
        notes: body.notes?.trim() || null,
        dueDate,
        weddingId: access.context.weddingId,
      },
    })

    return NextResponse.json(
      { success: true, data: formatItem(item) },
      { status: 201 }
    )
  } catch (error) {
    console.error('[PLANNER BUDGET POST] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create budget item' },
      { status: 500 }
    )
  }
}
