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

interface PatchBudgetPayload {
  category?: string
  description?: string
  estimatedCost?: number
  actualCost?: number | null
  paidAmount?: number
  currency?: string
  vendorId?: string | null
  dueDate?: string | null
}

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error

  try {
    const { id } = await params
    const existing = await db.budgetItem.findFirst({
      where: { id, weddingId: access.context.weddingId },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Budget item not found' },
        { status: 404 }
      )
    }

    const body = (await request.json()) as PatchBudgetPayload
    const updates: Record<string, unknown> = {}

    if (body.category !== undefined) {
      if (!BUDGET_CATEGORIES.includes(body.category as (typeof BUDGET_CATEGORIES)[number])) {
        return NextResponse.json(
          { success: false, error: `Invalid category. Allowed: ${BUDGET_CATEGORIES.join(', ')}` },
          { status: 400 }
        )
      }
      updates.category = body.category
    }
    if (body.description !== undefined) {
      if (typeof body.description !== 'string' || !body.description.trim()) {
        return NextResponse.json(
          { success: false, error: 'Description cannot be empty' },
          { status: 400 }
        )
      }
      updates.description = body.description.trim()
    }
    if (body.estimatedCost !== undefined) {
      if (typeof body.estimatedCost !== 'number' || !Number.isFinite(body.estimatedCost)) {
        return NextResponse.json(
          { success: false, error: 'estimatedCost must be a number' },
          { status: 400 }
        )
      }
      updates.estimatedCost = Math.max(0, body.estimatedCost)
    }
    if (body.actualCost !== undefined) {
      if (body.actualCost === null) updates.actualCost = null
      else if (typeof body.actualCost !== 'number' || !Number.isFinite(body.actualCost)) {
        return NextResponse.json(
          { success: false, error: 'actualCost must be a number or null' },
          { status: 400 }
        )
      } else updates.actualCost = Math.max(0, body.actualCost)
    }
    if (body.paidAmount !== undefined) {
      if (typeof body.paidAmount !== 'number' || !Number.isFinite(body.paidAmount)) {
        return NextResponse.json(
          { success: false, error: 'paidAmount must be a number' },
          { status: 400 }
        )
      }
      updates.paidAmount = Math.max(0, body.paidAmount)
    }
    if (body.currency !== undefined) {
      if (!/^[A-Za-z]{3,6}$/.test(body.currency)) {
        return NextResponse.json(
          { success: false, error: 'Invalid currency code' },
          { status: 400 }
        )
      }
      updates.currency = body.currency.toUpperCase()
    }
    if (body.vendorId !== undefined) {
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
      updates.vendorId = body.vendorId || null
    }
    if (body.dueDate !== undefined) {
      if (body.dueDate === null || body.dueDate === '') updates.dueDate = null
      else {
        const parsed = new Date(body.dueDate)
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json(
            { success: false, error: 'Invalid dueDate' },
            { status: 400 }
          )
        }
        updates.dueDate = parsed
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      )
    }

    const updated = await db.budgetItem.update({
      where: { id: existing.id },
      data: updates,
    })
    return NextResponse.json({ success: true, data: formatItem(updated) })
  } catch (error) {
    console.error('[PLANNER BUDGET PATCH] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update budget item' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error

  try {
    const { id } = await params
    const existing = await db.budgetItem.findFirst({
      where: { id, weddingId: access.context.weddingId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Budget item not found' },
        { status: 404 }
      )
    }

    await db.budgetItem.delete({ where: { id: existing.id } })
    return NextResponse.json({ success: true, data: { id, deleted: true } })
  } catch (error) {
    console.error('[PLANNER BUDGET DELETE] error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete budget item' },
      { status: 500 }
    )
  }
}
