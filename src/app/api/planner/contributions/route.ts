import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contributionDatabaseUnavailable, contributionAvailableAmount, finiteNonNegative, isCurrencyCode, normalizeCurrency, validContributionCommitmentState, validContributionFulfillmentState, validContributionThankYouState, validContributionVerificationState, validateContributionInput } from '@/lib/contributions'
import { contributionAllocatedCash, contributionId, getContribution, loadContributionWorkspace } from '@/lib/contributions/store'
import { contextHasPermission, requireWeddingPermission } from '@/lib/wedding-access'

function responseForDatabaseError(error: unknown) {
  if (contributionDatabaseUnavailable(error)) {
    return NextResponse.json({ success: false, error: 'Contributions database migration is not active yet.' }, { status: 503 })
  }
  console.error('[PLANNER CONTRIBUTIONS] error', error)
  return NextResponse.json({ success: false, error: 'Could not complete the Contributions request.' }, { status: 500 })
}

export async function GET(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'budget.view')
  if (access.error) return access.error
  const weddingId = access.context.weddingId
  try {
    const [workspace, budgetItems, vendors, engagements, guests] = await Promise.all([
      loadContributionWorkspace(weddingId),
      db.budgetItem.findMany({ where: { weddingId }, select: { id: true, description: true, category: true, currency: true, paidAmount: true, actualCost: true, estimatedCost: true, serviceEngagementId: true }, orderBy: [{ category: 'asc' }, { description: 'asc' }] }),
      db.vendor.findMany({ where: { weddingId }, select: { id: true, name: true, category: true }, orderBy: { name: 'asc' } }),
      db.serviceEngagement.findMany({ where: { weddingId }, select: { id: true, serviceCategory: true, serviceDescription: true, currency: true, vendor: { select: { id: true, name: true } }, payments: { select: { id:true, amount:true, currency:true, paidAt:true, reference:true }, orderBy:{ paidAt:'desc' } } }, orderBy: { createdAt: 'desc' } }),
      db.guest.findMany({ where: { weddingId }, select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } }),
    ])
    return NextResponse.json({ success: true, weddingId, ...workspace, permissions: { canEdit: contextHasPermission(access.context, 'budget.edit'), canCreateTasks: contextHasPermission(access.context, 'planner.edit') }, options: { budgetItems, vendors, engagements, guests } })
  } catch (error) {
    return responseForDatabaseError(error)
  }
}

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'budget.edit')
  if (access.error) return access.error
  const weddingId = access.context.weddingId
  const actorId = access.context.session.userId

  try {
    const body = (await request.json()) as Record<string, any>
    const validation = validateContributionInput(body)
    if (validation) return NextResponse.json({ success: false, error: validation }, { status: 400 })

    const type = String(body.type)
    if (body.currency !== undefined && !isCurrencyCode(body.currency)) return NextResponse.json({ success: false, error: 'Use a three-letter currency code such as USD.' }, { status: 400 })
    const currency = normalizeCurrency(body.currency)
    const amount = finiteNonNegative(body.amount)
    const estimatedValue = finiteNonNegative(body.estimatedValue)
    const quantity = finiteNonNegative(body.quantity)
    const commitmentState = String(body.commitmentState ?? 'NOT_APPLICABLE')
    const fulfillmentState = String(body.fulfillmentState ?? 'PENDING')
    const requestedVerificationState = String(body.verificationState ?? 'UNVERIFIED')
    const requestedThankYouState = String(body.thankYouState ?? (['RECEIVED', 'DELIVERED', 'PAID_DIRECT', 'COMPLETED'].includes(fulfillmentState) ? 'TO_THANK' : 'NOT_DUE'))
    if (!validContributionCommitmentState(commitmentState) || !validContributionFulfillmentState(fulfillmentState) || !validContributionVerificationState(requestedVerificationState) || !validContributionThankYouState(requestedThankYouState)) {
      return NextResponse.json({ success: false, error: 'Choose valid contribution lifecycle states.' }, { status: 400 })
    }
    const fulfilled = ['RECEIVED', 'DELIVERED', 'PAID_DIRECT', 'COMPLETED'].includes(fulfillmentState)
    const directPayment = type === 'DIRECT_VENDOR_PAYMENT'
    const inKind = ['GOODS_IN_KIND', 'SERVICE_IN_KIND', 'TIME_LABOUR', 'DISCOUNT_SPONSORSHIP'].includes(type)
    const contributionIdValue = contributionId()

    await db.$transaction(async (tx) => {
      let contributorIdValue = typeof body.contributorId === 'string' ? body.contributorId.trim() : ''
      if (contributorIdValue) {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM wewed_contributions.contributors
           WHERE id = ${contributorIdValue} AND wedding_id = ${weddingId}
           LIMIT 1
        `
        if (!rows[0]) throw new Error('CONTRIBUTOR_SCOPE')
      } else {
        const displayName = String(body.contributor?.displayName ?? '').trim()
        if (!displayName) throw new Error('CONTRIBUTOR_REQUIRED')
        contributorIdValue = contributionId()
        let guestId = typeof body.contributor?.guestId === 'string' && body.contributor.guestId ? body.contributor.guestId : null
        if (guestId) {
          const guest = await tx.guest.findFirst({ where: { id: guestId, weddingId }, select: { id: true } })
          if (!guest) guestId = null
        }
        const contributorKindRaw = String(body.contributor?.kind ?? 'individual').trim().toLowerCase()
        const contributorKind = ['individual', 'family', 'organisation'].includes(contributorKindRaw) ? contributorKindRaw : 'individual'
        const preferredContactRaw = String(body.contributor?.preferredContactMethod ?? '').trim().toLowerCase()
        const preferredContactMethod = ['email', 'phone', 'other'].includes(preferredContactRaw) ? preferredContactRaw : null
        await tx.$executeRaw`
          INSERT INTO wewed_contributions.contributors
            (id, wedding_id, display_name, legal_name, kind, relationship, email, phone, address, preferred_contact_method, public_recognition, anonymous_public, notes, guest_id)
          VALUES
            (${contributorIdValue}, ${weddingId}, ${displayName}, ${String(body.contributor?.legalName ?? '').trim() || null}, ${contributorKind}, ${String(body.contributor?.relationship ?? '').trim() || null}, ${String(body.contributor?.email ?? '').trim().toLowerCase() || null}, ${String(body.contributor?.phone ?? '').trim() || null}, ${String(body.contributor?.address ?? '').trim() || null}, ${preferredContactMethod}, ${body.contributor?.publicRecognition === true}, ${body.contributor?.anonymousPublic === true}, ${String(body.contributor?.notes ?? '').trim() || null}, ${guestId})
        `
      }

      const campaignId = typeof body.campaignId === 'string' && body.campaignId ? body.campaignId : null
      if (campaignId) {
        const rows = await tx.$queryRaw<Array<{ id: string; currency: string }>>`
          SELECT id, currency FROM wewed_contributions.campaigns
           WHERE id = ${campaignId} AND wedding_id = ${weddingId}
           LIMIT 1
        `
        if (!rows[0]) throw new Error('CAMPAIGN_SCOPE')
        if (rows[0].currency !== currency) throw new Error('CAMPAIGN_CURRENCY_MISMATCH')
      }

      const vendorId = typeof body.vendorId === 'string' && body.vendorId ? body.vendorId : null
      let resolvedVendorId = vendorId
      if (vendorId) {
        const vendor = await tx.vendor.findFirst({ where: { id: vendorId, weddingId }, select: { id: true } })
        if (!vendor) throw new Error('VENDOR_SCOPE')
      }

      const serviceEngagementId = typeof body.serviceEngagementId === 'string' && body.serviceEngagementId ? body.serviceEngagementId : null
      if (serviceEngagementId) {
        const engagement = await tx.serviceEngagement.findFirst({ where: { id: serviceEngagementId, weddingId }, select: { id: true, currency: true, vendorId: true } })
        if (!engagement) throw new Error('ENGAGEMENT_SCOPE')
        if (directPayment && engagement.currency !== currency) throw new Error('CURRENCY_MISMATCH')
        if (vendorId && engagement.vendorId !== vendorId) throw new Error('VENDOR_ENGAGEMENT_MISMATCH')
        if (directPayment) resolvedVendorId = engagement.vendorId
      }
      if (directPayment && !serviceEngagementId) throw new Error('DIRECT_PAYMENT_ENGAGEMENT_REQUIRED')

      const budgetItemId = typeof body.budgetItemId === 'string' && body.budgetItemId ? body.budgetItemId : null
      let budgetItem: { id: string; currency: string; paidAmount: number; serviceEngagementId: string | null } | null = null
      if (budgetItemId) {
        budgetItem = await tx.budgetItem.findFirst({ where: { id: budgetItemId, weddingId }, select: { id: true, currency: true, paidAmount: true, serviceEngagementId: true } })
        if (!budgetItem) throw new Error('BUDGET_SCOPE')
        const valueCurrency = inKind ? normalizeCurrency(body.estimatedValueCurrency, currency) : currency
        if (budgetItem.currency !== valueCurrency) throw new Error('CURRENCY_MISMATCH')
        if (directPayment && budgetItem.serviceEngagementId && serviceEngagementId && budgetItem.serviceEngagementId !== serviceEngagementId) throw new Error('BUDGET_ENGAGEMENT_MISMATCH')
      }

      const route = String(body.route ?? (directPayment ? 'DIRECT_TO_VENDOR' : inKind ? 'IN_KIND_TO_COUPLE' : 'TO_COUPLE'))
      const thankYouState = requestedThankYouState
      const verificationState = requestedVerificationState
      const now = new Date()
      const fulfilledAt = body.fulfilledAt ? new Date(body.fulfilledAt) : fulfilled ? now : null
      const pledgedAt = body.pledgedAt ? new Date(body.pledgedAt) : commitmentState === 'PLEDGED' ? now : null
      const expectedAt = body.expectedAt ? new Date(body.expectedAt) : null
      if (fulfilledAt && Number.isNaN(fulfilledAt.getTime())) throw new Error('INVALID_FULFILLED_DATE')
      if (pledgedAt && Number.isNaN(pledgedAt.getTime())) throw new Error('INVALID_PLEDGED_DATE')
      if (expectedAt && Number.isNaN(expectedAt.getTime())) throw new Error('INVALID_EXPECTED_DATE')

      await tx.$executeRaw`
        INSERT INTO wewed_contributions.wedding_contributions
          (id, wedding_id, contributor_id, campaign_id, vendor_id, service_engagement_id,
           type, title, description, amount, currency, estimated_value, estimated_value_currency,
           quantity, unit, route, commitment_state, fulfillment_state, verification_state,
           thank_you_state, pledged_at, expected_at, fulfilled_at, notes, source, recorded_by_id)
        VALUES
          (${contributionIdValue}, ${weddingId}, ${contributorIdValue}, ${campaignId}, ${resolvedVendorId}, ${serviceEngagementId},
           ${type}, ${String(body.title).trim()}, ${String(body.description ?? '').trim() || null}, ${amount}, ${currency}, ${estimatedValue}, ${estimatedValue === null ? null : normalizeCurrency(body.estimatedValueCurrency, currency)},
           ${quantity}, ${String(body.unit ?? '').trim() || null}, ${route}, ${commitmentState}, ${fulfillmentState}, ${verificationState},
           ${thankYouState}, ${pledgedAt}, ${expectedAt}, ${fulfilledAt}, ${String(body.notes ?? '').trim() || null}, ${String(body.source ?? 'planner')}, ${actorId})
      `

      if (budgetItemId && !directPayment) {
        const allocatedValue = inKind ? estimatedValue : amount
        if ((allocatedValue ?? 0) > 0) {
          await tx.$executeRaw`
            INSERT INTO wewed_contributions.contribution_allocations
              (id, wedding_id, contribution_id, budget_item_id, amount, currency, allocation_kind, created_by_id)
            VALUES
              (${contributionId()}, ${weddingId}, ${contributionIdValue}, ${budgetItemId}, ${allocatedValue}, ${inKind ? normalizeCurrency(body.estimatedValueCurrency, currency) : currency}, ${inKind ? 'IN_KIND' : 'CASH'}, ${actorId})
          `
        }
      }

      if (budgetItemId && directPayment && amount && amount > 0) {
        await tx.$executeRaw`
          INSERT INTO wewed_contributions.contribution_allocations
            (id, wedding_id, contribution_id, budget_item_id, amount, currency, allocation_kind, created_by_id)
          VALUES
            (${contributionId()}, ${weddingId}, ${contributionIdValue}, ${budgetItemId}, ${amount}, ${currency}, 'DIRECT_PAYMENT', ${actorId})
        `
      }

      if (directPayment && fulfillmentState === 'PAID_DIRECT' && serviceEngagementId && amount && amount > 0) {
        const paymentReference = String(body.paymentReference ?? '').trim() || null
        const historicalPaidAlreadyRecorded = body.alreadyIncludedInBudgetPaid === true
        let payment

        if (historicalPaidAlreadyRecorded) {
          const candidates = await tx.engagementPayment.findMany({
            where: {
              serviceEngagementId,
              currency,
              amount,
              ...(paymentReference ? { reference: paymentReference } : {}),
            },
            orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
          })
          if (candidates.length > 1) throw new Error('PAYMENT_MATCH_AMBIGUOUS')
          payment = candidates[0] ?? await tx.engagementPayment.create({
            data: {
              serviceEngagementId,
              amount,
              currency,
              paidAt: fulfilledAt ?? now,
              method: String(body.paymentMethod ?? '').trim() || null,
              reference: paymentReference,
              notes: `Historical contributor-funded payment recorded during Contributions reconciliation: ${String(body.title).trim()}`,
              recordedById: actorId,
            },
          })
        } else {
          payment = await tx.engagementPayment.create({
            data: {
              serviceEngagementId,
              amount,
              currency,
              paidAt: fulfilledAt ?? now,
              method: String(body.paymentMethod ?? '').trim() || null,
              reference: paymentReference,
              notes: `Contributor-funded payment: ${String(body.title).trim()}`,
              recordedById: actorId,
            },
          })
        }

        const existingFundingRows = await tx.$queryRaw<Array<{ total: string }>>`
          SELECT COALESCE(SUM(amount), 0)::text AS total
            FROM wewed_contributions.payment_funding_allocations
           WHERE wedding_id = ${weddingId}
             AND payment_id = ${payment.id}
             AND currency = ${currency}
        `
        const existingFunding = Number(existingFundingRows[0]?.total ?? 0)
        if (existingFunding + amount > Number(payment.amount) + 0.0001) throw new Error('PAYMENT_ALREADY_ATTRIBUTED')

        await tx.$executeRaw`
          INSERT INTO wewed_contributions.payment_funding_allocations
            (id, wedding_id, payment_id, budget_item_id, contribution_id, source_kind, amount, currency, created_by_id, reconciled_at)
          VALUES
            (${contributionId()}, ${weddingId}, ${payment.id}, ${budgetItemId}, ${contributionIdValue}, 'CONTRIBUTION', ${amount}, ${currency}, ${actorId}, ${now})
        `
        if (budgetItemId && !historicalPaidAlreadyRecorded) {
          await tx.budgetItem.update({ where: { id: budgetItemId }, data: { paidAmount: { increment: amount } } })
        }
        await tx.$executeRaw`
          UPDATE wewed_contributions.wedding_contributions
             SET verification_state = 'RECONCILED', updated_at = NOW()
           WHERE id = ${contributionIdValue}
        `
      }

      await tx.auditEvent.create({
        data: {
          weddingId,
          action: 'contribution.created', actorId,
          resourceType: 'WeddingContribution',
          resourceId: contributionIdValue,
          afterValue: JSON.stringify({ type, route, commitmentState, fulfillmentState, budgetItemId, serviceEngagementId }),
        },
      })
    })

    const workspace = await loadContributionWorkspace(weddingId)
    const created = workspace.data.find((item) => item.id === contributionIdValue)
    return NextResponse.json({ success: true, data: created ?? null }, { status: 201 })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    const known: Record<string, string> = {
      CONTRIBUTOR_SCOPE: 'That contributor does not belong to this wedding.',
      CONTRIBUTOR_REQUIRED: 'Choose or add the person who contributed.',
      CAMPAIGN_SCOPE: 'That campaign does not belong to this wedding.',
      CAMPAIGN_CURRENCY_MISMATCH: 'The contribution currency must match the campaign currency. Record a separate campaign for another currency.',
      VENDOR_SCOPE: 'That vendor does not belong to this wedding.',
      VENDOR_ENGAGEMENT_MISMATCH: 'That vendor does not match the selected service engagement.',
      ENGAGEMENT_SCOPE: 'That service engagement does not belong to this wedding.',
      BUDGET_SCOPE: 'That budget item does not belong to this wedding.',
      CURRENCY_MISMATCH: 'The selected records use different currencies. Record them separately or use a governed conversion.',
      BUDGET_ENGAGEMENT_MISMATCH: 'That budget item is linked to a different service engagement.',
      DIRECT_PAYMENT_ENGAGEMENT_REQUIRED: 'Direct vendor support must be connected to the vendor service engagement from the pledge onward.',
      INVALID_FULFILLED_DATE: 'Use a valid fulfilled date.',
      INVALID_PLEDGED_DATE: 'Use a valid pledged date.',
      INVALID_EXPECTED_DATE: 'Use a valid expected date.',
      PAYMENT_MATCH_AMBIGUOUS: 'More than one existing vendor payment matches this historical contribution. Add the exact payment reference or reconcile the payment separately.',
      PAYMENT_ALREADY_ATTRIBUTED: 'That vendor payment is already fully attributed to a funding source. Review its funding before adding another contributor.',
    }
    if (known[code]) return NextResponse.json({ success: false, error: known[code] }, { status: 400 })
    return responseForDatabaseError(error)
  }
}
