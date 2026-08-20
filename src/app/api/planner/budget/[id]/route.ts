import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contributionId } from '@/lib/contributions/store'
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
  vendorName?: string | null
  notes?: string | null
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
  vendorName: string | null
  notes: string | null
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
      if (existing.serviceEngagementId && body.vendorId !== existing.vendorId) {
        return NextResponse.json(
          {
            success: false,
            code: 'BUDGET_ITEM_GOVERNED_VENDOR_LOCKED',
            error: 'This Budget item is linked to a historical service engagement. Its vendor link is preserved; update the engagement record rather than reassigning the Budget item.',
          },
          { status: 409 },
        )
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
      updates.vendorId = body.vendorId || null
    }
    if (body.vendorName !== undefined) updates.vendorName = body.vendorName?.trim() || null
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null
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

    const actorId = access.context.session.userId
    const weddingId = access.context.weddingId
    const updated = await db.$transaction(async (tx) => {
      if (body.paidAmount !== undefined) {
        const nextPaid = Math.max(0, body.paidAmount)
        await tx.$queryRaw<Array<{ locked: number }>>`
          SELECT 1::int AS locked
            FROM (SELECT pg_advisory_xact_lock(hashtext(${`budget-funding:${existing.id}`}))) AS lock_row
        `

        const classifiedRows = await tx.$queryRaw<Array<{ total: string }>>`
          SELECT COALESCE(SUM(amount), 0)::text AS total
            FROM wewed_contributions.payment_funding_allocations
           WHERE wedding_id = ${weddingId}
             AND budget_item_id = ${existing.id}
             AND currency = ${existing.currency}
             AND source_kind <> 'LEGACY_UNATTRIBUTED'
        `
        const classified = Number(classifiedRows[0]?.total ?? 0)
        if (nextPaid + 0.0001 < classified) throw new Error('PAID_BELOW_ATTRIBUTED')

        const targetLegacy = Math.max(0, nextPaid - classified)
        const legacyRows = await tx.$queryRaw<Array<{ id: string; amount: string }>>`
          SELECT id, amount::text AS amount
            FROM wewed_contributions.payment_funding_allocations
           WHERE wedding_id = ${weddingId}
             AND budget_item_id = ${existing.id}
             AND currency = ${existing.currency}
             AND source_kind = 'LEGACY_UNATTRIBUTED'
           ORDER BY created_at, id
           FOR UPDATE
        `

        let remainingLegacy = targetLegacy
        for (const row of legacyRows) {
          const rowAmount = Number(row.amount)
          if (remainingLegacy <= 0.0001) {
            await tx.$executeRaw`DELETE FROM wewed_contributions.payment_funding_allocations WHERE id = ${row.id}`
          } else if (rowAmount <= remainingLegacy + 0.0001) {
            remainingLegacy = Math.max(0, remainingLegacy - rowAmount)
          } else {
            await tx.$executeRaw`
              UPDATE wewed_contributions.payment_funding_allocations
                 SET amount = ${remainingLegacy}, updated_at = NOW()
               WHERE id = ${row.id}
            `
            remainingLegacy = 0
          }
        }

        if (remainingLegacy > 0.0001) {
          await tx.$executeRaw`
            INSERT INTO wewed_contributions.payment_funding_allocations
              (id, wedding_id, budget_item_id, source_kind, amount, currency, note, created_by_id)
            VALUES
              (${contributionId()}, ${weddingId}, ${existing.id}, 'LEGACY_UNATTRIBUTED', ${remainingLegacy}, ${existing.currency}, 'Budget paid amount changed before source was classified; funding source not recorded.', ${actorId})
          `
        }
      }

      const item = await tx.budgetItem.update({
        where: { id: existing.id },
        data: updates,
      })
      await tx.auditEvent.create({
        data: {
          weddingId,
          action: 'budget.updated',
          actorId,
          resourceType: 'BudgetItem',
          resourceId: existing.id,
          beforeValue: JSON.stringify({ paidAmount: existing.paidAmount, actualCost: existing.actualCost }),
          afterValue: JSON.stringify({ paidAmount: item.paidAmount, actualCost: item.actualCost }),
        },
      })
      return item
    })

    return NextResponse.json({ success: true, data: formatItem(updated) })
  } catch (error) {
    if (error instanceof Error && error.message === 'PAID_BELOW_ATTRIBUTED') {
      return NextResponse.json(
        { success: false, error: 'Paid amount cannot be reduced below funding that has already been attributed. Reverse or correct the funding attribution first.' },
        { status: 409 },
      )
    }
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
      select: { id: true, serviceEngagementId: true },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Budget item not found' },
        { status: 404 }
      )
    }
    if (existing.serviceEngagementId) {
      return NextResponse.json(
        {
          success: false,
          code: 'BUDGET_ITEM_HAS_SERVICE_ENGAGEMENT',
          error: 'This Budget item is linked to a governed historical service engagement and cannot be deleted. Preserve the record and correct its financial fields if needed.',
        },
        { status: 409 },
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
