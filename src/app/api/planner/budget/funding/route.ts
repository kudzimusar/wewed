import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contributionAvailableAmount, finiteNonNegative } from '@/lib/contributions'
import { contributionAllocatedCash, contributionId, getContribution } from '@/lib/contributions/store'
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

    const contributionIdValue = sourceKind === 'CONTRIBUTION' ? String(body.contributionId ?? '').trim() || null : null
    if (sourceKind === 'CONTRIBUTION' && !contributionIdValue) {
      return NextResponse.json({ success: false, error: 'Choose the contribution that funded this payment.' }, { status: 400 })
    }

    await db.$transaction(async (tx) => {
      // Serialize funding edits for this budget item so two browser sessions cannot
      // both consume the same remaining historical "Paid" amount.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`budget-funding:${budgetItemId}`}))`

      const budget = await tx.budgetItem.findFirst({ where: { id: budgetItemId, weddingId }, select: { id: true, paidAmount: true, currency: true } })
      if (!budget) throw new Error('BUDGET_NOT_FOUND')

      const totals = await tx.$queryRaw<Array<{ total: string }>>`
        SELECT COALESCE(SUM(amount), 0)::text AS total
          FROM wewed_contributions.payment_funding_allocations
         WHERE wedding_id = ${weddingId} AND budget_item_id = ${budgetItemId} AND currency = ${budget.currency}
      `
      const already = Number(totals[0]?.total ?? 0)
      if (already + amount > budget.paidAmount + 0.0001) throw new Error('FUNDING_EXCEEDS_PAID')

      if (sourceKind === 'CONTRIBUTION' && contributionIdValue) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`contribution-funding:${contributionIdValue}`}))`
        const contribution = await getContribution(weddingId, contributionIdValue, tx)
        if (!contribution) throw new Error('CONTRIBUTION_NOT_FOUND')
        if (contribution.currency !== budget.currency) throw new Error('CURRENCY_MISMATCH')
        if (!['CASH_TO_COUPLE', 'HONEYMOON_GIFT'].includes(contribution.type) || contribution.fulfillmentState !== 'RECEIVED') {
          throw new Error('CONTRIBUTION_NOT_AVAILABLE_CASH')
        }

        const [allocatedAmount, itemAllocationRows, itemFundingRows] = await Promise.all([
          contributionAllocatedCash(weddingId, contributionIdValue, tx),
          tx.$queryRaw<Array<{ total: string }>>`
            SELECT COALESCE(SUM(amount), 0)::text AS total
              FROM wewed_contributions.contribution_allocations
             WHERE wedding_id = ${weddingId}
               AND contribution_id = ${contributionIdValue}
               AND budget_item_id = ${budgetItemId}
               AND currency = ${budget.currency}
               AND allocation_kind = 'CASH'
          `,
          tx.$queryRaw<Array<{ total: string }>>`
            SELECT COALESCE(SUM(amount), 0)::text AS total
              FROM wewed_contributions.payment_funding_allocations
             WHERE wedding_id = ${weddingId}
               AND contribution_id = ${contributionIdValue}
               AND budget_item_id = ${budgetItemId}
               AND currency = ${budget.currency}
               AND source_kind = 'CONTRIBUTION'
          `,
        ])

        const available = contributionAvailableAmount({
          type: contribution.type,
          amount: contribution.amount,
          fulfillmentState: contribution.fulfillmentState,
          allocatedAmount,
        })
        const itemAllocated = Number(itemAllocationRows[0]?.total ?? 0)
        const itemAlreadyFunded = Number(itemFundingRows[0]?.total ?? 0)
        const reservedRemaining = Math.max(0, itemAllocated - itemAlreadyFunded)
        const additionalReservation = Math.max(0, amount - reservedRemaining)

        if (additionalReservation > available + 0.0001) throw new Error('CONTRIBUTION_INSUFFICIENT_AVAILABLE')
        if (additionalReservation > 0) {
          await tx.$executeRaw`
            INSERT INTO wewed_contributions.contribution_allocations
              (id, wedding_id, contribution_id, budget_item_id, amount, currency, allocation_kind, note, created_by_id)
            VALUES
              (${contributionId()}, ${weddingId}, ${contributionIdValue}, ${budgetItemId}, ${additionalReservation}, ${budget.currency}, 'CASH', 'Reserved while classifying an existing paid amount', ${actorId})
          `
        }
      }

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
    const code = error instanceof Error ? error.message : ''
    const known: Record<string, { status: number; error: string }> = {
      BUDGET_NOT_FOUND: { status: 404, error: 'Budget item not found.' },
      FUNDING_EXCEEDS_PAID: { status: 409, error: 'Funding attribution cannot exceed the amount already marked paid.' },
      CONTRIBUTION_NOT_FOUND: { status: 404, error: 'Contribution not found.' },
      CURRENCY_MISMATCH: { status: 400, error: 'Contribution and budget currencies must match.' },
      CONTRIBUTION_NOT_AVAILABLE_CASH: { status: 409, error: 'Choose received contribution money. Promises, in-kind help, and direct vendor payments cannot fund this historical paid amount.' },
      CONTRIBUTION_INSUFFICIENT_AVAILABLE: { status: 409, error: 'That contribution does not have enough uncommitted money remaining for this paid amount.' },
    }
    if (known[code]) return NextResponse.json({ success: false, error: known[code].error }, { status: known[code].status })
    console.error('[BUDGET FUNDING POST] error', error)
    return NextResponse.json({ success: false, error: 'Could not save the funding source.' }, { status: 500 })
  }
}
