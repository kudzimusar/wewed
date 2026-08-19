import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contributionAvailableAmount, finiteNonNegative } from '@/lib/contributions'
import { contributionAllocatedCash, contributionId, getContribution } from '@/lib/contributions/store'
import { requireWeddingPermission } from '@/lib/wedding-access'

interface RouteContext { params: Promise<{ id:string }> }

async function paymentForWedding(weddingId:string, id:string) {
  return db.engagementPayment.findFirst({ where:{ id, serviceEngagement:{ weddingId } }, include:{ serviceEngagement:{ select:{ id:true, weddingId:true, currency:true, vendorId:true, vendor:{ select:{ id:true, name:true } }, budgetItems:{ select:{ id:true, description:true, currency:true } } } } } })
}

export async function GET(request:NextRequest, context:RouteContext) {
  const access = await requireWeddingPermission(request, 'budget.view')
  if (access.error) return access.error
  const { id } = await context.params
  const weddingId = access.context.weddingId
  const payment = await paymentForWedding(weddingId, id)
  if (!payment) return NextResponse.json({ success:false, error:'Payment not found.' }, { status:404 })
  const rows = await db.$queryRaw<Array<{ id:string; sourceKind:string; contributionId:string|null; budgetItemId:string|null; amount:string; currency:string }>>`
    SELECT id, source_kind AS "sourceKind", contribution_id AS "contributionId", budget_item_id AS "budgetItemId", amount::text AS amount, currency
      FROM wewed_contributions.payment_funding_allocations
     WHERE wedding_id=${weddingId} AND payment_id=${id}
     ORDER BY created_at, id
  `
  const classified = rows.filter((row)=>row.sourceKind !== 'LEGACY_UNATTRIBUTED').reduce((sum,row)=>sum+Number(row.amount),0)
  return NextResponse.json({ success:true, data:{ id:payment.id, amount:Number(payment.amount), currency:payment.currency, paidAt:payment.paidAt?.toISOString() ?? null, reference:payment.reference, vendor:payment.serviceEngagement.vendor, serviceEngagementId:payment.serviceEngagementId, budgetItems:payment.serviceEngagement.budgetItems, funding:rows.map((row)=>({...row,amount:Number(row.amount)})), unattributed:Math.max(0,Number(payment.amount)-classified) } })
}

export async function POST(request:NextRequest, context:RouteContext) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const { id } = await context.params
  const weddingId = access.context.weddingId
  const actorId = access.context.session.userId
  const body = (await request.json()) as Record<string,unknown>
  const sourceKind = String(body.sourceKind ?? '')
  const amount = finiteNonNegative(body.amount)
  if (!['COUPLE','CONTRIBUTION','OTHER'].includes(sourceKind) || !amount || amount <= 0) return NextResponse.json({ success:false, error:'Choose a funding source and positive amount.' }, { status:400 })
  const contributionIdValue = sourceKind === 'CONTRIBUTION' ? String(body.contributionId ?? '').trim() : ''
  if (sourceKind === 'CONTRIBUTION' && !contributionIdValue) return NextResponse.json({ success:false, error:'Choose the contribution that funded this payment.' }, { status:400 })
  const requestedBudgetItemId = String(body.budgetItemId ?? '').trim() || null
  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment-funding:${id}`}))`
      const payment = await tx.engagementPayment.findFirst({ where:{ id, serviceEngagement:{ weddingId } }, include:{ serviceEngagement:{ select:{ id:true, currency:true, budgetItems:{ select:{ id:true, currency:true } } } } } })
      if (!payment) throw new Error('PAYMENT_NOT_FOUND')
      if (payment.currency !== payment.serviceEngagement.currency) throw new Error('PAYMENT_ENGAGEMENT_CURRENCY')
      let budgetItemId:string|null = null
      if (requestedBudgetItemId) {
        const budget = payment.serviceEngagement.budgetItems.find((item)=>item.id===requestedBudgetItemId)
        if (!budget) throw new Error('BUDGET_NOT_FOUND')
        if (budget.currency !== payment.currency) throw new Error('CURRENCY_MISMATCH')
        budgetItemId = budget.id
      }
      const classifiedRows = await tx.$queryRaw<Array<{ total:string }>>`
        SELECT COALESCE(SUM(amount),0)::text AS total FROM wewed_contributions.payment_funding_allocations
         WHERE wedding_id=${weddingId} AND payment_id=${id} AND currency=${payment.currency} AND source_kind <> 'LEGACY_UNATTRIBUTED'
      `
      const classified = Number(classifiedRows[0]?.total ?? 0)
      if (classified + amount > Number(payment.amount) + 0.0001) throw new Error('FUNDING_EXCEEDS_PAYMENT')
      if (sourceKind === 'CONTRIBUTION') {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`contribution-funding:${contributionIdValue}`}))`
        const contribution = await getContribution(weddingId, contributionIdValue, tx)
        if (!contribution) throw new Error('CONTRIBUTION_NOT_FOUND')
        if (contribution.currency !== payment.currency) throw new Error('CURRENCY_MISMATCH')
        if (!['CASH_TO_COUPLE','HONEYMOON_GIFT'].includes(contribution.type) || contribution.fulfillmentState !== 'RECEIVED') throw new Error('CONTRIBUTION_NOT_AVAILABLE_CASH')
        const allocated = await contributionAllocatedCash(weddingId, contributionIdValue, tx)
        const available = contributionAvailableAmount({ type:contribution.type, amount:contribution.amount, fulfillmentState:contribution.fulfillmentState, allocatedAmount:allocated })
        if (amount > available + 0.0001) throw new Error('CONTRIBUTION_INSUFFICIENT_AVAILABLE')
        if (budgetItemId) {
          await tx.$executeRaw`INSERT INTO wewed_contributions.contribution_allocations (id,wedding_id,contribution_id,budget_item_id,amount,currency,allocation_kind,note,created_by_id) VALUES (${contributionId()},${weddingId},${contributionIdValue},${budgetItemId},${amount},${payment.currency},'CASH','Reserved for payment funding allocation',${actorId})`
        }
      }
      const legacyRows = await tx.$queryRaw<Array<{ id:string; amount:string }>>`SELECT id,amount::text AS amount FROM wewed_contributions.payment_funding_allocations WHERE wedding_id=${weddingId} AND payment_id=${id} AND currency=${payment.currency} AND source_kind='LEGACY_UNATTRIBUTED' ORDER BY created_at,id FOR UPDATE`
      let remaining = amount
      for (const row of legacyRows) {
        if (remaining <= 0) break
        const legacyAmount = Number(row.amount)
        if (remaining + 0.0001 >= legacyAmount) { await tx.$executeRaw`DELETE FROM wewed_contributions.payment_funding_allocations WHERE id=${row.id}`; remaining -= legacyAmount }
        else { await tx.$executeRaw`UPDATE wewed_contributions.payment_funding_allocations SET amount=amount-${remaining},updated_at=NOW() WHERE id=${row.id}`; remaining=0 }
      }
      await tx.$executeRaw`INSERT INTO wewed_contributions.payment_funding_allocations (id,wedding_id,payment_id,budget_item_id,contribution_id,source_kind,amount,currency,note,created_by_id,reconciled_at) VALUES (${contributionId()},${weddingId},${id},${budgetItemId},${sourceKind==='CONTRIBUTION'?contributionIdValue:null},${sourceKind},${amount},${payment.currency},${String(body.note ?? '').trim() || null},${actorId},NOW())`
      await tx.auditEvent.create({ data:{ weddingId, action:'payment.funding_attributed', actorId, resourceType:'EngagementPayment', resourceId:id, afterValue:JSON.stringify({ sourceKind, contributionId:sourceKind==='CONTRIBUTION'?contributionIdValue:null, budgetItemId, amount, currency:payment.currency })} })
    })
    return NextResponse.json({ success:true })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    const known:Record<string,{status:number;error:string}> = { PAYMENT_NOT_FOUND:{status:404,error:'Payment not found.'}, BUDGET_NOT_FOUND:{status:404,error:'Choose a Budget item linked to this service engagement.'}, PAYMENT_ENGAGEMENT_CURRENCY:{status:409,error:'Payment and service engagement currencies do not match.'}, FUNDING_EXCEEDS_PAYMENT:{status:409,error:'Funding allocations cannot exceed the payment amount.'}, CONTRIBUTION_NOT_FOUND:{status:404,error:'Contribution not found.'}, CURRENCY_MISMATCH:{status:400,error:'Funding records must use the same currency.'}, CONTRIBUTION_NOT_AVAILABLE_CASH:{status:409,error:'Choose received contribution cash; promises and in-kind support cannot fund a cash payment.'}, CONTRIBUTION_INSUFFICIENT_AVAILABLE:{status:409,error:'That contribution does not have enough uncommitted cash remaining.'} }
    if (known[code]) return NextResponse.json({ success:false, error:known[code].error }, { status:known[code].status })
    console.error('[PAYMENT FUNDING POST] error', error)
    return NextResponse.json({ success:false, error:'Could not save payment funding.' }, { status:500 })
  }
}
