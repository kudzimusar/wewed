import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
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
  dueDate: Date | null
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

    return NextResponse.json({
      success: true,
      count: items.length,
      data: items.map(formatItem),
      ...totals,
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
