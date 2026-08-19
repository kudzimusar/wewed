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
        await tx.auditEvent.create({ data: { weddingId, action: 'contribution.allocated', actorId, resourceType: 'WeddingContribution', resourceId: id, afterValue: JSON.stringify({ budgetItemId, amount, currency: contribution.currency })} })
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
        await tx.auditEvent.create({ data: { weddingId, action: 'contribution.task_linked', actorId, resourceType: 'WeddingContribution', resourceId: id, afterValue: JSON.stringify({ plannerTaskId: created.id })} })
        return created
      })
      return NextResponse.json({ success: true, data: task })
    }

    if (action === 'mark-thanked') {
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE wewed_contributions.wedding_contributions SET thank_you_state = 'SENT', updated_at = NOW() WHERE id = ${id} AND wedding_id = ${weddingId}`
        await tx.auditEvent.create({ data: { weddingId, action: 'contribution.thanked', actorId, resourceType: 'WeddingContribution', resourceId: id} })
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'mark-direct-paid') {
      if (contribution.type !== 'DIRECT_VENDOR_PAYMENT') return NextResponse.json({ success: false, error: 'This action is only for direct vendor contributions.' }, { status: 409 })
      const paymentReference = String(body.paymentReference ?? '').trim() || null
      const paymentMethod = String(body.paymentMethod ?? '').trim() || null
      const paidAt = body.paidAt ? new Date(String(body.paidAt)) : new Date()
      if (Number.isNaN(paidAt.getTime())) return NextResponse.json({ success: false, error: 'Use a valid payment date.' }, { status: 400 })
      try {
        const result = await db.$transaction(async (tx) => {
          const lockedRows = await tx.$queryRaw<Array<{ fulfillmentState: string; serviceEngagementId: string | null; amount: string | null; currency: string }>>`
            SELECT fulfillment_state AS "fulfillmentState", service_engagement_id AS "serviceEngagementId",
                   amount::text AS amount, currency
              FROM wewed_contributions.wedding_contributions
             WHERE id = ${id} AND wedding_id = ${weddingId}
             FOR UPDATE
          `
          const locked = lockedRows[0]
          if (!locked) throw new Error('DIRECT_NOT_FOUND')
          if (locked.fulfillmentState !== 'PENDING') throw new Error('DIRECT_ALREADY_FULFILLED')
          if (!locked.serviceEngagementId) throw new Error('DIRECT_ENGAGEMENT_REQUIRED')
          const amount = Number(locked.amount ?? 0)
          if (!Number.isFinite(amount) || amount <= 0) throw new Error('DIRECT_AMOUNT_REQUIRED')
          const engagement = await tx.serviceEngagement.findFirst({ where: { id: locked.serviceEngagementId, weddingId }, select: { id: true, currency: true, vendorId: true } })
          if (!engagement) throw new Error('DIRECT_ENGAGEMENT_REQUIRED')
          if (engagement.currency !== locked.currency) throw new Error('DIRECT_CURRENCY_MISMATCH')
          const allocationRows = await tx.$queryRaw<Array<{ budgetItemId: string; currency: string }>>`
            SELECT budget_item_id AS "budgetItemId", currency
              FROM wewed_contributions.contribution_allocations
             WHERE wedding_id = ${weddingId} AND contribution_id = ${id} AND allocation_kind = 'DIRECT_PAYMENT'
             ORDER BY created_at
             LIMIT 1
          `
          const budgetItemId = allocationRows[0]?.budgetItemId ?? null
          if (allocationRows[0] && allocationRows[0].currency !== locked.currency) throw new Error('DIRECT_CURRENCY_MISMATCH')
          const payment = await tx.engagementPayment.create({
            data: {
              serviceEngagementId: locked.serviceEngagementId,
              amount,
              currency: locked.currency,
              paidAt,
              method: paymentMethod,
              reference: paymentReference,
              notes: `Contributor-funded payment: ${contribution.title}`,
              recordedById: actorId,
            },
          })
          await tx.$executeRaw`
            INSERT INTO wewed_contributions.payment_funding_allocations
              (id, wedding_id, payment_id, budget_item_id, contribution_id, source_kind, amount, currency, created_by_id, reconciled_at)
            VALUES
              (${contributionId()}, ${weddingId}, ${payment.id}, ${budgetItemId}, ${id}, 'CONTRIBUTION', ${amount}, ${locked.currency}, ${actorId}, ${paidAt})
          `
          if (budgetItemId) await tx.budgetItem.update({ where: { id: budgetItemId }, data: { paidAmount: { increment: amount } } })
          await tx.$executeRaw`
            UPDATE wewed_contributions.wedding_contributions
               SET fulfillment_state = 'PAID_DIRECT', commitment_state = 'CONFIRMED', verification_state = 'RECONCILED',
                   thank_you_state = 'TO_THANK', fulfilled_at = ${paidAt}, updated_at = NOW()
             WHERE id = ${id} AND wedding_id = ${weddingId}
          `
          await tx.auditEvent.create({ data: { weddingId, action: 'contribution.direct_vendor_paid', actorId, resourceType: 'WeddingContribution', resourceId: id, afterValue: JSON.stringify({ paymentId: payment.id, budgetItemId, serviceEngagementId: locked.serviceEngagementId, amount, currency: locked.currency })} })
          return { paymentId: payment.id }
        })
        return NextResponse.json({ success: true, data: result })
      } catch (error) {
        const code = error instanceof Error ? error.message : ''
        if (code === 'DIRECT_ALREADY_FULFILLED') return NextResponse.json({ success: false, error: 'This direct vendor contribution has already been fulfilled.' }, { status: 409 })
        if (code === 'DIRECT_ENGAGEMENT_REQUIRED') return NextResponse.json({ success: false, error: 'A direct vendor pledge needs its service engagement before payment can be recorded.' }, { status: 409 })
        if (code === 'DIRECT_AMOUNT_REQUIRED') return NextResponse.json({ success: false, error: 'A direct vendor pledge needs a positive amount before payment can be recorded.' }, { status: 409 })
        if (code === 'DIRECT_CURRENCY_MISMATCH') return NextResponse.json({ success: false, error: 'The direct vendor contribution and service engagement must use the same currency.' }, { status: 409 })
        if (code === 'DIRECT_NOT_FOUND') return NextResponse.json({ success: false, error: 'Contribution not found.' }, { status: 404 })
        throw error
      }
    }

    if (action === 'mark-received') {
      if (contribution.fulfillmentState !== 'PENDING') return NextResponse.json({ success: false, error: 'Only pending contributions can be marked received from this action.' }, { status: 409 })
      const nextState = ['GOODS_IN_KIND','SERVICE_IN_KIND','TIME_LABOUR','DISCOUNT_SPONSORSHIP'].includes(contribution.type) ? 'DELIVERED' : contribution.type === 'DIRECT_VENDOR_PAYMENT' ? 'PAID_DIRECT' : 'RECEIVED'
      if (nextState === 'PAID_DIRECT') return NextResponse.json({ success: false, error: 'Direct vendor payments need a service engagement and payment record. Edit through the direct-payment flow instead.' }, { status: 409 })
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE wewed_contributions.wedding_contributions SET fulfillment_state = ${nextState}, commitment_state = 'CONFIRMED', thank_you_state = 'TO_THANK', fulfilled_at = NOW(), updated_at = NOW() WHERE id = ${id} AND wedding_id = ${weddingId}`
        await tx.auditEvent.create({ data: { weddingId, action: 'contribution.fulfilled', actorId, resourceType: 'WeddingContribution', resourceId: id, afterValue: JSON.stringify({ fulfillmentState: nextState })} })
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'mark-verified') {
      if (!['RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED'].includes(contribution.fulfillmentState)) return NextResponse.json({ success: false, error: 'Verify a contribution after it has been received, delivered or paid.' }, { status: 409 })
      if (contribution.verificationState === 'RECONCILED') return NextResponse.json({ success: true })
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE wewed_contributions.wedding_contributions SET verification_state = 'CONFIRMED_BY_USER', updated_at = NOW() WHERE id = ${id} AND wedding_id = ${weddingId}`
        await tx.auditEvent.create({ data: { weddingId, action: 'contribution.verified', actorId, resourceType: 'WeddingContribution', resourceId: id} })
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Unsupported contribution action.' }, { status: 400 })
  } catch (error) {
    console.error('[CONTRIBUTION ACTION] error', error)
    return NextResponse.json({ success: false, error: 'Could not complete the contribution action.' }, { status: 500 })
  }
}
