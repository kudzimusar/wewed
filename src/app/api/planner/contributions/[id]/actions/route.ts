import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contributionAvailableAmount, finiteNonNegative } from '@/lib/contributions'
import { contributionAllocatedCash, contributionId, getContribution } from '@/lib/contributions/store'
import { contextHasPermission, requireWeddingPermission } from '@/lib/wedding-access'

interface RouteContext { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const { id } = await context.params
  const weddingId = access.context.weddingId
  const actorId = access.context.session.userId
  try {
    const contribution = await getContribution(weddingId, id)
    if (!contribution) return NextResponse.json({ success: false, error: 'Contribution not found.' }, { status: 404 })
    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action ?? '')

    if (action === 'allocate') {
      const budgetItemId = String(body.budgetItemId ?? '')
      const amount = finiteNonNegative(body.amount)
      if (!budgetItemId || !amount || amount <= 0) return NextResponse.json({ success: false, error: 'Choose a budget item and amount.' }, { status: 400 })
      const budget = await db.budgetItem.findFirst({ where: { id: budgetItemId, weddingId }, select: { id: true, currency: true } })
      if (!budget) return NextResponse.json({ success: false, error: 'Budget item not found for this wedding.' }, { status: 404 })
      if (budget.currency !== contribution.currency) return NextResponse.json({ success: false, error: 'Allocation currency must match the contribution and budget item.' }, { status: 400 })
      const allocatedAmount = await contributionAllocatedCash(weddingId, id)
      const available = contributionAvailableAmount({ type: contribution.type, amount: contribution.amount, fulfillmentState: contribution.fulfillmentState, allocatedAmount })
      if (amount > available + 0.0001) return NextResponse.json({ success: false, error: `Only ${contribution.currency} ${available.toFixed(2)} is still available to allocate.` }, { status: 409 })
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO wewed_contributions.contribution_allocations
            (id, wedding_id, contribution_id, budget_item_id, amount, currency, allocation_kind, note, created_by_id)
          VALUES
            (${contributionId()}, ${weddingId}, ${id}, ${budgetItemId}, ${amount}, ${contribution.currency}, 'CASH', ${String(body.note ?? '').trim() || null}, ${actorId})
        `
        await tx.auditEvent.create({ data: { weddingId, eventType: 'contribution.allocated', actorType: 'user', actorId, targetType: 'WeddingContribution', targetId: id, payload: JSON.stringify({ budgetItemId, amount, currency: contribution.currency }), severity: 'info' } })
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'create-task') {
      if (!contextHasPermission(access.context, 'planner.edit')) return NextResponse.json({ success: false, error: 'You do not have permission to create Planner tasks.' }, { status: 403 })
      const title = String(body.title ?? `Follow up contribution from ${contribution.contributorName}`).trim()
      if (!title) return NextResponse.json({ success: false, error: 'Task title is required.' }, { status: 400 })
      const task = await db.$transaction(async (tx) => {
        const created = await tx.plannerTask.create({ data: { weddingId, title, description: String(body.description ?? contribution.title).trim() || null, category: 'other', status: 'todo', priority: 'medium', dueDate: body.dueDate ? new Date(String(body.dueDate)) : null, assigneeUserId: actorId } })
        await tx.$executeRaw`
          INSERT INTO wewed_contributions.task_links
            (id, wedding_id, contribution_id, planner_task_id, link_role)
          VALUES
            (${contributionId()}, ${weddingId}, ${id}, ${created.id}, ${String(body.linkRole ?? 'follow_up')})
        `
        return created
      })
      return NextResponse.json({ success: true, data: task })
    }

    if (action === 'mark-thanked') {
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE wewed_contributions.wedding_contributions SET thank_you_state = 'SENT', updated_at = NOW() WHERE id = ${id} AND wedding_id = ${weddingId}`
        await tx.auditEvent.create({ data: { weddingId, eventType: 'contribution.thanked', actorType: 'user', actorId, targetType: 'WeddingContribution', targetId: id, severity: 'info' } })
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'mark-received') {
      if (contribution.fulfillmentState !== 'PENDING') return NextResponse.json({ success: false, error: 'Only pending contributions can be marked received from this action.' }, { status: 409 })
      const nextState = ['GOODS_IN_KIND','SERVICE_IN_KIND','TIME_LABOUR','DISCOUNT_SPONSORSHIP'].includes(contribution.type) ? 'DELIVERED' : contribution.type === 'DIRECT_VENDOR_PAYMENT' ? 'PAID_DIRECT' : 'RECEIVED'
      if (nextState === 'PAID_DIRECT') return NextResponse.json({ success: false, error: 'Direct vendor payments need a service engagement and payment record. Edit through the direct-payment flow instead.' }, { status: 409 })
      await db.$executeRaw`UPDATE wewed_contributions.wedding_contributions SET fulfillment_state = ${nextState}, commitment_state = 'CONFIRMED', thank_you_state = 'TO_THANK', fulfilled_at = NOW(), updated_at = NOW() WHERE id = ${id} AND wedding_id = ${weddingId}`
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Unsupported contribution action.' }, { status: 400 })
  } catch (error) {
    console.error('[CONTRIBUTION ACTION] error', error)
    return NextResponse.json({ success: false, error: 'Could not complete the contribution action.' }, { status: 500 })
  }
}
