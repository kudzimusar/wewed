import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contributionDatabaseUnavailable, finiteNonNegative, isCurrencyCode, normalizeCurrency, validContributionCommitmentState, validContributionFulfillmentState, validContributionThankYouState, validContributionVerificationState } from '@/lib/contributions'
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
      SELECT (SELECT COUNT(*) FROM wewed_contributions.contribution_allocations WHERE wedding_id = ${weddingId} AND contribution_id = ${id} AND allocation_kind <> 'DIRECT_PAYMENT') +
             (SELECT COUNT(*) FROM wewed_contributions.payment_funding_allocations WHERE wedding_id = ${weddingId} AND contribution_id = ${id}) AS count
    `
    const financiallyLocked = Number(locks[0]?.count ?? 0) > 0 || current.verificationState === 'RECONCILED'
    const body = (await request.json()) as Record<string, unknown>
    if (financiallyLocked && ['amount','currency','type','fulfillmentState'].some((field) => body[field] !== undefined)) {
      return NextResponse.json({ success: false, error: 'This contribution is already allocated or reconciled. Use an adjustment/reversal rather than rewriting the financial fact.' }, { status: 409 })
    }
    if (current.type === 'DIRECT_VENDOR_PAYMENT' && body.type !== undefined && body.type !== 'DIRECT_VENDOR_PAYMENT') {
      return NextResponse.json({ success: false, error: 'A direct vendor contribution cannot be changed into another contribution type. Preserve the payment trail and create a separate record if needed.' }, { status: 409 })
    }
    if (current.type !== 'DIRECT_VENDOR_PAYMENT' && body.type === 'DIRECT_VENDOR_PAYMENT') {
      return NextResponse.json({ success: false, error: 'Direct vendor support must be created through the Service Engagement-aware direct-payment flow.' }, { status: 409 })
    }
    if (current.type === 'DIRECT_VENDOR_PAYMENT' && body.fulfillmentState !== undefined) {
      return NextResponse.json({ success: false, error: 'Direct vendor fulfillment is controlled by the vendor-payment action so the real EngagementPayment and funding attribution stay atomic.' }, { status: 409 })
    }
    if (current.type === 'DIRECT_VENDOR_PAYMENT' && body.currency !== undefined) {
      return NextResponse.json({ success: false, error: 'Direct vendor pledge currency is governed by its service engagement. Create a separate correction if the currency itself is wrong.' }, { status: 409 })
    }
    if (current.type === 'DIRECT_VENDOR_PAYMENT' && current.fulfillmentState === 'PENDING' && body.amount !== undefined) {
      const correctedAmount = finiteNonNegative(body.amount)
      if (correctedAmount === null || correctedAmount <= 0) return NextResponse.json({ success: false, error: 'A promised direct vendor amount must be greater than zero.' }, { status: 400 })
    }
    if (current.type === 'DIRECT_VENDOR_PAYMENT' && current.fulfillmentState !== 'PAID_DIRECT' && body.fulfillmentState === 'PAID_DIRECT') {
      return NextResponse.json({ success: false, error: 'Record the vendor payment through the direct-payment action so Wewed creates the real payment and funding attribution together.' }, { status: 409 })
    }

    if (body.commitmentState !== undefined && !validContributionCommitmentState(body.commitmentState)) return NextResponse.json({ success: false, error: 'Choose a valid commitment state.' }, { status: 400 })
    if (body.fulfillmentState !== undefined && !validContributionFulfillmentState(body.fulfillmentState)) return NextResponse.json({ success: false, error: 'Choose a valid fulfillment state.' }, { status: 400 })
    if (body.verificationState !== undefined && !validContributionVerificationState(body.verificationState)) return NextResponse.json({ success: false, error: 'Choose a valid verification state.' }, { status: 400 })
    if (body.thankYouState !== undefined && !validContributionThankYouState(body.thankYouState)) return NextResponse.json({ success: false, error: 'Choose a valid thank-you state.' }, { status: 400 })
    if (body.currency !== undefined && !isCurrencyCode(body.currency)) return NextResponse.json({ success: false, error: 'Use a three-letter currency code such as USD.' }, { status: 400 })
    if (body.amount !== undefined && finiteNonNegative(body.amount) === null) return NextResponse.json({ success: false, error: 'Amount must be zero or more.' }, { status: 400 })

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
    const expectedAt = body.expectedAt === undefined ? undefined : body.expectedAt ? new Date(String(body.expectedAt)) : null
    if (expectedAt instanceof Date && Number.isNaN(expectedAt.getTime())) return NextResponse.json({ success:false, error:'Use a valid expected date.' }, { status:400 })
    const estimatedValue = body.estimatedValue === undefined ? undefined : finiteNonNegative(body.estimatedValue)
    if (body.estimatedValue !== undefined && body.estimatedValue !== null && body.estimatedValue !== '' && estimatedValue === null) return NextResponse.json({ success:false, error:'Estimated value must be zero or more.' }, { status:400 })
    const quantity = body.quantity === undefined ? undefined : finiteNonNegative(body.quantity)
    if (body.quantity !== undefined && body.quantity !== null && body.quantity !== '' && quantity === null) return NextResponse.json({ success:false, error:'Quantity must be zero or more.' }, { status:400 })
    if (fulfilledAt && Number.isNaN(fulfilledAt.getTime())) return NextResponse.json({ success: false, error: 'Use a valid fulfilled date.' }, { status: 400 })
    if (currency) {
      const campaignRows = await db.$queryRaw<Array<{ currency: string }>>`
        SELECT camp.currency FROM wewed_contributions.wedding_contributions c
        JOIN wewed_contributions.campaigns camp ON camp.id = c.campaign_id
        WHERE c.id = ${id} AND c.wedding_id = ${weddingId} LIMIT 1
      `
      if (campaignRows[0] && campaignRows[0].currency !== currency) return NextResponse.json({ success: false, error: 'Contribution currency must match its campaign currency.' }, { status: 409 })
    }

    await db.$transaction(async (tx) => {
      await tx.$executeRaw`
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
               expected_at = CASE WHEN ${body.expectedAt !== undefined} THEN ${expectedAt} ELSE expected_at END,
               estimated_value = CASE WHEN ${body.estimatedValue !== undefined} THEN ${estimatedValue} ELSE estimated_value END,
               estimated_value_currency = CASE WHEN ${body.estimatedValueCurrency !== undefined} THEN ${body.estimatedValueCurrency ? normalizeCurrency(body.estimatedValueCurrency) : null} ELSE estimated_value_currency END,
               quantity = CASE WHEN ${body.quantity !== undefined} THEN ${quantity} ELSE quantity END,
               unit = CASE WHEN ${body.unit !== undefined} THEN ${String(body.unit ?? '').trim() || null} ELSE unit END,
               updated_at = NOW()
         WHERE id = ${id} AND wedding_id = ${weddingId}
      `
      if (current.type === 'DIRECT_VENDOR_PAYMENT' && current.fulfillmentState === 'PENDING' && body.amount !== undefined && amount !== null) {
        await tx.$executeRaw`
          UPDATE wewed_contributions.contribution_allocations
             SET amount = ${amount}
           WHERE wedding_id = ${weddingId}
             AND contribution_id = ${id}
             AND allocation_kind = 'DIRECT_PAYMENT'
        `
      }
      await tx.auditEvent.create({ data: { weddingId, action: 'contribution.updated', actorId, resourceType: 'WeddingContribution', resourceId: id, afterValue: JSON.stringify({ fields: Object.keys(body), financiallyLocked })} })
    })
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
      SELECT (SELECT COUNT(*) FROM wewed_contributions.contribution_allocations WHERE wedding_id = ${weddingId} AND contribution_id = ${id} AND allocation_kind <> 'DIRECT_PAYMENT') +
             (SELECT COUNT(*) FROM wewed_contributions.payment_funding_allocations WHERE wedding_id = ${weddingId} AND contribution_id = ${id}) AS count
    `
    if (Number(locks[0]?.count ?? 0) > 0 || current.verificationState === 'RECONCILED') {
      return NextResponse.json({ success: false, error: 'Allocated or reconciled contributions cannot be deleted. Cancel or reverse them so the history remains auditable.' }, { status: 409 })
    }
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`DELETE FROM wewed_contributions.wedding_contributions WHERE id = ${id} AND wedding_id = ${weddingId}`
      await tx.auditEvent.create({ data: { weddingId, action: 'contribution.deleted_unreconciled', actorId, resourceType: 'WeddingContribution', resourceId: id} })
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return dbError(error)
  }
}
