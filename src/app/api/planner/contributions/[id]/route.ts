import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contributionDatabaseUnavailable, finiteNonNegative, normalizeCurrency } from '@/lib/contributions'
import { getContribution } from '@/lib/contributions/store'
import { requireWeddingPermission } from '@/lib/wedding-access'

interface RouteContext { params: Promise<{ id: string }> }

function dbError(error: unknown) {
  if (contributionDatabaseUnavailable(error)) return NextResponse.json({ success: false, error: 'Contributions database migration is not active yet.' }, { status: 503 })
  console.error('[CONTRIBUTION DETAIL] error', error)
  return NextResponse.json({ success: false, error: 'Could not update this contribution.' }, { status: 500 })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const { id } = await context.params
  const weddingId = access.context.weddingId
  const actorId = access.context.session.userId
  try {
    const current = await getContribution(weddingId, id)
    if (!current) return NextResponse.json({ success: false, error: 'Contribution not found.' }, { status: 404 })
    const locks = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT (SELECT COUNT(*) FROM wewed_contributions.contribution_allocations WHERE wedding_id = ${weddingId} AND contribution_id = ${id}) +
             (SELECT COUNT(*) FROM wewed_contributions.payment_funding_allocations WHERE wedding_id = ${weddingId} AND contribution_id = ${id}) AS count
    `
    const financiallyLocked = Number(locks[0]?.count ?? 0) > 0 || current.verificationState === 'RECONCILED'
    const body = (await request.json()) as Record<string, unknown>
    if (financiallyLocked && ['amount','currency','type','fulfillmentState'].some((field) => body[field] !== undefined)) {
      return NextResponse.json({ success: false, error: 'This contribution is already allocated or reconciled. Use an adjustment/reversal rather than rewriting the financial fact.' }, { status: 409 })
    }

    const title = typeof body.title === 'string' ? body.title.trim() : null
    const description = typeof body.description === 'string' ? body.description.trim() || null : null
    const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null
    const thankYouState = typeof body.thankYouState === 'string' ? body.thankYouState : null
    const verificationState = typeof body.verificationState === 'string' ? body.verificationState : null
    const commitmentState = typeof body.commitmentState === 'string' ? body.commitmentState : null
    const fulfillmentState = typeof body.fulfillmentState === 'string' ? body.fulfillmentState : null
    const amount = body.amount === undefined ? null : finiteNonNegative(body.amount)
    const currency = body.currency === undefined ? null : normalizeCurrency(body.currency)
    const fulfilledAt = body.fulfilledAt === undefined ? null : body.fulfilledAt ? new Date(String(body.fulfilledAt)) : null

    await db.$executeRaw`
      UPDATE wewed_contributions.wedding_contributions
         SET title = COALESCE(${title}, title),
             description = CASE WHEN ${body.description !== undefined} THEN ${description} ELSE description END,
             notes = CASE WHEN ${body.notes !== undefined} THEN ${notes} ELSE notes END,
             thank_you_state = COALESCE(${thankYouState}, thank_you_state),
             verification_state = COALESCE(${verificationState}, verification_state),
             commitment_state = COALESCE(${commitmentState}, commitment_state),
             fulfillment_state = COALESCE(${fulfillmentState}, fulfillment_state),
             amount = CASE WHEN ${body.amount !== undefined} THEN ${amount} ELSE amount END,
             currency = COALESCE(${currency}, currency),
             fulfilled_at = CASE WHEN ${body.fulfilledAt !== undefined} THEN ${fulfilledAt} ELSE fulfilled_at END,
             updated_at = NOW()
       WHERE id = ${id} AND wedding_id = ${weddingId}
    `
    await db.auditEvent.create({ data: { weddingId, eventType: 'contribution.updated', actorType: 'user', actorId, targetType: 'WeddingContribution', targetId: id, payload: JSON.stringify({ fields: Object.keys(body), financiallyLocked }), severity: 'info' } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return dbError(error)
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const { id } = await context.params
  const weddingId = access.context.weddingId
  const actorId = access.context.session.userId
  try {
    const current = await getContribution(weddingId, id)
    if (!current) return NextResponse.json({ success: false, error: 'Contribution not found.' }, { status: 404 })
    const locks = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT (SELECT COUNT(*) FROM wewed_contributions.contribution_allocations WHERE wedding_id = ${weddingId} AND contribution_id = ${id}) +
             (SELECT COUNT(*) FROM wewed_contributions.payment_funding_allocations WHERE wedding_id = ${weddingId} AND contribution_id = ${id}) AS count
    `
    if (Number(locks[0]?.count ?? 0) > 0 || current.verificationState === 'RECONCILED') {
      return NextResponse.json({ success: false, error: 'Allocated or reconciled contributions cannot be deleted. Cancel or reverse them so the history remains auditable.' }, { status: 409 })
    }
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`DELETE FROM wewed_contributions.wedding_contributions WHERE id = ${id} AND wedding_id = ${weddingId}`
      await tx.auditEvent.create({ data: { weddingId, eventType: 'contribution.deleted_unreconciled', actorType: 'user', actorId, targetType: 'WeddingContribution', targetId: id, severity: 'warning' } })
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return dbError(error)
  }
}
