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


# Vendor/Service Engagement funding context: read-only operational summary from the same contribution/payment facts.
write(
    'src/app/api/planner/vendors/funding-summary/route.ts',
    """import { NextRequest, NextResponse } from 'next/server'\nimport { db } from '@/lib/db'\nimport { requireWeddingPermission } from '@/lib/wedding-access'\n\nexport async function GET(request:NextRequest) {\n  const access = await requireWeddingPermission(request, 'budget.view')\n  if (access.error) return access.error\n  const weddingId = access.context.weddingId\n  try {\n    const [payments,funding,contributions] = await Promise.all([\n      db.engagementPayment.findMany({ where:{ serviceEngagement:{ weddingId } }, select:{ id:true, amount:true, currency:true, serviceEngagement:{ select:{ id:true, vendorId:true } } } }),\n      db.$queryRaw<Array<{ paymentId:string|null; sourceKind:string; amount:string; currency:string; vendorId:string|null }>>`\n        SELECT f.payment_id AS \"paymentId\", f.source_kind AS \"sourceKind\", f.amount::text AS amount, f.currency, se."vendorId" AS \"vendorId\"\n          FROM wewed_contributions.payment_funding_allocations f\n          LEFT JOIN public."EngagementPayment" p ON p.id=f.payment_id\n          LEFT JOIN public."ServiceEngagement" se ON se.id=p."serviceEngagementId"\n         WHERE f.wedding_id=${weddingId} AND f.payment_id IS NOT NULL\n      `,\n      db.$queryRaw<Array<{ vendorId:string|null; serviceEngagementId:string|null; type:string; amount:string|null; currency:string; estimatedValue:string|null; estimatedValueCurrency:string|null; commitmentState:string; fulfillmentState:string }>>`\n        SELECT c.vendor_id AS \"vendorId\", c.service_engagement_id AS \"serviceEngagementId\", c.type, c.amount::text AS amount, c.currency,\n               c.estimated_value::text AS \"estimatedValue\", c.estimated_value_currency AS \"estimatedValueCurrency\",\n               c.commitment_state AS \"commitmentState\", c.fulfillment_state AS \"fulfillmentState\"\n          FROM wewed_contributions.wedding_contributions c\n         WHERE c.wedding_id=${weddingId} AND (c.vendor_id IS NOT NULL OR c.service_engagement_id IS NOT NULL)\n      `,\n    ])\n    const engagementVendor = new Map(payments.map((payment)=>[payment.serviceEngagement.id,payment.serviceEngagement.vendorId]))\n    const vendorIds = new Set<string>()\n    payments.forEach((payment)=>vendorIds.add(payment.serviceEngagement.vendorId))\n    contributions.forEach((item)=>{ const vendorId=item.vendorId ?? (item.serviceEngagementId ? engagementVendor.get(item.serviceEngagementId) : null); if(vendorId) vendorIds.add(vendorId) })\n    const data = Array.from(vendorIds).map((vendorId)=>{\n      const vendorPayments = payments.filter((payment)=>payment.serviceEngagement.vendorId===vendorId)\n      const paymentBuckets = new Map<string,{currency:string;paid:number;contributor:number;couple:number;other:number;unattributed:number}>()\n      for (const payment of vendorPayments) {\n        const bucket = paymentBuckets.get(payment.currency) ?? { currency:payment.currency, paid:0, contributor:0, couple:0, other:0, unattributed:0 }\n        const amount = Number(payment.amount); bucket.paid += amount\n        const rows = funding.filter((row)=>row.paymentId===payment.id && row.currency===payment.currency)\n        const classified = rows.filter((row)=>row.sourceKind!=='LEGACY_UNATTRIBUTED').reduce((sum,row)=>sum+Number(row.amount),0)\n        bucket.contributor += rows.filter((row)=>row.sourceKind==='CONTRIBUTION').reduce((sum,row)=>sum+Number(row.amount),0)\n        bucket.couple += rows.filter((row)=>row.sourceKind==='COUPLE').reduce((sum,row)=>sum+Number(row.amount),0)\n        bucket.other += rows.filter((row)=>row.sourceKind==='OTHER').reduce((sum,row)=>sum+Number(row.amount),0)\n        bucket.unattributed += Math.max(0,amount-classified)\n        paymentBuckets.set(payment.currency,bucket)\n      }\n      const vendorContributions = contributions.filter((item)=>item.vendorId===vendorId || (item.serviceEngagementId && engagementVendor.get(item.serviceEngagementId)===vendorId))\n      const pledgedByCurrency:Record<string,number> = {}\n      const inKindByCurrency:Record<string,number> = {}\n      for (const item of vendorContributions) {\n        if (item.type==='DIRECT_VENDOR_PAYMENT' && item.commitmentState==='PLEDGED' && item.fulfillmentState==='PENDING' && item.amount) pledgedByCurrency[item.currency]=(pledgedByCurrency[item.currency]??0)+Number(item.amount)\n        if (['GOODS_IN_KIND','SERVICE_IN_KIND','TIME_LABOUR','DISCOUNT_SPONSORSHIP'].includes(item.type) && ['DELIVERED','COMPLETED'].includes(item.fulfillmentState) && item.estimatedValue) { const currency=item.estimatedValueCurrency ?? item.currency; inKindByCurrency[currency]=(inKindByCurrency[currency]??0)+Number(item.estimatedValue) }\n      }\n      return { vendorId, paymentFunding:Array.from(paymentBuckets.values()), pledgedDirect:Object.entries(pledgedByCurrency).map(([currency,amount])=>({currency,amount})), inKind:Object.entries(inKindByCurrency).map(([currency,amount])=>({currency,amount})) }\n    })\n    return NextResponse.json({ success:true, data })\n  } catch (error) {\n    console.error('[VENDOR CONTRIBUTION FUNDING SUMMARY] error', error)\n    return NextResponse.json({ success:false, error:'Could not load vendor funding context.' }, { status:500 })\n  }\n}\n""",
)

# Vendor worksheet shows source-of-funds context without duplicating payment records.
vendor_ui = 'src/components/wedding/planner/modules/planner-vendors-module.tsx'
replace_once(
    vendor_ui,
    "export interface VendorUpdate {",
    """interface VendorFundingSummary {
  vendorId: string
  paymentFunding: Array<{ currency:string; paid:number; contributor:number; couple:number; other:number; unattributed:number }>
  pledgedDirect: Array<{ currency:string; amount:number }>
  inKind: Array<{ currency:string; amount:number }>
}

export interface VendorUpdate {""",
)
replace_once(
    vendor_ui,
    "  const [budgetItems, setBudgetItems] = useState<EngagementBudgetItem[]>([])\n",
    "  const [budgetItems, setBudgetItems] = useState<EngagementBudgetItem[]>([])\n  const [fundingSummary, setFundingSummary] = useState<VendorFundingSummary[]>([])\n",
)
replace_once(
    vendor_ui,
    "      const [engagementPayload, managedPayload, rescuePayload, budgetPayload] = await Promise.all([",
    "      const [engagementPayload, managedPayload, rescuePayload, budgetPayload, fundingPayload] = await Promise.all([",
)
replace_once(
    vendor_ui,
    "        governanceJson<{ data: EngagementBudgetItem[] }>('/api/planner/budget'),\n      ])",
    "        governanceJson<{ data: EngagementBudgetItem[] }>('/api/planner/budget'),\n        governanceJson<{ data: VendorFundingSummary[] }>('/api/planner/vendors/funding-summary'),\n      ])",
)
replace_once(
    vendor_ui,
    "      setBudgetItems(budgetPayload.data ?? [])\n      setGovernanceError(null)",
    "      setBudgetItems(budgetPayload.data ?? [])\n      setFundingSummary(fundingPayload.data ?? [])\n      setGovernanceError(null)",
)
replace_once(
    vendor_ui,
    "          const deletionProtected = vendorEngagements.length > 0 || Boolean(managedEngagement)\n          return (",
    "          const deletionProtected = vendorEngagements.length > 0 || Boolean(managedEngagement)\n          const vendorFunding = fundingSummary.find((item) => item.vendorId === vendor.id)\n          return (",
)
replace_once(
    vendor_ui,
    "              {vendor.notes && <p className=\"mt-2 rounded-lg border border-gold/10 bg-espresso/40 px-3 py-2 font-sans text-xs text-champagne/55\">{vendor.notes}</p>}\n\n              <PlannerVendorDealRoom",
    """              {vendor.notes && <p className="mt-2 rounded-lg border border-gold/10 bg-espresso/40 px-3 py-2 font-sans text-xs text-champagne/55">{vendor.notes}</p>}
              {vendorFunding && (vendorFunding.paymentFunding.length > 0 || vendorFunding.pledgedDirect.length > 0 || vendorFunding.inKind.length > 0) && <div className="mt-3 rounded-xl border border-gold/12 bg-gold/[0.035] p-3" data-vendor-contribution-funding><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">Funding context</p><div className="mt-2 space-y-1 text-xs text-champagne/60">{vendorFunding.paymentFunding.map((row)=><p key={row.currency}>{row.currency}: paid {row.paid.toLocaleString()} · contributor-funded {row.contributor.toLocaleString()} · couple-funded {row.couple.toLocaleString()} · source not recorded {row.unattributed.toLocaleString()}</p>)}{vendorFunding.pledgedDirect.map((row)=><p key={`pledge-${row.currency}`} className="text-gold/80">Promised direct support: {row.currency} {row.amount.toLocaleString()} — not paid yet</p>)}{vendorFunding.inKind.map((row)=><p key={`kind-${row.currency}`}>Delivered in-kind value: {row.currency} {row.amount.toLocaleString()} est.</p>)}</div></div>}

              <PlannerVendorDealRoom""",
)

# Actionable lifecycle views and expected-date capture.
contrib_ui = 'src/components/wedding/planner/planner-contributions-workspace.tsx'
replace_once(
    contrib_ui,
    "  id: string; type: ContributionType; title: string; description: string | null; amount: number | null; currency: string; estimatedValue: number | null; estimatedValueCurrency: string | null; quantity: number | null; unit: string | null; route: string; commitmentState: string; fulfillmentState: string; verificationState: string; thankYouState: string; notes: string | null; contributor:",
    "  id: string; type: ContributionType; title: string; description: string | null; amount: number | null; currency: string; estimatedValue: number | null; estimatedValueCurrency: string | null; quantity: number | null; unit: string | null; route: string; commitmentState: string; fulfillmentState: string; verificationState: string; thankYouState: string; pledgedAt?: string | null; expectedAt?: string | null; fulfilledAt?: string | null; notes: string | null; contributor:",
)
replace_once(
    contrib_ui,
    "publicRecognition: false, relationship: '', guestId: '', type:",
    "publicRecognition: false, relationship: '', guestId: '', expectedAt: '', type:",
)
replace_once(
    contrib_ui,
    "      if (filter === 'thank' && !['TO_THANK','PREPARED'].includes(item.thankYouState)) return false\n",
    """      if (filter === 'thank' && !['TO_THANK','PREPARED'].includes(item.thankYouState)) return false
      if (filter === 'overdue' && !(item.expectedAt && new Date(item.expectedAt).getTime() < Date.now() && ['PENDING','PARTIALLY_RECEIVED'].includes(item.fulfillmentState))) return false
      if (filter === 'unverified' && !(item.verificationState === 'UNVERIFIED' && ['RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED'].includes(item.fulfillmentState))) return false
""",
)
replace_once(
    contrib_ui,
    "commitmentState: form.status === 'PROMISED' ? 'PLEDGED' : 'NOT_APPLICABLE', fulfillmentState,",
    "commitmentState: form.status === 'PROMISED' ? 'PLEDGED' : 'NOT_APPLICABLE', fulfillmentState, expectedAt: form.expectedAt || null,",
)
replace_once(
    contrib_ui,
    "<option value=\"thank\">Needs a thank-you</option></select>",
    "<option value=\"overdue\">Promised / overdue</option><option value=\"unverified\">Received but unverified</option><option value=\"thank\">Needs a thank-you</option></select>",
)
replace_once(
    contrib_ui,
    "<select value={form.status} onChange={(e) => setForm((c) => ({...c,status:e.target.value}))} className=\"h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm\"><option value=\"PROMISED\">Promised — not received yet</option><option value=\"RECEIVED\">Received / paid / delivered</option></select>",
    "<select value={form.status} onChange={(e) => setForm((c) => ({...c,status:e.target.value}))} className=\"h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm\"><option value=\"PROMISED\">Promised — not received yet</option><option value=\"RECEIVED\">Received / paid / delivered</option></select>{form.status === 'PROMISED' && <Input type=\"date\" value={form.expectedAt} onChange={(e)=>setForm((c)=>({...c,expectedAt:e.target.value}))} className=\"border-gold/20 bg-espresso/70\" aria-label=\"Expected contribution date\" />}",
)

# Overview action counts: overdue and unverified are visible without opening the ledger.
summary = 'src/app/api/planner/contributions/summary/route.ts'
replace_once(
    summary,
    "db.$queryRaw<Array<{ contributors: bigint; pledged: bigint; toThank: bigint }>>`",
    "db.$queryRaw<Array<{ contributors: bigint; pledged: bigint; overdue: bigint; unverified: bigint; toThank: bigint }>>`",
)
replace_once(
    summary,
    "              AND fulfillment_state NOT IN ('RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED')) AS pledged,\n          (SELECT COUNT(*)",
    """              AND fulfillment_state NOT IN ('RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED')) AS pledged,
          (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions
            WHERE wedding_id = ${weddingId} AND expected_at < NOW() AND fulfillment_state IN ('PENDING','PARTIALLY_RECEIVED')) AS overdue,
          (SELECT COUNT(*) FROM wewed_contributions.wedding_contributions
            WHERE wedding_id = ${weddingId} AND verification_state = 'UNVERIFIED'
              AND fulfillment_state IN ('RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED')) AS unverified,
          (SELECT COUNT(*)""",
)
replace_once(
    summary,
    "        pledged: Number(counts[0]?.pledged ?? 0),\n        toThank:",
    "        pledged: Number(counts[0]?.pledged ?? 0),\n        overdue: Number(counts[0]?.overdue ?? 0),\n        unverified: Number(counts[0]?.unverified ?? 0),\n        toThank:",
)
workspace = 'src/components/wedding/planner-workspace.tsx'
replace_once(
    workspace,
    "  toThank: number\n}",
    "  overdue: number\n  unverified: number\n  toThank: number\n}",
)
replace_once(
    workspace,
    "useState<ContributionOverviewCounts>({ contributors: 0, pledged: 0, toThank: 0 })",
    "useState<ContributionOverviewCounts>({ contributors: 0, pledged: 0, overdue: 0, unverified: 0, toThank: 0 })",
)
replace_once(
    workspace,
    "setContributionCounts(contributionsResult.value.counts ?? { contributors: 0, pledged: 0, toThank: 0 })",
    "setContributionCounts(contributionsResult.value.counts ?? { contributors: 0, pledged: 0, overdue: 0, unverified: 0, toThank: 0 })",
)
replace_once(
    workspace,
    "{contributionCounts.contributors} contributors · {contributionCounts.pledged} pledged · {contributionCounts.toThank} thank-you{contributionCounts.toThank === 1 ? '' : 's'} pending",
    "{contributionCounts.contributors} contributors · {contributionCounts.pledged} pledged · {contributionCounts.overdue} overdue · {contributionCounts.unverified} unverified · {contributionCounts.toThank} thank-you{contributionCounts.toThank === 1 ? '' : 's'} pending",
)

# Source contract proves Phase 4 is connected rather than ledger-only.
contract = 'src/lib/contributions-source-contract.test.ts'
insert = """
  test('Phase 4 exposes contribution funding from Vendors and actionable lifecycle views', () => {
    const vendor = read('src/components/wedding/planner/modules/planner-vendors-module.tsx')
    const vendorApi = read('src/app/api/planner/vendors/funding-summary/route.ts')
    const ui = read('src/components/wedding/planner/planner-contributions-workspace.tsx')
    const summary = read('src/app/api/planner/contributions/summary/route.ts')
    expect(vendor).toContain('Funding context')
    expect(vendorApi).toContain('sourceKind')
    expect(ui).toContain("value=\"overdue\"")
    expect(ui).toContain("value=\"unverified\"")
    expect(ui).toContain('Expected contribution date')
    expect(summary).toContain('expected_at < NOW()')
    expect(summary).toContain("verification_state = 'UNVERIFIED'")
  })
"""
text = read(contract)
needle = "\n  test('public campaign endpoint never selects contributor identity', () => {"
if text.count(needle) != 1:
    raise SystemExit('Phase 4 contract insertion point not unique')
write(contract, text.replace(needle, insert + needle, 1))

print('Contributions Phase 4 operational integration remediation applied.')
