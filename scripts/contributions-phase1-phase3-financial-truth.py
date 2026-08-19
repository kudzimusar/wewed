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
        raise SystemExit(f'{path}: expected exactly one match, found {count}: {old[:170]!r}')
    write(path, text.replace(old, new, 1))


# Phase 1 migration: preserve source-less historical facts as explicit LEGACY_UNATTRIBUTED without inventing a payer/payment.
write(
    'prisma/migrations/20260819190000_contributions_legacy_funding_backfill/migration.sql',
    """-- WW-CONTRIBUTIONS-2026-08-19-01 — legacy source-of-funds truth preservation
-- Existing EngagementPayment rows remain the payment facts. Budget-only paid amounts remain Budget facts.
-- No payer, payment timestamp, payment reference, or proof is fabricated by this migration.

INSERT INTO wewed_contributions.payment_funding_allocations
  (id, wedding_id, payment_id, source_kind, amount, currency, note, created_at, updated_at)
SELECT
  'wwc_legacy_payment_' || md5(p.id),
  se."weddingId",
  p.id,
  'LEGACY_UNATTRIBUTED',
  p.amount,
  p.currency,
  'Migration: payment existed before source-of-funds tracking; funding source not recorded.',
  NOW(),
  NOW()
FROM public."EngagementPayment" p
JOIN public."ServiceEngagement" se ON se.id = p."serviceEngagementId"
WHERE p.amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM wewed_contributions.payment_funding_allocations f
    WHERE f.payment_id = p.id
  );

-- A Budget paidAmount with no durable EngagementPayment stays a Budget-only historical fact.
-- If an EngagementPayment already exists for the linked ServiceEngagement, the payment-level row above is authoritative
-- and we do not duplicate the same economic fact at Budget level.
INSERT INTO wewed_contributions.payment_funding_allocations
  (id, wedding_id, budget_item_id, source_kind, amount, currency, note, created_at, updated_at)
SELECT
  'wwc_legacy_budget_' || md5(b.id),
  b."weddingId",
  b.id,
  'LEGACY_UNATTRIBUTED',
  b."paidAmount",
  b.currency,
  'Migration: Budget paidAmount existed without a durable payment/source record; funding source not recorded.',
  NOW(),
  NOW()
FROM public."BudgetItem" b
WHERE b."paidAmount" > 0
  AND NOT EXISTS (
    SELECT 1 FROM wewed_contributions.payment_funding_allocations f
    WHERE f.budget_item_id = b.id
  )
  AND (
    b."serviceEngagementId" IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public."EngagementPayment" p
      WHERE p."serviceEngagementId" = b."serviceEngagementId"
    )
  );
""",
)

# Budget funding reconciliation: LEGACY_UNATTRIBUTED is an unknown placeholder, not a classified source that blocks correction.
funding_route = 'src/app/api/planner/budget/funding/route.ts'
replace_once(
    funding_route,
    "      const attributed = funding.reduce((sum, row) => sum + Number(row.amount), 0)\n      return { ...item, funding: funding.map((row) => ({ ...row, amount: Number(row.amount) })), unattributed: Math.max(0, item.paidAmount - attributed) }",
    """      const classified = funding.filter((row) => row.sourceKind !== 'LEGACY_UNATTRIBUTED').reduce((sum, row) => sum + Number(row.amount), 0)
      return { ...item, funding: funding.map((row) => ({ ...row, amount: Number(row.amount) })), unattributed: Math.max(0, item.paidAmount - classified) }""",
)
replace_once(
    funding_route,
    "         WHERE wedding_id = ${weddingId} AND budget_item_id = ${budgetItemId} AND currency = ${budget.currency}\n      `\n      const already = Number(totals[0]?.total ?? 0)",
    """         WHERE wedding_id = ${weddingId} AND budget_item_id = ${budgetItemId} AND currency = ${budget.currency}
           AND source_kind <> 'LEGACY_UNATTRIBUTED'
      `
      const already = Number(totals[0]?.total ?? 0)""",
)
# Insert helper before final funding insert.
replace_once(
    funding_route,
    """      await tx.$executeRaw`
        INSERT INTO wewed_contributions.payment_funding_allocations
          (id, wedding_id, budget_item_id, contribution_id, source_kind, amount, currency, note, created_by_id, reconciled_at)
""",
    """      const legacyRows = await tx.$queryRaw<Array<{ id:string; amount:string }>>`
        SELECT id, amount::text AS amount
          FROM wewed_contributions.payment_funding_allocations
         WHERE wedding_id = ${weddingId} AND budget_item_id = ${budgetItemId}
           AND currency = ${budget.currency} AND source_kind = 'LEGACY_UNATTRIBUTED'
         ORDER BY created_at, id
         FOR UPDATE
      `
      let remainingToReplace = amount
      for (const row of legacyRows) {
        if (remainingToReplace <= 0) break
        const legacyAmount = Number(row.amount)
        if (remainingToReplace + 0.0001 >= legacyAmount) {
          await tx.$executeRaw`DELETE FROM wewed_contributions.payment_funding_allocations WHERE id = ${row.id}`
          remainingToReplace -= legacyAmount
        } else {
          await tx.$executeRaw`UPDATE wewed_contributions.payment_funding_allocations SET amount = amount - ${remainingToReplace}, updated_at = NOW() WHERE id = ${row.id}`
          remainingToReplace = 0
        }
      }

      await tx.$executeRaw`
        INSERT INTO wewed_contributions.payment_funding_allocations
          (id, wedding_id, budget_item_id, contribution_id, source_kind, amount, currency, note, created_by_id, reconciled_at)
""",
)

# Cash availability also accounts for contribution-funded real payments that have no Budget allocation target.
store = 'src/lib/contributions/store.ts'
replace_once(
    store,
    "    const allocatedAmount = rowAllocations\n      .filter((item) => item.allocationKind === 'CASH')\n      .reduce((sum, item) => sum + item.amount, 0)",
    """    const allocationCash = rowAllocations
      .filter((item) => item.allocationKind === 'CASH')
      .reduce((sum, item) => sum + item.amount, 0)
    const paymentOnlyCash = funding
      .filter((item) => item.contributionId === row.id && item.sourceKind === 'CONTRIBUTION' && item.paymentId && !item.budgetItemId)
      .reduce((sum, item) => sum + Number(item.amount), 0)
    const allocatedAmount = allocationCash + paymentOnlyCash""",
)
replace_once(
    store,
    "    SELECT COALESCE(SUM(amount), 0)::text AS total\n      FROM wewed_contributions.contribution_allocations\n     WHERE wedding_id = ${weddingId}\n       AND contribution_id = ${contributionIdValue}\n       AND allocation_kind = 'CASH'\n  `\n  return Number(rows[0]?.total ?? 0)",
    """    SELECT (
      COALESCE((SELECT SUM(amount) FROM wewed_contributions.contribution_allocations
        WHERE wedding_id = ${weddingId} AND contribution_id = ${contributionIdValue} AND allocation_kind = 'CASH'), 0)
      +
      COALESCE((SELECT SUM(amount) FROM wewed_contributions.payment_funding_allocations
        WHERE wedding_id = ${weddingId} AND contribution_id = ${contributionIdValue}
          AND source_kind = 'CONTRIBUTION' AND payment_id IS NOT NULL AND budget_item_id IS NULL), 0)
    )::text AS total
  `
  return Number(rows[0]?.total ?? 0)""",
)

# Payment-level source-of-funds API. This is the canonical mixed-payment allocation path.
write(
    'src/app/api/planner/payments/[id]/funding/route.ts',
    """import { NextRequest, NextResponse } from 'next/server'\nimport { db } from '@/lib/db'\nimport { contributionAvailableAmount, finiteNonNegative } from '@/lib/contributions'\nimport { contributionAllocatedCash, contributionId, getContribution } from '@/lib/contributions/store'\nimport { requireWeddingPermission } from '@/lib/wedding-access'\n\ninterface RouteContext { params: Promise<{ id:string }> }\n\nasync function paymentForWedding(weddingId:string, id:string) {\n  return db.engagementPayment.findFirst({ where:{ id, serviceEngagement:{ weddingId } }, include:{ serviceEngagement:{ select:{ id:true, weddingId:true, currency:true, vendorId:true, vendor:{ select:{ id:true, name:true } }, budgetItems:{ select:{ id:true, description:true, currency:true } } } } } })\n}\n\nexport async function GET(request:NextRequest, context:RouteContext) {\n  const access = await requireWeddingPermission(request, 'budget.view')\n  if (access.error) return access.error\n  const { id } = await context.params\n  const weddingId = access.context.weddingId\n  const payment = await paymentForWedding(weddingId, id)\n  if (!payment) return NextResponse.json({ success:false, error:'Payment not found.' }, { status:404 })\n  const rows = await db.$queryRaw<Array<{ id:string; sourceKind:string; contributionId:string|null; budgetItemId:string|null; amount:string; currency:string }>>`\n    SELECT id, source_kind AS \"sourceKind\", contribution_id AS \"contributionId\", budget_item_id AS \"budgetItemId\", amount::text AS amount, currency\n      FROM wewed_contributions.payment_funding_allocations\n     WHERE wedding_id=${weddingId} AND payment_id=${id}\n     ORDER BY created_at, id\n  `\n  const classified = rows.filter((row)=>row.sourceKind !== 'LEGACY_UNATTRIBUTED').reduce((sum,row)=>sum+Number(row.amount),0)\n  return NextResponse.json({ success:true, data:{ id:payment.id, amount:Number(payment.amount), currency:payment.currency, paidAt:payment.paidAt?.toISOString() ?? null, reference:payment.reference, vendor:payment.serviceEngagement.vendor, serviceEngagementId:payment.serviceEngagementId, budgetItems:payment.serviceEngagement.budgetItems, funding:rows.map((row)=>({...row,amount:Number(row.amount)})), unattributed:Math.max(0,Number(payment.amount)-classified) } })\n}\n\nexport async function POST(request:NextRequest, context:RouteContext) {\n  const access = await requireWeddingPermission(request, 'budget.edit')\n  if (access.error) return access.error\n  const { id } = await context.params\n  const weddingId = access.context.weddingId\n  const actorId = access.context.session.userId\n  const body = (await request.json()) as Record<string,unknown>\n  const sourceKind = String(body.sourceKind ?? '')\n  const amount = finiteNonNegative(body.amount)\n  if (!['COUPLE','CONTRIBUTION','OTHER'].includes(sourceKind) || !amount || amount <= 0) return NextResponse.json({ success:false, error:'Choose a funding source and positive amount.' }, { status:400 })\n  const contributionIdValue = sourceKind === 'CONTRIBUTION' ? String(body.contributionId ?? '').trim() : ''\n  if (sourceKind === 'CONTRIBUTION' && !contributionIdValue) return NextResponse.json({ success:false, error:'Choose the contribution that funded this payment.' }, { status:400 })\n  const requestedBudgetItemId = String(body.budgetItemId ?? '').trim() || null\n  try {\n    await db.$transaction(async (tx) => {\n      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment-funding:${id}`}))`\n      const payment = await tx.engagementPayment.findFirst({ where:{ id, serviceEngagement:{ weddingId } }, include:{ serviceEngagement:{ select:{ id:true, currency:true, budgetItems:{ select:{ id:true, currency:true } } } } } })\n      if (!payment) throw new Error('PAYMENT_NOT_FOUND')\n      if (payment.currency !== payment.serviceEngagement.currency) throw new Error('PAYMENT_ENGAGEMENT_CURRENCY')\n      let budgetItemId:string|null = null\n      if (requestedBudgetItemId) {\n        const budget = payment.serviceEngagement.budgetItems.find((item)=>item.id===requestedBudgetItemId)\n        if (!budget) throw new Error('BUDGET_NOT_FOUND')\n        if (budget.currency !== payment.currency) throw new Error('CURRENCY_MISMATCH')\n        budgetItemId = budget.id\n      }\n      const classifiedRows = await tx.$queryRaw<Array<{ total:string }>>`\n        SELECT COALESCE(SUM(amount),0)::text AS total FROM wewed_contributions.payment_funding_allocations\n         WHERE wedding_id=${weddingId} AND payment_id=${id} AND currency=${payment.currency} AND source_kind <> 'LEGACY_UNATTRIBUTED'\n      `\n      const classified = Number(classifiedRows[0]?.total ?? 0)\n      if (classified + amount > Number(payment.amount) + 0.0001) throw new Error('FUNDING_EXCEEDS_PAYMENT')\n      if (sourceKind === 'CONTRIBUTION') {\n        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`contribution-funding:${contributionIdValue}`}))`\n        const contribution = await getContribution(weddingId, contributionIdValue, tx)\n        if (!contribution) throw new Error('CONTRIBUTION_NOT_FOUND')\n        if (contribution.currency !== payment.currency) throw new Error('CURRENCY_MISMATCH')\n        if (!['CASH_TO_COUPLE','HONEYMOON_GIFT'].includes(contribution.type) || contribution.fulfillmentState !== 'RECEIVED') throw new Error('CONTRIBUTION_NOT_AVAILABLE_CASH')\n        const allocated = await contributionAllocatedCash(weddingId, contributionIdValue, tx)\n        const available = contributionAvailableAmount({ type:contribution.type, amount:contribution.amount, fulfillmentState:contribution.fulfillmentState, allocatedAmount:allocated })\n        if (amount > available + 0.0001) throw new Error('CONTRIBUTION_INSUFFICIENT_AVAILABLE')\n        if (budgetItemId) {\n          await tx.$executeRaw`INSERT INTO wewed_contributions.contribution_allocations (id,wedding_id,contribution_id,budget_item_id,amount,currency,allocation_kind,note,created_by_id) VALUES (${contributionId()},${weddingId},${contributionIdValue},${budgetItemId},${amount},${payment.currency},'CASH','Reserved for payment funding allocation',${actorId})`\n        }\n      }\n      const legacyRows = await tx.$queryRaw<Array<{ id:string; amount:string }>>`SELECT id,amount::text AS amount FROM wewed_contributions.payment_funding_allocations WHERE wedding_id=${weddingId} AND payment_id=${id} AND currency=${payment.currency} AND source_kind='LEGACY_UNATTRIBUTED' ORDER BY created_at,id FOR UPDATE`\n      let remaining = amount\n      for (const row of legacyRows) {\n        if (remaining <= 0) break\n        const legacyAmount = Number(row.amount)\n        if (remaining + 0.0001 >= legacyAmount) { await tx.$executeRaw`DELETE FROM wewed_contributions.payment_funding_allocations WHERE id=${row.id}`; remaining -= legacyAmount }\n        else { await tx.$executeRaw`UPDATE wewed_contributions.payment_funding_allocations SET amount=amount-${remaining},updated_at=NOW() WHERE id=${row.id}`; remaining=0 }\n      }\n      await tx.$executeRaw`INSERT INTO wewed_contributions.payment_funding_allocations (id,wedding_id,payment_id,budget_item_id,contribution_id,source_kind,amount,currency,note,created_by_id,reconciled_at) VALUES (${contributionId()},${weddingId},${id},${budgetItemId},${sourceKind==='CONTRIBUTION'?contributionIdValue:null},${sourceKind},${amount},${payment.currency},${String(body.note ?? '').trim() || null},${actorId},NOW())`\n      await tx.auditEvent.create({ data:{ weddingId, eventType:'payment.funding_attributed', actorType:'user', actorId, targetType:'EngagementPayment', targetId:id, payload:JSON.stringify({ sourceKind, contributionId:sourceKind==='CONTRIBUTION'?contributionIdValue:null, budgetItemId, amount, currency:payment.currency }), severity:'info' } })\n    })\n    return NextResponse.json({ success:true })\n  } catch (error) {\n    const code = error instanceof Error ? error.message : ''\n    const known:Record<string,{status:number;error:string}> = { PAYMENT_NOT_FOUND:{status:404,error:'Payment not found.'}, BUDGET_NOT_FOUND:{status:404,error:'Choose a Budget item linked to this service engagement.'}, PAYMENT_ENGAGEMENT_CURRENCY:{status:409,error:'Payment and service engagement currencies do not match.'}, FUNDING_EXCEEDS_PAYMENT:{status:409,error:'Funding allocations cannot exceed the payment amount.'}, CONTRIBUTION_NOT_FOUND:{status:404,error:'Contribution not found.'}, CURRENCY_MISMATCH:{status:400,error:'Funding records must use the same currency.'}, CONTRIBUTION_NOT_AVAILABLE_CASH:{status:409,error:'Choose received contribution cash; promises and in-kind support cannot fund a cash payment.'}, CONTRIBUTION_INSUFFICIENT_AVAILABLE:{status:409,error:'That contribution does not have enough uncommitted cash remaining.'} }\n    if (known[code]) return NextResponse.json({ success:false, error:known[code].error }, { status:known[code].status })\n    console.error('[PAYMENT FUNDING POST] error', error)\n    return NextResponse.json({ success:false, error:'Could not save payment funding.' }, { status:500 })\n  }\n}\n""",
)

# Contributions workspace receives real EngagementPayment options for payment-level mixed funding.
contributions_route = 'src/app/api/planner/contributions/route.ts'
replace_once(
    contributions_route,
    "db.serviceEngagement.findMany({ where: { weddingId }, select: { id: true, serviceCategory: true, serviceDescription: true, currency: true, vendor: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } }),",
    "db.serviceEngagement.findMany({ where: { weddingId }, select: { id: true, serviceCategory: true, serviceDescription: true, currency: true, vendor: { select: { id: true, name: true } }, payments: { select: { id:true, amount:true, currency:true, paidAt:true, reference:true }, orderBy:{ paidAt:'desc' } } }, orderBy: { createdAt: 'desc' } }),",
)

ui = 'src/components/wedding/planner/planner-contributions-workspace.tsx'
replace_once(
    ui,
    "interface EngagementOption { id: string; serviceCategory: string; serviceDescription: string | null; currency: string; vendor: { id: string; name: string } }",
    "interface EngagementOption { id: string; serviceCategory: string; serviceDescription: string | null; currency: string; vendor: { id: string; name: string }; payments:Array<{id:string;amount:number;currency:string;paidAt:string|null;reference:string|null}> }",
)
replace_once(
    ui,
    "interface EvidenceItem { id:string; vaultObjectId:string; displayName:string; mimeType:string; byteSize:number; storageState:string; scanState:string; createdAt:string }",
    "interface EvidenceItem { id:string; vaultObjectId:string; displayName:string; mimeType:string; byteSize:number; storageState:string; scanState:string; createdAt:string }\ninterface PaymentFundingView { id:string; amount:number; currency:string; paidAt:string|null; reference:string|null; vendor:{id:string;name:string}; serviceEngagementId:string; budgetItems:Array<{id:string;description:string;currency:string}>; funding:Array<{id:string;sourceKind:string;contributionId:string|null;budgetItemId:string|null;amount:number;currency:string}>; unattributed:number }",
)
replace_once(
    ui,
    "  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)\n",
    """  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [paymentFundingView, setPaymentFundingView] = useState<PaymentFundingView | null>(null)
  const [paymentFundingForm, setPaymentFundingForm] = useState({ sourceKind:'COUPLE', amount:'', contributionId:'', budgetItemId:'' })
""",
)
replace_once(
    ui,
    "  async function createNotebookNote() {",
    """  async function loadPaymentFunding(paymentId:string) {
    const response = await fetch(`/api/planner/payments/${paymentId}/funding`, { cache:'no-store' })
    const body = await response.json()
    if (!response.ok || body.success === false) { toast({ title:'Could not load payment funding', description:body.error, variant:'destructive' }); return }
    setPaymentFundingView(body.data)
    setPaymentFundingForm({ sourceKind:'COUPLE', amount:String(body.data.unattributed || ''), contributionId:'', budgetItemId:body.data.budgetItems?.[0]?.id ?? '' })
  }

  async function savePaymentFunding() {
    if (!paymentFundingView || !canEdit) return
    const amount = Number(paymentFundingForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) { toast({ title:'Enter a positive funding amount', variant:'destructive' }); return }
    const success = await mutate(`/api/planner/payments/${paymentFundingView.id}/funding`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ sourceKind:paymentFundingForm.sourceKind, amount, contributionId:paymentFundingForm.sourceKind==='CONTRIBUTION'?paymentFundingForm.contributionId:null, budgetItemId:paymentFundingForm.budgetItemId || null }) })
    if (success) await loadPaymentFunding(paymentFundingView.id)
  }

  async function createNotebookNote() {""",
)
# Add payment-level mixed funding panel before legacy Budget reconciliation.
replace_once(
    ui,
    "      {funding.some((item) => item.unattributed > 0) && <Panel className=\"p-4\">",
    """      {(workspace?.options.engagements ?? []).some((engagement) => engagement.payments?.length) && <Panel className="p-4"><div className="flex items-start gap-3"><CircleDollarSign className="mt-0.5 size-5 text-gold"/><div><h2 className="font-serif text-xl">Payment funding</h2><p className="mt-1 text-xs leading-5 text-champagne/50">A real vendor payment can be split between couple funds and received contribution cash. The payment amount stays unchanged; these rows only explain who funded it.</p></div></div><div className="mt-4 grid gap-2 lg:grid-cols-2">{workspace!.options.engagements.flatMap((engagement)=>engagement.payments.map((payment)=><button type="button" key={payment.id} onClick={()=>void loadPaymentFunding(payment.id)} className="rounded-xl border border-gold/12 p-3 text-left hover:border-gold/30"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{engagement.vendor.name}</p><p className="text-xs text-champagne/45">{engagement.serviceCategory} · {payment.reference || 'Payment record'}</p></div><span className="font-serif text-gold">{money(Number(payment.amount),payment.currency)}</span></div></button>))}</div>{paymentFundingView && <div className="mt-4 rounded-xl border border-gold/20 bg-gold/[0.035] p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{paymentFundingView.vendor.name} · {money(paymentFundingView.amount,paymentFundingView.currency)}</p><p className="text-xs text-champagne/45">Unattributed: {money(paymentFundingView.unattributed,paymentFundingView.currency)}</p></div><Button size="sm" variant="ghost" onClick={()=>setPaymentFundingView(null)}>Close</Button></div><div className="mt-3 space-y-1">{paymentFundingView.funding.filter((row)=>row.sourceKind!=='LEGACY_UNATTRIBUTED').map((row)=><div key={row.id} className="flex justify-between text-xs text-champagne/60"><span>{human(row.sourceKind)}</span><span>{money(row.amount,row.currency)}</span></div>)}</div>{canEdit && paymentFundingView.unattributed > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-4"><select value={paymentFundingForm.sourceKind} onChange={(e)=>setPaymentFundingForm((c)=>({...c,sourceKind:e.target.value,contributionId:''}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-2 text-xs"><option value="COUPLE">Couple funds</option><option value="CONTRIBUTION">Contribution cash</option><option value="OTHER">Other known source</option></select><Input inputMode="decimal" value={paymentFundingForm.amount} onChange={(e)=>setPaymentFundingForm((c)=>({...c,amount:e.target.value}))} placeholder="Amount" className="border-gold/20 bg-espresso/70"/>{paymentFundingForm.sourceKind==='CONTRIBUTION' ? <select value={paymentFundingForm.contributionId} onChange={(e)=>setPaymentFundingForm((c)=>({...c,contributionId:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-2 text-xs"><option value="">Choose received contribution</option>{workspace!.data.filter((item)=>['CASH_TO_COUPLE','HONEYMOON_GIFT'].includes(item.type) && item.fulfillmentState==='RECEIVED' && item.currency===paymentFundingView.currency && item.availableAmount>0).map((item)=><option key={item.id} value={item.id}>{item.contributor.displayName} — {item.title}</option>)}</select> : <select value={paymentFundingForm.budgetItemId} onChange={(e)=>setPaymentFundingForm((c)=>({...c,budgetItemId:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-2 text-xs"><option value="">No Budget item</option>{paymentFundingView.budgetItems.map((item)=><option key={item.id} value={item.id}>{item.description}</option>)}</select>}{paymentFundingForm.sourceKind==='CONTRIBUTION' && <select value={paymentFundingForm.budgetItemId} onChange={(e)=>setPaymentFundingForm((c)=>({...c,budgetItemId:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-2 text-xs"><option value="">No Budget item</option>{paymentFundingView.budgetItems.map((item)=><option key={item.id} value={item.id}>{item.description}</option>)}</select>}<Button disabled={saving || (paymentFundingForm.sourceKind==='CONTRIBUTION' && !paymentFundingForm.contributionId)} onClick={()=>void savePaymentFunding()} className="bg-gold text-espresso sm:col-span-4">Add funding split</Button></div>}</div>}</Panel>}

      {funding.some((item) => item.unattributed > 0) && <Panel className="p-4">""",
)

# Phase contracts document migration truth and payment-level mixed funding.
contract = 'src/lib/contributions-source-contract.test.ts'
insert = """
  test('legacy paid facts are backfilled as replaceable unattributed funding without fabricated payments', () => {
    const migration = read('prisma/migrations/20260819190000_contributions_legacy_funding_backfill/migration.sql')
    const route = read('src/app/api/planner/budget/funding/route.ts')
    expect(migration).toContain("'LEGACY_UNATTRIBUTED'")
    expect(migration).toContain('Budget paidAmount existed without a durable payment/source record')
    expect(migration).not.toContain('INSERT INTO public."EngagementPayment"')
    expect(route).toContain("sourceKind !== 'LEGACY_UNATTRIBUTED'")
    expect(route).toContain("source_kind = 'LEGACY_UNATTRIBUTED'")
  })

  test('mixed funding is allocated against the real EngagementPayment instead of creating a second payment', () => {
    const paymentFunding = read('src/app/api/planner/payments/[id]/funding/route.ts')
    const ui = read('src/components/wedding/planner/planner-contributions-workspace.tsx')
    expect(paymentFunding).toContain('payment_id=${id}')
    expect(paymentFunding).toContain('FUNDING_EXCEEDS_PAYMENT')
    expect(paymentFunding).toContain('payment.funding_attributed')
    expect(paymentFunding).not.toContain('engagementPayment.create')
    expect(ui).toContain('Payment funding')
    expect(ui).toContain('Add funding split')
  })
"""
text = read(contract)
needle = "\n  test('public campaign endpoint never selects contributor identity', () => {"
if text.count(needle) != 1:
    raise SystemExit('financial truth contract insertion point not unique')
write(contract, text.replace(needle, insert + needle, 1))

print('Contributions Phase 1 legacy truth and Phase 3 payment funding remediation applied.')
