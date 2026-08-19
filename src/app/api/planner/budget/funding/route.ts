import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { finiteNonNegative } from '@/lib/contributions'
import { contributionId, getContribution } from '@/lib/contributions/store'
import { requireWeddingPermission } from '@/lib/wedding-access'

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'budget.view')
  if (access.error) return access.error
  const weddingId = access.context.weddingId
  try {
    const [items, rows] = await Promise.all([
      db.budgetItem.findMany({ where: { weddingId, paidAmount: { gt: 0 } }, select: { id: true, description: true, paidAmount: true, currency: true, category: true }, orderBy: [{ category: 'asc' }, { description: 'asc' }] }),
      db.$queryRaw<Array<{ budgetItemId: string; sourceKind: string; contributionId: string | null; amount: string; currency: string }>>`
        SELECT budget_item_id AS "budgetItemId", source_kind AS "sourceKind", contribution_id AS "contributionId", amount::text AS amount, currency
          FROM wewed_contributions.payment_funding_allocations
         WHERE wedding_id = ${weddingId} AND budget_item_id IS NOT NULL
      `,
    ])
    const data = items.map((item) => {
      const funding = rows.filter((row) => row.budgetItemId === item.id && row.currency === item.currency)
      const attributed = funding.reduce((sum, row) => sum + Number(row.amount), 0)
      return { ...item, funding: funding.map((row) => ({ ...row, amount: Number(row.amount) })), unattributed: Math.max(0, item.paidAmount - attributed) }
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[BUDGET FUNDING GET] error', error)
    return NextResponse.json({ success: false, error: 'Could not load payment funding sources.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const weddingId = access.context.weddingId
  const actorId = access.context.session.userId
  try {
    const body = (await request.json()) as Record<string, unknown>
    const budgetItemId = String(body.budgetItemId ?? '')
    const sourceKind = String(body.sourceKind ?? '')
    const amount = finiteNonNegative(body.amount)
    if (!budgetItemId || !['COUPLE','CONTRIBUTION','LEGACY_UNATTRIBUTED','OTHER'].includes(sourceKind) || !amount || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Choose a funding source and positive amount.' }, { status: 400 })
    }
    const budget = await db.budgetItem.findFirst({ where: { id: budgetItemId, weddingId }, select: { id: true, paidAmount: true, currency: true } })
    if (!budget) return NextResponse.json({ success: false, error: 'Budget item not found.' }, { status: 404 })
    const totals = await db.$queryRaw<Array<{ total: string }>>`
      SELECT COALESCE(SUM(amount), 0)::text AS total
        FROM wewed_contributions.payment_funding_allocations
       WHERE wedding_id = ${weddingId} AND budget_item_id = ${budgetItemId} AND currency = ${budget.currency}
    `
    const already = Number(totals[0]?.total ?? 0)
    if (already + amount > budget.paidAmount + 0.0001) return NextResponse.json({ success: false, error: 'Funding attribution cannot exceed the amount already marked paid.' }, { status: 409 })

    let contributionIdValue: string | null = null
    if (sourceKind === 'CONTRIBUTION') {
      contributionIdValue = String(body.contributionId ?? '') || null
      if (!contributionIdValue) return NextResponse.json({ success: false, error: 'Choose the contribution that funded this payment.' }, { status: 400 })
      const contribution = await getContribution(weddingId, contributionIdValue)
      if (!contribution) return NextResponse.json({ success: false, error: 'Contribution not found.' }, { status: 404 })
      if (contribution.currency !== budget.currency) return NextResponse.json({ success: false, error: 'Contribution and budget currencies must match.' }, { status: 400 })
    }

    await db.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO wewed_contributions.payment_funding_allocations
          (id, wedding_id, budget_item_id, contribution_id, source_kind, amount, currency, note, created_by_id, reconciled_at)
        VALUES
          (${contributionId()}, ${weddingId}, ${budgetItemId}, ${contributionIdValue}, ${sourceKind}, ${amount}, ${budget.currency}, ${String(body.note ?? '').trim() || null}, ${actorId}, NOW())
      `
      await tx.auditEvent.create({ data: { weddingId, eventType: 'budget.funding_attributed', actorType: 'user', actorId, targetType: 'BudgetItem', targetId: budgetItemId, payload: JSON.stringify({ sourceKind, amount, currency: budget.currency, contributionId: contributionIdValue }), severity: 'info' } })
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[BUDGET FUNDING POST] error', error)
    return NextResponse.json({ success: false, error: 'Could not save the funding source.' }, { status: 500 })
  }
}
