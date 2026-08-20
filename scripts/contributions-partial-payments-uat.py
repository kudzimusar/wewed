from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, value: str) -> None:
    Path(path).write_text(value)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old, new, 1)


def splice(text: str, start: str, end: str, replacement: str, label: str) -> str:
    a = text.find(start)
    if a < 0:
        raise SystemExit(f'{label}: start anchor missing')
    b = text.find(end, a)
    if b < 0:
        raise SystemExit(f'{label}: end anchor missing')
    return text[:a] + replacement + text[b:]


# 1. Domain summaries: a direct-vendor promise is not paid until real payment rows exist.
path = 'src/lib/contributions.ts'
s = read(path)
s = replace_once(
    s,
    '  allocatedAmount?: number\n}',
    '  allocatedAmount?: number\n  directVendorPaidAmount?: number\n}',
    'summary row paid field',
)
s = replace_once(
    s,
    "    if (row.commitmentState === 'PLEDGED' && !isFulfilled(row.fulfillmentState)) {\n      bucket(row.currency).pledged += amount\n    }",
    "    const directPaid = row.type === 'DIRECT_VENDOR_PAYMENT'\n      ? Math.max(0, row.directVendorPaidAmount ?? (row.fulfillmentState === 'PAID_DIRECT' ? amount : 0))\n      : 0\n    if (row.commitmentState === 'PLEDGED' && !isFulfilled(row.fulfillmentState)) {\n      bucket(row.currency).pledged += row.type === 'DIRECT_VENDOR_PAYMENT'\n        ? Math.max(0, amount - directPaid)\n        : amount\n    }",
    'summary pledged remainder',
)
s = replace_once(
    s,
    "    if (row.type === 'DIRECT_VENDOR_PAYMENT' && row.fulfillmentState === 'PAID_DIRECT') {\n      bucket(row.currency).directVendorPaid += amount\n    }",
    "    if (row.type === 'DIRECT_VENDOR_PAYMENT' && directPaid > 0) {\n      bucket(row.currency).directVendorPaid += directPaid\n    }",
    'summary direct paid actual',
)
write(path, s)


# 2. Workspace/store exposes paid-to-date and remaining; Budget gets live linked contribution context.
path = 'src/lib/contributions/store.ts'
s = read(path)
s = replace_once(
    s,
    "    const allocatedAmount = allocationCash + paymentOnlyCash\n    const amount = asNumber(row.amount)\n    return {",
    "    const allocatedAmount = allocationCash + paymentOnlyCash\n    const amount = asNumber(row.amount)\n    const directVendorPaidAmount = row.type === 'DIRECT_VENDOR_PAYMENT'\n      ? funding.filter((item) => item.contributionId === row.id && item.sourceKind === 'CONTRIBUTION' && item.paymentId).reduce((sum, item) => sum + Number(item.amount), 0)\n      : 0\n    const remainingAmount = row.type === 'DIRECT_VENDOR_PAYMENT'\n      ? Math.max(0, (amount ?? 0) - directVendorPaidAmount)\n      : 0\n    return {",
    'workspace direct payment totals',
)
s = replace_once(
    s,
    "      amount,\n      currency: row.currency,",
    "      amount,\n      directVendorPaidAmount,\n      remainingAmount,\n      currency: row.currency,",
    'workspace serialized direct totals',
)
append = r'''

export async function budgetContributionContexts(weddingId: string) {
  return db.$queryRaw<Array<{
    budgetItemId: string
    contributionId: string
    allocationKind: string
    allocationAmount: string
    currency: string
    contributorName: string
    title: string
    notes: string | null
    type: string
    commitmentState: string
    fulfillmentState: string
    contributionAmount: string | null
    directPaidAmount: string
  }>>`
    SELECT a.budget_item_id AS "budgetItemId",
           a.contribution_id AS "contributionId",
           a.allocation_kind AS "allocationKind",
           a.amount::text AS "allocationAmount",
           a.currency,
           p.display_name AS "contributorName",
           c.title,
           c.notes,
           c.type,
           c.commitment_state AS "commitmentState",
           c.fulfillment_state AS "fulfillmentState",
           c.amount::text AS "contributionAmount",
           COALESCE((
             SELECT SUM(f.amount)
               FROM wewed_contributions.payment_funding_allocations f
              WHERE f.wedding_id = ${weddingId}
                AND f.contribution_id = c.id
                AND f.source_kind = 'CONTRIBUTION'
                AND f.payment_id IS NOT NULL
           ), 0)::text AS "directPaidAmount"
      FROM wewed_contributions.contribution_allocations a
      JOIN wewed_contributions.wedding_contributions c ON c.id = a.contribution_id
      JOIN wewed_contributions.contributors p ON p.id = c.contributor_id
     WHERE a.wedding_id = ${weddingId}
       AND a.budget_item_id IS NOT NULL
     ORDER BY a.created_at
  `
}
'''
if 'export async function budgetContributionContexts' not in s:
    s += append
write(path, s)


# 3. Pending direct pledge can be corrected before money moves; allocation stays aligned atomically.
path = 'src/app/api/planner/contributions/[id]/route.ts'
s = read(path)
s = replace_once(
    s,
    "    if (current.type === 'DIRECT_VENDOR_PAYMENT' && current.fulfillmentState === 'PENDING' && (body.amount !== undefined || body.currency !== undefined)) {\n      return NextResponse.json({ success: false, error: 'For a promised direct vendor payment, delete and recreate the pledge to change its amount or currency before payment.' }, { status: 409 })\n    }",
    "    if (current.type === 'DIRECT_VENDOR_PAYMENT' && body.currency !== undefined) {\n      return NextResponse.json({ success: false, error: 'Direct vendor pledge currency is governed by its service engagement. Create a separate correction if the currency itself is wrong.' }, { status: 409 })\n    }\n    if (current.type === 'DIRECT_VENDOR_PAYMENT' && current.fulfillmentState === 'PENDING' && body.amount !== undefined) {\n      const correctedAmount = finiteNonNegative(body.amount)\n      if (correctedAmount === null || correctedAmount <= 0) return NextResponse.json({ success: false, error: 'A promised direct vendor amount must be greater than zero.' }, { status: 400 })\n    }",
    'pending direct correction guard',
)
old = """    await db.$executeRaw`\n      UPDATE wewed_contributions.wedding_contributions\n         SET title = COALESCE(${title}, title),\n             description = CASE WHEN ${body.description !== undefined} THEN ${description} ELSE description END,\n             notes = CASE WHEN ${body.notes !== undefined} THEN ${notes} ELSE notes END,\n             thank_you_state = COALESCE(${thankYouState}, thank_you_state),\n             verification_state = COALESCE(${verificationState}, verification_state),\n             commitment_state = COALESCE(${commitmentState}, commitment_state),\n             fulfillment_state = COALESCE(${fulfillmentState}, fulfillment_state),\n             amount = CASE WHEN ${body.amount !== undefined} THEN ${amount} ELSE amount END,\n             currency = COALESCE(${currency}, currency),\n             fulfilled_at = CASE WHEN ${body.fulfilledAt !== undefined} THEN ${fulfilledAt} ELSE fulfilled_at END,\n             expected_at = CASE WHEN ${body.expectedAt !== undefined} THEN ${expectedAt} ELSE expected_at END,\n             estimated_value = CASE WHEN ${body.estimatedValue !== undefined} THEN ${estimatedValue} ELSE estimated_value END,\n             estimated_value_currency = CASE WHEN ${body.estimatedValueCurrency !== undefined} THEN ${body.estimatedValueCurrency ? normalizeCurrency(body.estimatedValueCurrency) : null} ELSE estimated_value_currency END,\n             quantity = CASE WHEN ${body.quantity !== undefined} THEN ${quantity} ELSE quantity END,\n             unit = CASE WHEN ${body.unit !== undefined} THEN ${String(body.unit ?? '').trim() || null} ELSE unit END,\n             updated_at = NOW()\n       WHERE id = ${id} AND wedding_id = ${weddingId}\n    `\n    await db.auditEvent.create({ data: { weddingId, action: 'contribution.updated', actorId, resourceType: 'WeddingContribution', resourceId: id, afterValue: JSON.stringify({ fields: Object.keys(body), financiallyLocked })} })\n"""
new = """    await db.$transaction(async (tx) => {\n      await tx.$executeRaw`\n        UPDATE wewed_contributions.wedding_contributions\n           SET title = COALESCE(${title}, title),\n               description = CASE WHEN ${body.description !== undefined} THEN ${description} ELSE description END,\n               notes = CASE WHEN ${body.notes !== undefined} THEN ${notes} ELSE notes END,\n               thank_you_state = COALESCE(${thankYouState}, thank_you_state),\n               verification_state = COALESCE(${verificationState}, verification_state),\n               commitment_state = COALESCE(${commitmentState}, commitment_state),\n               fulfillment_state = COALESCE(${fulfillmentState}, fulfillment_state),\n               amount = CASE WHEN ${body.amount !== undefined} THEN ${amount} ELSE amount END,\n               currency = COALESCE(${currency}, currency),\n               fulfilled_at = CASE WHEN ${body.fulfilledAt !== undefined} THEN ${fulfilledAt} ELSE fulfilled_at END,\n               expected_at = CASE WHEN ${body.expectedAt !== undefined} THEN ${expectedAt} ELSE expected_at END,\n               estimated_value = CASE WHEN ${body.estimatedValue !== undefined} THEN ${estimatedValue} ELSE estimated_value END,\n               estimated_value_currency = CASE WHEN ${body.estimatedValueCurrency !== undefined} THEN ${body.estimatedValueCurrency ? normalizeCurrency(body.estimatedValueCurrency) : null} ELSE estimated_value_currency END,\n               quantity = CASE WHEN ${body.quantity !== undefined} THEN ${quantity} ELSE quantity END,\n               unit = CASE WHEN ${body.unit !== undefined} THEN ${String(body.unit ?? '').trim() || null} ELSE unit END,\n               updated_at = NOW()\n         WHERE id = ${id} AND wedding_id = ${weddingId}\n      `\n      if (current.type === 'DIRECT_VENDOR_PAYMENT' && current.fulfillmentState === 'PENDING' && body.amount !== undefined && amount !== null) {\n        await tx.$executeRaw`\n          UPDATE wewed_contributions.contribution_allocations\n             SET amount = ${amount}\n           WHERE wedding_id = ${weddingId}\n             AND contribution_id = ${id}\n             AND allocation_kind = 'DIRECT_PAYMENT'\n        `\n      }\n      await tx.auditEvent.create({ data: { weddingId, action: 'contribution.updated', actorId, resourceType: 'WeddingContribution', resourceId: id, afterValue: JSON.stringify({ fields: Object.keys(body), financiallyLocked })} })\n    })\n"""
s = replace_once(s, old, new, 'atomic direct correction')
write(path, s)


# 4. Direct vendor payments support installments and only move the amount actually paid.
path = 'src/app/api/planner/contributions/[id]/actions/route.ts'
s = read(path)
start = "    if (action === 'mark-direct-paid') {"
end = "    if (action === 'mark-received') {"
replacement = r'''    if (action === 'mark-direct-paid') {
      if (contribution.type !== 'DIRECT_VENDOR_PAYMENT') return NextResponse.json({ success: false, error: 'This action is only for direct vendor contributions.' }, { status: 409 })
      const paymentReference = String(body.paymentReference ?? '').trim() || null
      const paymentMethod = String(body.paymentMethod ?? '').trim() || null
      const requestedAmount = body.amount === undefined || body.amount === '' ? null : finiteNonNegative(body.amount)
      if (body.amount !== undefined && (requestedAmount === null || requestedAmount <= 0)) return NextResponse.json({ success: false, error: 'Enter the amount the contributor actually paid now.' }, { status: 400 })
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
          if (!['PENDING','PARTIALLY_RECEIVED'].includes(locked.fulfillmentState)) throw new Error('DIRECT_ALREADY_FULFILLED')
          if (!locked.serviceEngagementId) throw new Error('DIRECT_ENGAGEMENT_REQUIRED')
          const promisedAmount = Number(locked.amount ?? 0)
          if (!Number.isFinite(promisedAmount) || promisedAmount <= 0) throw new Error('DIRECT_AMOUNT_REQUIRED')
          const paidRows = await tx.$queryRaw<Array<{ total: string }>>`
            SELECT COALESCE(SUM(amount), 0)::text AS total
              FROM wewed_contributions.payment_funding_allocations
             WHERE wedding_id = ${weddingId}
               AND contribution_id = ${id}
               AND source_kind = 'CONTRIBUTION'
               AND payment_id IS NOT NULL
          `
          const alreadyPaid = Number(paidRows[0]?.total ?? 0)
          const remainingBefore = Math.max(0, promisedAmount - alreadyPaid)
          if (remainingBefore <= 0.0001) throw new Error('DIRECT_ALREADY_FULFILLED')
          const paymentAmount = requestedAmount ?? remainingBefore
          if (paymentAmount > remainingBefore + 0.0001) throw new Error('DIRECT_OVERPAY')
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
              amount: paymentAmount,
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
              (${contributionId()}, ${weddingId}, ${payment.id}, ${budgetItemId}, ${id}, 'CONTRIBUTION', ${paymentAmount}, ${locked.currency}, ${actorId}, ${paidAt})
          `
          if (budgetItemId) await tx.budgetItem.update({ where: { id: budgetItemId }, data: { paidAmount: { increment: paymentAmount } } })
          const paidToDate = alreadyPaid + paymentAmount
          const remainingAfter = Math.max(0, promisedAmount - paidToDate)
          const complete = remainingAfter <= 0.0001
          const nextFulfillment = complete ? 'PAID_DIRECT' : 'PARTIALLY_RECEIVED'
          const nextCommitment = complete ? 'CONFIRMED' : 'PLEDGED'
          const nextVerification = complete ? 'RECONCILED' : 'CONFIRMED_BY_USER'
          const nextThankYou = complete ? 'TO_THANK' : 'NOT_DUE'
          await tx.$executeRaw`
            UPDATE wewed_contributions.wedding_contributions
               SET fulfillment_state = ${nextFulfillment}, commitment_state = ${nextCommitment}, verification_state = ${nextVerification},
                   thank_you_state = ${nextThankYou}, fulfilled_at = ${complete ? paidAt : null}, updated_at = NOW()
             WHERE id = ${id} AND wedding_id = ${weddingId}
          `
          await tx.auditEvent.create({ data: { weddingId, action: complete ? 'contribution.direct_vendor_paid' : 'contribution.direct_vendor_part_paid', actorId, resourceType: 'WeddingContribution', resourceId: id, afterValue: JSON.stringify({ paymentId: payment.id, budgetItemId, serviceEngagementId: locked.serviceEngagementId, paymentAmount, promisedAmount, paidToDate, remainingAfter, currency: locked.currency })} })
          return { paymentId: payment.id, paymentAmount, promisedAmount, paidToDate, remainingAmount: remainingAfter, fulfillmentState: nextFulfillment }
        })
        return NextResponse.json({ success: true, data: result })
      } catch (error) {
        const code = error instanceof Error ? error.message : ''
        if (code === 'DIRECT_ALREADY_FULFILLED') return NextResponse.json({ success: false, error: 'This direct vendor promise is already fully paid.' }, { status: 409 })
        if (code === 'DIRECT_OVERPAY') return NextResponse.json({ success: false, error: 'The payment entered is more than the remaining promised amount.' }, { status: 409 })
        if (code === 'DIRECT_ENGAGEMENT_REQUIRED') return NextResponse.json({ success: false, error: 'A direct vendor pledge needs its service engagement before payment can be recorded.' }, { status: 409 })
        if (code === 'DIRECT_AMOUNT_REQUIRED') return NextResponse.json({ success: false, error: 'A direct vendor pledge needs a positive amount before payment can be recorded.' }, { status: 409 })
        if (code === 'DIRECT_CURRENCY_MISMATCH') return NextResponse.json({ success: false, error: 'The direct vendor contribution and service engagement must use the same currency.' }, { status: 409 })
        if (code === 'DIRECT_NOT_FOUND') return NextResponse.json({ success: false, error: 'Contribution not found.' }, { status: 404 })
        throw error
      }
    }

'''
s = splice(s, start, end, replacement, 'direct installment action')
write(path, s)


# 5. Budget API returns the linked contribution facts, not copied notes.
path = 'src/app/api/planner/budget/route.ts'
s = read(path)
s = replace_once(
    s,
    "import { budgetContributionAllocations, budgetFundingRows } from '@/lib/contributions/store'",
    "import { budgetContributionAllocations, budgetContributionContexts, budgetFundingRows } from '@/lib/contributions/store'",
    'budget context import',
)
s = replace_once(
    s,
    "    let contributionAllocations: Awaited<ReturnType<typeof budgetContributionAllocations>> = []\n    try {\n      ;[fundingRows, contributionAllocations] = await Promise.all([\n        budgetFundingRows(access.context.weddingId),\n        budgetContributionAllocations(access.context.weddingId),\n      ])",
    "    let contributionAllocations: Awaited<ReturnType<typeof budgetContributionAllocations>> = []\n    let contributionContexts: Awaited<ReturnType<typeof budgetContributionContexts>> = []\n    try {\n      ;[fundingRows, contributionAllocations, contributionContexts] = await Promise.all([\n        budgetFundingRows(access.context.weddingId),\n        budgetContributionAllocations(access.context.weddingId),\n        budgetContributionContexts(access.context.weddingId),\n      ])",
    'budget context load',
)
s = replace_once(
    s,
    "      const contributionAllocated = itemAllocations.filter((row) => row.allocationKind === 'CASH').reduce((sum, row) => sum + Number(row.amount), 0)\n      return {\n        ...formatItem(item),\n        funding: { coupleFunded, contributorFunded, legacyUnattributed, otherAttributed, inKindValue, contributionAllocated },\n      }",
    "      const contributionAllocated = itemAllocations.filter((row) => row.allocationKind === 'CASH').reduce((sum, row) => sum + Number(row.amount), 0)\n      const linkedContributions = Array.from(new Map(\n        contributionContexts\n          .filter((row) => row.budgetItemId === item.id && row.currency === item.currency)\n          .map((row) => {\n            const promisedAmount = Number(row.contributionAmount ?? 0)\n            const paidAmount = Number(row.directPaidAmount ?? 0)\n            return [row.contributionId, {\n              contributionId: row.contributionId,\n              contributorName: row.contributorName,\n              title: row.title,\n              notes: row.notes,\n              type: row.type,\n              commitmentState: row.commitmentState,\n              fulfillmentState: row.fulfillmentState,\n              promisedAmount,\n              paidAmount,\n              remainingAmount: row.type === 'DIRECT_VENDOR_PAYMENT' ? Math.max(0, promisedAmount - paidAmount) : 0,\n              currency: row.currency,\n            }] as const\n          })\n      ).values())\n      return {\n        ...formatItem(item),\n        funding: { coupleFunded, contributorFunded, legacyUnattributed, otherAttributed, inKindValue, contributionAllocated },\n        contributions: linkedContributions,\n      }",
    'budget linked contexts',
)
write(path, s)


# 6. Budget UI surfaces the live contribution obligation and notes on the same cost row.
path = 'src/components/wedding/planner/modules/planner-budget-module.tsx'
s = read(path)
s = replace_once(
    s,
    "interface BudgetRow {\n  id: string",
    "interface BudgetContributionContext { contributionId: string; contributorName: string; title: string; notes: string | null; type: string; commitmentState: string; fulfillmentState: string; promisedAmount: number; paidAmount: number; remainingAmount: number; currency: string }\ninterface BudgetRow {\n  id: string",
    'budget contribution context type',
)
s = replace_once(
    s,
    "  funding?: BudgetFunding\n}",
    "  funding?: BudgetFunding\n  contributions?: BudgetContributionContext[]\n}",
    'budget row contexts',
)
anchor = "function FundingLine({ item }: { item: BudgetRow }) {"
pos = s.find(anchor)
if pos < 0:
    raise SystemExit('budget funding component anchor missing')
end_marker = "\n}\n\nexport function PlannerBudgetModule"
end_pos = s.find(end_marker, pos)
if end_pos < 0:
    raise SystemExit('budget funding component end missing')
existing = s[pos:end_pos+2]
context_component = existing + r'''

function ContributionContextLine({ item }: { item: BudgetRow }) {
  if (!item.contributions?.length) return null
  return <div className="mt-2 space-y-1.5">{item.contributions.map((contribution) => {
    const direct = contribution.type === 'DIRECT_VENDOR_PAYMENT'
    const stateLabel = direct
      ? contribution.fulfillmentState === 'PAID_DIRECT' ? 'Paid vendor directly'
        : contribution.fulfillmentState === 'PARTIALLY_RECEIVED' ? 'Part-paid vendor directly'
          : 'To pay vendor directly'
      : contribution.fulfillmentState.toLowerCase().replaceAll('_',' ')
    return <div key={contribution.contributionId} className="rounded-lg border border-gold/10 bg-gold/[0.025] px-2.5 py-2 font-sans text-[10px] leading-4 text-champagne/55">
      <p><span className="font-semibold text-gold/80">Linked contribution:</span> {contribution.contributorName} · {stateLabel}</p>
      {direct && <p>Promised {money(contribution.promisedAmount, contribution.currency)} · Paid {money(contribution.paidAmount, contribution.currency)} · Remaining {money(contribution.remainingAmount, contribution.currency)}</p>}
      {contribution.notes && <p className="text-champagne/45">Note: {contribution.notes}</p>}
    </div>
  })}</div>
}
'''
s = s[:pos] + context_component + s[end_pos+2:]
s = replace_once(s, '<FundingLine item={item} /></div>', '<FundingLine item={item} /><ContributionContextLine item={item} /></div>', 'budget render contribution context')
write(path, s)


# 7. Contributions UI: state-aware language, partial source classification, pledge correction, installments.
path = 'src/components/wedding/planner/planner-contributions-workspace.tsx'
s = read(path)
s = replace_once(
    s,
    "  id: string; type: ContributionType; title: string; description: string | null; amount: number | null; currency: string;",
    "  id: string; type: ContributionType; title: string; description: string | null; amount: number | null; directVendorPaidAmount: number; remainingAmount: number; currency: string;",
    'UI direct totals type',
)
s = replace_once(
    s,
    "function human(value: string) { return value.toLowerCase().replaceAll('_',' ').replace(/\\b\\w/g, (letter) => letter.toUpperCase()) }",
    "function human(value: string) { return value.toLowerCase().replaceAll('_',' ').replace(/\\b\\w/g, (letter) => letter.toUpperCase()) }\nfunction contributionTypeText(item: Pick<Contribution, 'type' | 'fulfillmentState'>) { if (item.type !== 'DIRECT_VENDOR_PAYMENT') return CONTRIBUTION_TYPE_LABELS[item.type]; if (item.fulfillmentState === 'PAID_DIRECT') return 'Paid vendor directly'; if (item.fulfillmentState === 'PARTIALLY_RECEIVED') return 'Part-paid vendor directly'; return 'To pay vendor directly' }",
    'dynamic direct label helper',
)
s = replace_once(
    s,
    "  const [fundingContributionId, setFundingContributionId] = useState('')\n  const [directPaymentReference, setDirectPaymentReference] = useState('')",
    "  const [fundingSelections, setFundingSelections] = useState<Record<string,string>>({})\n  const [fundingAmounts, setFundingAmounts] = useState<Record<string,string>>({})\n  const [directPaymentReference, setDirectPaymentReference] = useState('')\n  const [directPaymentAmount, setDirectPaymentAmount] = useState('')",
    'per row funding and payment state',
)
s = replace_once(
    s,
    "  const [contributionEdit, setContributionEdit] = useState({ title:'', description:'', notes:'', expectedAt:'', estimatedValue:'', quantity:'', unit:'' })",
    "  const [contributionEdit, setContributionEdit] = useState({ title:'', description:'', notes:'', expectedAt:'', amount:'', estimatedValue:'', quantity:'', unit:'' })",
    'editable pledge amount state',
)
s = replace_once(
    s,
    "    setDirectPaymentReference('')\n    setTaskTitle(`Follow up contribution from ${item.contributor.displayName}`)\n    setContributionEdit({ title:item.title, description:item.description ?? '', notes:item.notes ?? '', expectedAt:'', estimatedValue:item.estimatedValue === null ? '' : String(item.estimatedValue), quantity:item.quantity === null ? '' : String(item.quantity), unit:item.unit ?? '' })",
    "    setDirectPaymentReference('')\n    setDirectPaymentAmount('')\n    setTaskTitle(`Follow up contribution from ${item.contributor.displayName}`)\n    setContributionEdit({ title:item.title, description:item.description ?? '', notes:item.notes ?? '', expectedAt:item.expectedAt?.slice(0,10) ?? '', amount:item.amount === null ? '' : String(item.amount), estimatedValue:item.estimatedValue === null ? '' : String(item.estimatedValue), quantity:item.quantity === null ? '' : String(item.quantity), unit:item.unit ?? '' })",
    'load editable pledge amount',
)
s = replace_once(
    s,
    "body:JSON.stringify({ title:contributionEdit.title, description:contributionEdit.description, notes:contributionEdit.notes, expectedAt:contributionEdit.expectedAt || null, estimatedValue:contributionEdit.estimatedValue === '' ? null : Number(contributionEdit.estimatedValue), quantity:contributionEdit.quantity === '' ? null : Number(contributionEdit.quantity), unit:contributionEdit.unit || null })",
    "body:JSON.stringify({ title:contributionEdit.title, description:contributionEdit.description, notes:contributionEdit.notes, expectedAt:contributionEdit.expectedAt || null, ...(manage.type === 'DIRECT_VENDOR_PAYMENT' && manage.fulfillmentState === 'PENDING' ? { amount:Number(contributionEdit.amount) } : {}), estimatedValue:contributionEdit.estimatedValue === '' ? null : Number(contributionEdit.estimatedValue), quantity:contributionEdit.quantity === '' ? null : Number(contributionEdit.quantity), unit:contributionEdit.unit || null })",
    'save corrected pledge amount',
)
old_classify = """  async function classifyFunding(item: FundingItem, sourceKind: 'COUPLE' | 'CONTRIBUTION') {\n    if (item.unattributed <= 0) return\n    if (sourceKind === 'CONTRIBUTION' && !fundingContributionId) { toast({ title: 'Choose a contribution first', variant: 'destructive' }); return }\n    await mutate('/api/planner/budget/funding', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ budgetItemId: item.id, sourceKind, amount: item.unattributed, contributionId: sourceKind === 'CONTRIBUTION' ? fundingContributionId : null }) })\n  }\n"""
new_classify = """  async function classifyFunding(item: FundingItem, sourceKind: 'COUPLE' | 'CONTRIBUTION') {\n    if (item.unattributed <= 0) return\n    const amount = Number(fundingAmounts[item.id] ?? item.unattributed)\n    const contributionId = fundingSelections[item.id] ?? ''\n    if (!Number.isFinite(amount) || amount <= 0 || amount > item.unattributed + 0.0001) { toast({ title: 'Enter an amount within the source-not-recorded balance', variant: 'destructive' }); return }\n    if (sourceKind === 'CONTRIBUTION' && !contributionId) { toast({ title: 'Choose received contribution cash first', variant: 'destructive' }); return }\n    const success = await mutate('/api/planner/budget/funding', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ budgetItemId: item.id, sourceKind, amount, contributionId: sourceKind === 'CONTRIBUTION' ? contributionId : null }) })\n    if (success) { setFundingSelections((current) => ({...current,[item.id]:''})); setFundingAmounts((current) => ({...current,[item.id]:''})) }\n  }\n"""
s = replace_once(s, old_classify, new_classify, 'partial historical classification')
s = s.replace("{CONTRIBUTION_TYPE_LABELS[item.type]}", "{contributionTypeText(item)}")
s = s.replace("{CONTRIBUTION_TYPE_LABELS[manage.type]} · {human(manage.fulfillmentState)}", "{contributionTypeText(manage)} · {human(manage.fulfillmentState)}")
s = s.replace('<option value="direct">Paid vendor directly</option>', '<option value="direct">Direct vendor support</option>')

old_cards = """<div className=\"mt-5 grid gap-3 sm:grid-cols-2\"><Panel className=\"p-3\"><p className=\"text-[10px] uppercase text-champagne/40\">Recorded value</p><p className=\"mt-1 font-serif text-xl\">{manage.amount !== null ? money(manage.amount,manage.currency) : manage.estimatedValue !== null ? `${money(manage.estimatedValue,manage.estimatedValueCurrency || manage.currency)} est.` : 'Not valued'}</p></Panel><Panel className=\"p-3\"><p className=\"text-[10px] uppercase text-champagne/40\">Still available</p><p className=\"mt-1 font-serif text-xl\">{money(manage.availableAmount,manage.currency)}</p><p className=\"mt-1 text-[10px] text-champagne/40\">Verification: {human(manage.verificationState)}</p></Panel></div>"""
new_cards = """{manage.type === 'DIRECT_VENDOR_PAYMENT' ? <div className=\"mt-5 grid gap-3 sm:grid-cols-3\"><Panel className=\"p-3\"><p className=\"text-[10px] uppercase text-champagne/40\">Promised</p><p className=\"mt-1 font-serif text-xl\">{money(manage.amount ?? 0,manage.currency)}</p></Panel><Panel className=\"p-3\"><p className=\"text-[10px] uppercase text-champagne/40\">Paid</p><p className=\"mt-1 font-serif text-xl\">{money(manage.directVendorPaidAmount,manage.currency)}</p></Panel><Panel className=\"p-3\"><p className=\"text-[10px] uppercase text-champagne/40\">Remaining</p><p className=\"mt-1 font-serif text-xl\">{money(manage.remainingAmount,manage.currency)}</p></Panel></div> : <div className=\"mt-5 grid gap-3 sm:grid-cols-2\"><Panel className=\"p-3\"><p className=\"text-[10px] uppercase text-champagne/40\">Recorded value</p><p className=\"mt-1 font-serif text-xl\">{manage.amount !== null ? money(manage.amount,manage.currency) : manage.estimatedValue !== null ? `${money(manage.estimatedValue,manage.estimatedValueCurrency || manage.currency)} est.` : 'Not valued'}</p></Panel><Panel className=\"p-3\"><p className=\"text-[10px] uppercase text-champagne/40\">Still available</p><p className=\"mt-1 font-serif text-xl\">{money(manage.availableAmount,manage.currency)}</p><p className=\"mt-1 text-[10px] text-champagne/40\">Verification: {human(manage.verificationState)}</p></Panel></div>}"""
s = replace_once(s, old_cards, new_cards, 'direct promised paid remaining cards')

start = "{canEdit && manage.type === 'DIRECT_VENDOR_PAYMENT' && manage.commitmentState === 'PLEDGED' && manage.fulfillmentState === 'PENDING' && <div className=\"mt-4 rounded-xl border border-gold/15 p-3\"><h3 className=\"font-medium\">Record the vendor payment</h3>"
end = "<div className=\"mt-4 rounded-xl border border-gold/15 p-3\"><div className=\"flex items-center justify-between gap-2\"><div><h3 className=\"font-medium\">Contribution details</h3>"
replacement = """{canEdit && manage.type === 'DIRECT_VENDOR_PAYMENT' && manage.commitmentState === 'PLEDGED' && ['PENDING','PARTIALLY_RECEIVED'].includes(manage.fulfillmentState) && manage.remainingAmount > 0 && <div className=\"mt-4 rounded-xl border border-gold/15 p-3\"><h3 className=\"font-medium\">Record a vendor payment</h3><p className=\"mt-1 text-xs text-champagne/50\">Enter only what the contributor actually paid now. Wewed creates a real vendor payment for that installment, updates Budget Paid by the same amount, and keeps the rest outstanding.</p><div className=\"mt-2 grid gap-2 sm:grid-cols-[9rem_1fr_auto]\"><Input inputMode=\"decimal\" value={directPaymentAmount} onChange={(e) => setDirectPaymentAmount(e.target.value)} placeholder={`Amount (max ${money(manage.remainingAmount,manage.currency)})`} className=\"border-gold/20 bg-espresso/70\" /><Input value={directPaymentReference} onChange={(e) => setDirectPaymentReference(e.target.value)} placeholder=\"Payment reference (optional)\" className=\"border-gold/20 bg-espresso/70\" /><Button disabled={saving || !directPaymentAmount || Number(directPaymentAmount) <= 0 || Number(directPaymentAmount) > manage.remainingAmount} onClick={() => void contributionAction('mark-direct-paid',{amount:Number(directPaymentAmount),paymentReference:directPaymentReference})} className=\"bg-gold text-espresso\">Record amount paid</Button></div></div>}""" + end
s = splice(s, start, end, replacement, 'direct installment controls')

old_details = """<Input disabled={!canEdit} type=\"date\" value={contributionEdit.expectedAt} onChange={(e)=>setContributionEdit((c)=>({...c,expectedAt:e.target.value}))} className=\"border-gold/20 bg-espresso/70\"/><Input disabled={!canEdit} inputMode=\"decimal\" value={contributionEdit.estimatedValue}"""
new_details = """<Input disabled={!canEdit} type=\"date\" value={contributionEdit.expectedAt} onChange={(e)=>setContributionEdit((c)=>({...c,expectedAt:e.target.value}))} className=\"border-gold/20 bg-espresso/70\"/>{manage.type === 'DIRECT_VENDOR_PAYMENT' && manage.fulfillmentState === 'PENDING' && <div><Label>Promised amount</Label><Input disabled={!canEdit} inputMode=\"decimal\" value={contributionEdit.amount} onChange={(e)=>setContributionEdit((c)=>({...c,amount:e.target.value}))} placeholder=\"Promised amount\" className=\"mt-1 border-gold/20 bg-espresso/70\"/></div>}<Input disabled={!canEdit} inputMode=\"decimal\" value={contributionEdit.estimatedValue}"""
s = replace_once(s, old_details, new_details, 'promise amount editor')

panel_start = "      {canEdit && funding.some((item) => item.unattributed > 0) && <Panel className=\"p-4\"><div className=\"flex items-start gap-3\"><CircleDollarSign"
panel_end = "      <Panel className=\"p-4\"><div className=\"grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]\">"
new_panel = r'''      {canEdit && funding.some((item) => item.unattributed > 0) && <Panel className="p-4"><div className="flex items-start gap-3"><CircleDollarSign className="mt-0.5 size-5 text-gold" /><div><h2 className="font-serif text-xl">Previous payments to classify</h2><p className="mt-1 text-xs leading-5 text-champagne/50">These amounts were already marked Paid before Wewed tracked who funded them. Classify all or part of each paid amount without changing the payment itself.</p></div></div><div className="mt-4 grid gap-2 lg:grid-cols-2">{funding.filter((item) => item.unattributed > 0).map((item) => { const eligible = (workspace?.data ?? []).filter((contribution) => contribution.currency === item.currency && ['CASH_TO_COUPLE','HONEYMOON_GIFT'].includes(contribution.type) && contribution.fulfillmentState === 'RECEIVED' && contribution.availableAmount > 0); const selected = fundingSelections[item.id] ?? ''; const amount = fundingAmounts[item.id] ?? String(item.unattributed); return <div key={item.id} className="rounded-xl border border-gold/12 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{item.description}</p><p className="text-xs text-champagne/45">Already paid: {money(item.paidAmount,item.currency)}</p></div><Badge variant="outline" className="border-clay/30 text-clay-light">{money(item.unattributed,item.currency)} source not recorded</Badge></div><div className="mt-3 grid gap-2 sm:grid-cols-[8rem_auto_minmax(12rem,1fr)_auto]"><Input aria-label={`Funding amount ${item.description}`} inputMode="decimal" value={amount} onChange={(event)=>setFundingAmounts((current)=>({...current,[item.id]:event.target.value}))} placeholder="Amount" className="h-9 border-gold/20 bg-espresso/70 text-xs"/><Button size="sm" variant="outline" disabled={saving} onClick={() => void classifyFunding(item,'COUPLE')} className="border-gold/20 bg-transparent">Paid by us</Button><select aria-label={`Contribution funding ${item.description}`} value={selected} disabled={eligible.length === 0} onChange={(event) => setFundingSelections((current)=>({...current,[item.id]:event.target.value}))} className="h-9 min-w-44 rounded-md border border-gold/20 bg-espresso px-2 text-xs"><option value="">{eligible.length ? 'Choose received contribution cash…' : 'No received contribution cash available'}</option>{eligible.map((contribution) => <option key={contribution.id} value={contribution.id}>{contribution.contributor.displayName} — {contribution.title} ({money(contribution.availableAmount,contribution.currency)} available)</option>)}</select><Button size="sm" variant="outline" disabled={saving || !selected} onClick={() => void classifyFunding(item,'CONTRIBUTION')} className="border-gold/20 bg-transparent">Paid by contributor</Button></div><p className="mt-2 text-[10px] leading-4 text-champagne/40">“Choose contribution” means cash already received by you and still available to fund this past payment. A promise to pay a vendor is not cash received and will not appear here.</p></div>})}</div></Panel>}

'''
s = splice(s, panel_start, panel_end, new_panel + panel_end, 'historical funding controls')
write(path, s)


# 8. Regression tests exercise actual accounting semantics plus source/UI contracts.
test_path = 'src/lib/contributions-partial-payments-uat.test.ts'
Path(test_path).write_text(r'''import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { summarizeContributions } from '@/lib/contributions'

const actions = readFileSync('src/app/api/planner/contributions/[id]/actions/route.ts','utf8')
const detail = readFileSync('src/app/api/planner/contributions/[id]/route.ts','utf8')
const workspace = readFileSync('src/components/wedding/planner/planner-contributions-workspace.tsx','utf8')
const budget = readFileSync('src/components/wedding/planner/modules/planner-budget-module.tsx','utf8')

describe('Contributions partial-payment UAT accounting', () => {
  test('direct vendor installments split paid from promised remainder', () => {
    const summary = summarizeContributions([{ type:'DIRECT_VENDOR_PAYMENT', amount:250, currency:'USD', estimatedValue:null, estimatedValueCurrency:null, commitmentState:'PLEDGED', fulfillmentState:'PARTIALLY_RECEIVED', directVendorPaidAmount:100 }])
    expect(summary).toEqual([{ currency:'USD', cashReceived:0, directVendorPaid:100, inKindValue:0, pledged:150, availableCash:0 }])
  })

  test('direct vendor action creates only the installment and leaves a remainder', () => {
    expect(actions).toContain("['PENDING','PARTIALLY_RECEIVED'].includes(locked.fulfillmentState)")
    expect(actions).toContain('const paymentAmount = requestedAmount ?? remainingBefore')
    expect(actions).toContain('amount: paymentAmount')
    expect(actions).toContain("const nextFulfillment = complete ? 'PAID_DIRECT' : 'PARTIALLY_RECEIVED'")
    expect(actions).toContain('paidAmount: { increment: paymentAmount }')
  })

  test('an unreconciled pending direct pledge can be corrected without splitting its allocation', () => {
    expect(detail).toContain("current.fulfillmentState === 'PENDING' && body.amount !== undefined")
    expect(detail).toContain("allocation_kind = 'DIRECT_PAYMENT'")
    expect(detail).toContain('SET amount = ${amount}')
  })

  test('historical classifier accepts partial amounts and only eligible received cash', () => {
    expect(workspace).toContain('fundingAmounts[item.id] ?? item.unattributed')
    expect(workspace).toContain("['CASH_TO_COUPLE','HONEYMOON_GIFT'].includes(contribution.type)")
    expect(workspace).toContain("contribution.fulfillmentState === 'RECEIVED'")
    expect(workspace).toContain('No received contribution cash available')
    expect(workspace).toContain('A promise to pay a vendor is not cash received')
  })

  test('UI and Budget distinguish promise, paid and remaining', () => {
    expect(workspace).toContain("return 'To pay vendor directly'")
    expect(workspace).toContain('Part-paid vendor directly')
    expect(workspace).toContain('directVendorPaidAmount')
    expect(workspace).toContain('remainingAmount')
    expect(budget).toContain('Linked contribution:')
    expect(budget).toContain('Promised {money(contribution.promisedAmount')
    expect(budget).toContain('Note: {contribution.notes}')
  })
})
''')

# Fail closed on the user-visible invariants.
checks = {
  'src/lib/contributions.ts': ['directVendorPaidAmount?: number', 'Math.max(0, amount - directPaid)'],
  'src/app/api/planner/contributions/[id]/actions/route.ts': ["'PARTIALLY_RECEIVED'", 'paymentAmount', 'remainingAfter'],
  'src/components/wedding/planner/planner-contributions-workspace.tsx': ['To pay vendor directly', 'No received contribution cash available', 'Record amount paid'],
  'src/components/wedding/planner/modules/planner-budget-module.tsx': ['Linked contribution:', 'Remaining {money(contribution.remainingAmount'],
}
for filename, needles in checks.items():
    value = read(filename)
    for needle in needles:
        if needle not in value:
            raise SystemExit(f'{filename}: invariant missing: {needle}')
print('Contributions partial-payment UAT materialization complete.')
