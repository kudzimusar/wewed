from pathlib import Path

ROOT = Path('.')


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}: {old[:140]!r}')
    write(path, text.replace(old, new, 1))


# Direct vendor contributions keep the service engagement's vendor identity and preserve a Budget target even while pledged.
route = 'src/app/api/planner/contributions/route.ts'
replace_once(
    route,
    "      const vendorId = typeof body.vendorId === 'string' && body.vendorId ? body.vendorId : null\n      if (vendorId) {",
    "      const vendorId = typeof body.vendorId === 'string' && body.vendorId ? body.vendorId : null\n      let resolvedVendorId = vendorId\n      if (vendorId) {",
)
replace_once(
    route,
    "        if (directPayment && engagement.currency !== currency) throw new Error('CURRENCY_MISMATCH')\n      }",
    """        if (directPayment && engagement.currency !== currency) throw new Error('CURRENCY_MISMATCH')
        if (vendorId && engagement.vendorId !== vendorId) throw new Error('VENDOR_ENGAGEMENT_MISMATCH')
        if (directPayment) resolvedVendorId = engagement.vendorId
      }""",
)
replace_once(
    route,
    "(${contributionIdValue}, ${weddingId}, ${contributorIdValue}, ${campaignId}, ${vendorId}, ${serviceEngagementId},",
    "(${contributionIdValue}, ${weddingId}, ${contributorIdValue}, ${campaignId}, ${resolvedVendorId}, ${serviceEngagementId},",
)
replace_once(
    route,
    """      if (directPayment && fulfillmentState === 'PAID_DIRECT' && serviceEngagementId && amount && amount > 0) {""",
    """      if (budgetItemId && directPayment && amount && amount > 0) {
        await tx.$executeRaw`
          INSERT INTO wewed_contributions.contribution_allocations
            (id, wedding_id, contribution_id, budget_item_id, amount, currency, allocation_kind, created_by_id)
          VALUES
            (${contributionId()}, ${weddingId}, ${contributionIdValue}, ${budgetItemId}, ${amount}, ${currency}, 'DIRECT_PAYMENT', ${actorId})
        `
      }

      if (directPayment && fulfillmentState === 'PAID_DIRECT' && serviceEngagementId && amount && amount > 0) {""",
)
replace_once(
    route,
    "      VENDOR_SCOPE: 'That vendor does not belong to this wedding.',",
    "      VENDOR_SCOPE: 'That vendor does not belong to this wedding.',\n      VENDOR_ENGAGEMENT_MISMATCH: 'That vendor does not match the selected service engagement.',",
)

# A promised direct payment remains editable/deletable until money is actually paid, but generic PATCH cannot bypass the payment fact.
detail = 'src/app/api/planner/contributions/[id]/route.ts'
text = read(detail)
lock_old = "(SELECT COUNT(*) FROM wewed_contributions.contribution_allocations WHERE wedding_id = ${weddingId} AND contribution_id = ${id}) +"
lock_new = "(SELECT COUNT(*) FROM wewed_contributions.contribution_allocations WHERE wedding_id = ${weddingId} AND contribution_id = ${id} AND allocation_kind <> 'DIRECT_PAYMENT') +"
if text.count(lock_old) != 2:
    raise SystemExit(f'{detail}: expected two financial lock queries, found {text.count(lock_old)}')
write(detail, text.replace(lock_old, lock_new, 2))
replace_once(
    detail,
    """    if (financiallyLocked && ['amount','currency','type','fulfillmentState'].some((field) => body[field] !== undefined)) {
      return NextResponse.json({ success: false, error: 'This contribution is already allocated or reconciled. Use an adjustment/reversal rather than rewriting the financial fact.' }, { status: 409 })
    }
""",
    """    if (financiallyLocked && ['amount','currency','type','fulfillmentState'].some((field) => body[field] !== undefined)) {
      return NextResponse.json({ success: false, error: 'This contribution is already allocated or reconciled. Use an adjustment/reversal rather than rewriting the financial fact.' }, { status: 409 })
    }
    if (current.type === 'DIRECT_VENDOR_PAYMENT' && current.fulfillmentState === 'PENDING' && (body.amount !== undefined || body.currency !== undefined)) {
      return NextResponse.json({ success: false, error: 'For a promised direct vendor payment, delete and recreate the pledge to change its amount or currency before payment.' }, { status: 409 })
    }
    if (current.type === 'DIRECT_VENDOR_PAYMENT' && current.fulfillmentState !== 'PAID_DIRECT' && body.fulfillmentState === 'PAID_DIRECT') {
      return NextResponse.json({ success: false, error: 'Record the vendor payment through the direct-payment action so Wewed creates the real payment and funding attribution together.' }, { status: 409 })
    }
""",
)

# Fulfil a promised direct vendor contribution as one atomic EngagementPayment + funding attribution + Budget update.
actions = 'src/app/api/planner/contributions/[id]/actions/route.ts'
replace_once(
    actions,
    "    if (action === 'mark-received') {",
    """    if (action === 'mark-direct-paid') {
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
          await tx.auditEvent.create({ data: { weddingId, eventType: 'contribution.direct_vendor_paid', actorType: 'user', actorId, targetType: 'WeddingContribution', targetId: id, payload: JSON.stringify({ paymentId: payment.id, budgetItemId, serviceEngagementId: locked.serviceEngagementId, amount, currency: locked.currency }), severity: 'info' } })
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

    if (action === 'mark-received') {""",
)

# Planner manage UI exposes the missing promised -> paid direct-vendor lifecycle without creating a duplicate contribution.
ui = 'src/components/wedding/planner/planner-contributions-workspace.tsx'
replace_once(
    ui,
    "  const [fundingContributionId, setFundingContributionId] = useState('')\n",
    "  const [fundingContributionId, setFundingContributionId] = useState('')\n  const [directPaymentReference, setDirectPaymentReference] = useState('')\n",
)
text = read(ui)
manage_marker = "setManage(item); setTaskTitle(`Follow up contribution from ${item.contributor.displayName}`)"
if text.count(manage_marker) != 2:
    raise SystemExit(f'{ui}: expected two manage-entry handlers, found {text.count(manage_marker)}')
write(ui, text.replace(manage_marker, "setManage(item); setDirectPaymentReference(''); setTaskTitle(`Follow up contribution from ${item.contributor.displayName}`)", 2))
replace_once(
    ui,
    "<div className=\"mt-4 grid gap-3 sm:grid-cols-2\"><div className=\"rounded-xl border border-gold/15 p-3\"><h3 className=\"font-medium\">Follow-up task</h3>",
    """{canEdit && manage.type === 'DIRECT_VENDOR_PAYMENT' && manage.commitmentState === 'PLEDGED' && manage.fulfillmentState === 'PENDING' && <div className="mt-4 rounded-xl border border-gold/15 p-3"><h3 className="font-medium">Record the vendor payment</h3><p className="mt-1 text-xs text-champagne/50">Use this when the contributor has now paid the vendor. Wewed will create the real vendor payment, funding attribution and Budget update together.</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><Input value={directPaymentReference} onChange={(e) => setDirectPaymentReference(e.target.value)} placeholder="Payment reference (optional)" className="border-gold/20 bg-espresso/70" /><Button disabled={saving} onClick={() => void contributionAction('mark-direct-paid',{paymentReference:directPaymentReference})} className="bg-gold text-espresso">Record vendor paid</Button></div></div>}<div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-gold/15 p-3"><h3 className="font-medium">Follow-up task</h3>""",
)

# Campaign creation fails closed on malformed targets/booleans instead of silently dropping or coercing them.
campaign = 'src/app/api/planner/contribution-campaigns/route.ts'
replace_once(
    campaign,
    """    const externalUrl = String(body.externalUrl ?? '').trim() || null
    if (externalUrl && !/^https:\\/\\//i.test(externalUrl)) return NextResponse.json({ success: false, error: 'External campaign links must use HTTPS.' }, { status: 400 })
    if (body.currency !== undefined && !isCurrencyCode(body.currency)) return NextResponse.json({ success: false, error: 'Use a three-letter currency code such as USD.' }, { status: 400 })
""",
    """    const externalUrl = String(body.externalUrl ?? '').trim() || null
    if (externalUrl && !/^https:\\/\\//i.test(externalUrl)) return NextResponse.json({ success: false, error: 'External campaign links must use HTTPS.' }, { status: 400 })
    const targetAmount = finiteNonNegative(body.targetAmount)
    if (body.targetAmount !== undefined && body.targetAmount !== null && body.targetAmount !== '' && targetAmount === null) return NextResponse.json({ success: false, error: 'Target amount must be zero or more.' }, { status: 400 })
    for (const field of ['published','showTarget','showRaised','invitationVisible']) {
      if (body[field] !== undefined && typeof body[field] !== 'boolean') return NextResponse.json({ success: false, error: `${field} must be true or false.` }, { status: 400 })
    }
    if (body.currency !== undefined && !isCurrencyCode(body.currency)) return NextResponse.json({ success: false, error: 'Use a three-letter currency code such as USD.' }, { status: 400 })
""",
)
replace_once(
    campaign,
    "${finiteNonNegative(body.targetAmount)}, ${currency},",
    "${targetAmount}, ${currency},",
)

# Contract tests cover the direct-vendor pledge lifecycle and strict campaign creation semantics.
contract = 'src/lib/contributions-source-contract.test.ts'
insert = """
  test('Promised direct vendor support preserves its Budget target and fulfils through a real EngagementPayment', () => {
    const route = read('src/app/api/planner/contributions/route.ts')
    const actions = read('src/app/api/planner/contributions/[id]/actions/route.ts')
    const detail = read('src/app/api/planner/contributions/[id]/route.ts')
    const ui = read('src/components/wedding/planner/planner-contributions-workspace.tsx')
    expect(route).toContain("'DIRECT_PAYMENT'")
    expect(route).toContain('resolvedVendorId = engagement.vendorId')
    expect(actions).toContain("action === 'mark-direct-paid'")
    expect(actions).toContain('tx.engagementPayment.create')
    expect(actions).toContain('contribution.direct_vendor_paid')
    expect(actions).toContain('paidAmount: { increment: amount }')
    expect(detail).toContain("allocation_kind <> 'DIRECT_PAYMENT'")
    expect(detail).toContain('Record the vendor payment through the direct-payment action')
    expect(ui).toContain('Record vendor paid')
  })

  test('Campaign creation validates target amount and boolean governance fields', () => {
    const campaign = read('src/app/api/planner/contribution-campaigns/route.ts')
    expect(campaign).toContain('Target amount must be zero or more.')
    expect(campaign).toContain("['published','showTarget','showRaised','invitationVisible']")
    expect(campaign).toContain('${targetAmount}, ${currency}')
  })
"""
text = read(contract)
needle = "\n  test('public campaign endpoint never selects contributor identity', () => {"
if text.count(needle) != 1:
    raise SystemExit('source contract final-hardening insertion point not unique')
write(contract, text.replace(needle, insert + needle, 1))

print('Contributions final domain hardening applied.')
