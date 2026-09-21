from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 anchor, found {count}")
    return text.replace(old, new, 1)

# 1) Atomic direct-vendor installment creation.
route_path = Path('src/app/api/planner/contributions/route.ts')
route = route_path.read_text()
old = """    const commitmentState = String(body.commitmentState ?? 'NOT_APPLICABLE')
    const fulfillmentState = String(body.fulfillmentState ?? 'PENDING')
    const requestedVerificationState = String(body.verificationState ?? 'UNVERIFIED')
    const requestedThankYouState = String(body.thankYouState ?? (['RECEIVED', 'DELIVERED', 'PAID_DIRECT', 'COMPLETED'].includes(fulfillmentState) ? 'TO_THANK' : 'NOT_DUE'))
    if (!validContributionCommitmentState(commitmentState) || !validContributionFulfillmentState(fulfillmentState) || !validContributionVerificationState(requestedVerificationState) || !validContributionThankYouState(requestedThankYouState)) {
      return NextResponse.json({ success: false, error: 'Choose valid contribution lifecycle states.' }, { status: 400 })
    }
    const fulfilled = ['RECEIVED', 'DELIVERED', 'PAID_DIRECT', 'COMPLETED'].includes(fulfillmentState)
    const directPayment = type === 'DIRECT_VENDOR_PAYMENT'
    const inKind = ['GOODS_IN_KIND', 'SERVICE_IN_KIND', 'TIME_LABOUR', 'DISCOUNT_SPONSORSHIP'].includes(type)
"""
new = """    let commitmentState = String(body.commitmentState ?? 'NOT_APPLICABLE')
    let fulfillmentState = String(body.fulfillmentState ?? 'PENDING')
    const requestedVerificationState = String(body.verificationState ?? 'UNVERIFIED')
    let requestedThankYouState = String(body.thankYouState ?? (['RECEIVED', 'DELIVERED', 'PAID_DIRECT', 'COMPLETED'].includes(fulfillmentState) ? 'TO_THANK' : 'NOT_DUE'))
    const directPayment = type === 'DIRECT_VENDOR_PAYMENT'
    const inKind = ['GOODS_IN_KIND', 'SERVICE_IN_KIND', 'TIME_LABOUR', 'DISCOUNT_SPONSORSHIP'].includes(type)
    const directPaidNowProvided = directPayment && body.directPaidNow !== undefined && body.directPaidNow !== null && String(body.directPaidNow).trim() !== ''
    const directPaidNow = directPaidNowProvided ? finiteNonNegative(body.directPaidNow) : null
    if (directPaidNowProvided && directPaidNow === null) throw new Error('DIRECT_PAYMENT_AMOUNT_INVALID')
    if (directPaidNowProvided) {
      if (amount === null || amount <= 0) throw new Error('DIRECT_PAYMENT_PROMISE_REQUIRED')
      if ((directPaidNow ?? 0) > amount + 0.0001) throw new Error('DIRECT_PAYMENT_EXCEEDS_PROMISE')
      if ((directPaidNow ?? 0) <= 0) {
        commitmentState = 'PLEDGED'
        fulfillmentState = 'PENDING'
      } else if ((directPaidNow ?? 0) < amount - 0.0001) {
        commitmentState = 'PLEDGED'
        fulfillmentState = 'PARTIALLY_RECEIVED'
        if (body.thankYouState === undefined) requestedThankYouState = 'TO_THANK'
      } else {
        commitmentState = 'CONFIRMED'
        fulfillmentState = 'PAID_DIRECT'
        if (body.thankYouState === undefined) requestedThankYouState = 'TO_THANK'
      }
    }
    if (!validContributionCommitmentState(commitmentState) || !validContributionFulfillmentState(fulfillmentState) || !validContributionVerificationState(requestedVerificationState) || !validContributionThankYouState(requestedThankYouState)) {
      return NextResponse.json({ success: false, error: 'Choose valid contribution lifecycle states.' }, { status: 400 })
    }
    const fulfilled = ['RECEIVED', 'DELIVERED', 'PAID_DIRECT', 'COMPLETED'].includes(fulfillmentState)
"""
route = replace_once(route, old, new, 'direct lifecycle')
old = """      if (directPayment && fulfillmentState === 'PAID_DIRECT' && serviceEngagementId && amount && amount > 0) {
        const paymentReference = String(body.paymentReference ?? '').trim() || null
        const historicalPaidAlreadyRecorded = body.alreadyIncludedInBudgetPaid === true
        let payment
"""
new = """      if (directPayment && ['PAID_DIRECT', 'PARTIALLY_RECEIVED'].includes(fulfillmentState) && serviceEngagementId && amount && amount > 0) {
        const paymentAmount = directPaidNow ?? amount
        const paymentReference = String(body.paymentReference ?? '').trim() || null
        const historicalPaidAlreadyRecorded = body.alreadyIncludedInBudgetPaid === true
        let payment
"""
route = replace_once(route, old, new, 'direct payment block')
start = route.index("      if (directPayment && ['PAID_DIRECT', 'PARTIALLY_RECEIVED'].includes(fulfillmentState)")
end = route.index("\n\n      await tx.auditEvent.create", start)
block = route[start:end]
block = replace_once(block, "              amount,\n              ...(paymentReference", "              amount: paymentAmount,\n              ...(paymentReference", 'historical payment match amount')
block = replace_once(block, "              amount,\n              currency,\n              paidAt: fulfilledAt ?? now,", "              amount: paymentAmount,\n              currency,\n              paidAt: fulfilledAt ?? now,", 'historical payment create amount')
block = replace_once(block, "              amount,\n              currency,\n              paidAt: fulfilledAt ?? now,", "              amount: paymentAmount,\n              currency,\n              paidAt: fulfilledAt ?? now,", 'new payment create amount')
block = replace_once(block, "        if (existingFunding + amount > Number(payment.amount) + 0.0001)", "        if (existingFunding + paymentAmount > Number(payment.amount) + 0.0001)", 'funding ceiling')
block = replace_once(block, "${contributionIdValue}, 'CONTRIBUTION', ${amount}, ${currency}", "${contributionIdValue}, 'CONTRIBUTION', ${paymentAmount}, ${currency}", 'funding allocation amount')
block = replace_once(block, "data: { paidAmount: { increment: amount } }", "data: { paidAmount: { increment: paymentAmount } }", 'budget increment')
route = route[:start] + block + route[end:]
old = """      PAYMENT_ALREADY_ATTRIBUTED: 'That payment is already fully attributed to a funding source.',
"""
new = """      PAYMENT_ALREADY_ATTRIBUTED: 'That payment is already fully attributed to a funding source.',
      DIRECT_PAYMENT_AMOUNT_INVALID: 'Enter a valid amount actually paid to the vendor.',
      DIRECT_PAYMENT_PROMISE_REQUIRED: 'Enter the total amount the contributor promised before recording a vendor payment.',
      DIRECT_PAYMENT_EXCEEDS_PROMISE: 'The amount paid now cannot be more than the total amount promised.',
"""
route = replace_once(route, old, new, 'direct payment errors')
route_path.write_text(route)

# 2) Contributions UX: promised vs paid-now, visible installment state, canonical categories.
ui_path = Path('src/components/wedding/planner/planner-contributions-workspace.tsx')
ui = ui_path.read_text()
ui = replace_once(ui, "import { CONTRIBUTION_CAMPAIGN_TYPE_LABELS, CONTRIBUTION_TYPE_LABELS } from '@/lib/contributions'\n", "import { CONTRIBUTION_CAMPAIGN_TYPE_LABELS, CONTRIBUTION_TYPE_LABELS } from '@/lib/contributions'\nimport { PROVIDER_CATEGORIES } from '@/lib/provider-catalog'\n", 'provider catalog import')
ui = replace_once(ui, "campaignId: '', paymentReference: '', alreadyIncludedInBudgetPaid: false, notes: '' }", "campaignId: '', paymentReference: '', paidNow: '', alreadyIncludedInBudgetPaid: false, notes: '' }", 'paid now form state')
ui = replace_once(ui, "const [budgetQuick, setBudgetQuick] = useState({ description:'', category:'miscellaneous'", "const [budgetQuick, setBudgetQuick] = useState({ description:'', category:'other'", 'budget quick default')
anchor = "function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <section className={`rounded-2xl border border-gold/15 bg-champagne/[0.035] ${className}`}>{children}</section> }\n"
insert = anchor + "\nconst PLANNER_SERVICE_CATEGORIES = PROVIDER_CATEGORIES.map((category) => ({ value: category.value, label: category.label }))\nconst PLANNER_BUDGET_CATEGORIES = [...PLANNER_SERVICE_CATEGORIES, { value: 'roora', label: 'Roora / traditional ceremony' }]\nfunction providerCategoryLabel(value: string) { return PLANNER_SERVICE_CATEGORIES.find((category) => category.value === value)?.label ?? value.replaceAll('_',' ') }\n"
ui = replace_once(ui, anchor, insert, 'category helpers')
old = """    const fulfillmentState = form.status === 'PROMISED' ? 'PENDING' : direct ? 'PAID_DIRECT' : inKind ? 'DELIVERED' : 'RECEIVED'
    const success = await mutate('/api/planner/contributions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
"""
new = """    const directPaidNow = direct && form.paidNow.trim() ? Number(form.paidNow) : 0
    if (direct && (!Number.isFinite(directPaidNow) || directPaidNow < 0 || (form.amount && directPaidNow > Number(form.amount)))) {
      dependencyError('Amount paid now must be between 0 and the total amount promised.')
      return
    }
    const fulfillmentState = form.status === 'PROMISED' ? 'PENDING' : direct ? 'PAID_DIRECT' : inKind ? 'DELIVERED' : 'RECEIVED'
    const success = await mutate('/api/planner/contributions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
"""
ui = replace_once(ui, old, new, 'paid now validation')
ui = replace_once(ui, "campaignId: form.campaignId || null, paymentReference: form.paymentReference || null,\n      alreadyIncludedInBudgetPaid", "campaignId: form.campaignId || null, paymentReference: form.paymentReference || null, directPaidNow: direct ? directPaidNow : undefined,\n      alreadyIncludedInBudgetPaid", 'paid now payload')
old = """{['CASH_TO_COUPLE','DIRECT_VENDOR_PAYMENT','HONEYMOON_GIFT'].includes(form.type) ? <Input required inputMode=\"decimal\" value={form.amount} onChange={(e) => setForm((c) => ({...c,amount:e.target.value}))} placeholder=\"Amount\" className=\"border-gold/20 bg-espresso/70\" />"""
new = """{['CASH_TO_COUPLE','DIRECT_VENDOR_PAYMENT','HONEYMOON_GIFT'].includes(form.type) ? <Input required inputMode=\"decimal\" value={form.amount} onChange={(e) => setForm((c) => ({...c,amount:e.target.value}))} placeholder={form.type === 'DIRECT_VENDOR_PAYMENT' ? 'Total promised, e.g. 150' : 'Amount'} className=\"border-gold/20 bg-espresso/70\" />"""
ui = replace_once(ui, old, new, 'promised amount label')
old = """<select aria-label=\"New budget category\" value={budgetQuick.category} onChange={(e)=>setBudgetQuick((c)=>({...c,category:e.target.value}))} className=\"h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm\"><option value=\"venue\">Venue</option><option value=\"catering\">Catering</option><option value=\"attire\">Attire</option><option value=\"roora\">Roora</option><option value=\"decor\">Decor</option><option value=\"photo_video\">Photo / video</option><option value=\"music\">Music</option><option value=\"transport\">Transport</option><option value=\"stationery\">Stationery</option><option value=\"miscellaneous\">Other</option></select>"""
new = """<select aria-label=\"New budget category\" value={budgetQuick.category} onChange={(e)=>setBudgetQuick((c)=>({...c,category:e.target.value}))} className=\"h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm\">{PLANNER_BUDGET_CATEGORIES.map((category)=><option key={category.value} value={category.value}>{category.label}</option>)}</select>"""
ui = replace_once(ui, old, new, 'budget category select')
old = """{!vendorQuick.vendorId && <select aria-label=\"New vendor category\" value={vendorQuick.vendorCategory} onChange={(e)=>setVendorQuick((c)=>({...c,vendorCategory:e.target.value}))} className=\"h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm\"><option value=\"venue\">Venue</option><option value=\"caterer\">Caterer</option><option value=\"photographer\">Photographer</option><option value=\"videographer\">Videographer</option><option value=\"florist\">Florist</option><option value=\"dj\">DJ</option><option value=\"decor\">Decor</option><option value=\"transport\">Transport</option><option value=\"stationery\">Stationery</option><option value=\"other\">Other</option></select>}<Input value={vendorQuick.serviceCategory} onChange={(e)=>setVendorQuick((c)=>({...c,serviceCategory:e.target.value}))} placeholder=\"Service category, e.g. Bridal attire\" className=\"border-gold/20 bg-espresso/70\"/>"""
new = """{!vendorQuick.vendorId && <select aria-label=\"New vendor category\" value={vendorQuick.vendorCategory} onChange={(e)=>setVendorQuick((c)=>({...c,vendorCategory:e.target.value}))} className=\"h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm\">{PLANNER_SERVICE_CATEGORIES.map((category)=><option key={category.value} value={category.value}>{category.label}</option>)}</select>}<select aria-label=\"Service category\" value={vendorQuick.serviceCategory} onChange={(e)=>setVendorQuick((c)=>({...c,serviceCategory:e.target.value}))} className=\"h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm\"><option value=\"\">Choose service category</option>{PLANNER_SERVICE_CATEGORIES.map((category)=><option key={category.value} value={category.label}>{category.label}</option>)}<option value=\"Roora / traditional ceremony\">Roora / traditional ceremony</option></select>"""
ui = replace_once(ui, old, new, 'vendor/service category selects')
ui = replace_once(ui, "serviceCategory: current.serviceCategory || budget?.category || '',", "serviceCategory: current.serviceCategory || (budget ? providerCategoryLabel(budget.category) : ''),", 'service category default')
old = """<fieldset><legend className=\"font-medium\">4. What is the current state?</legend><div className=\"mt-2 grid gap-2 sm:grid-cols-2\"><select value={form.status} onChange={(e) => setForm((c) => ({...c,status:e.target.value}))} className=\"h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm\"><option value=\"PROMISED\">Promised — not received yet</option><option value=\"RECEIVED\">Received / paid / delivered</option></select>{form.status === 'PROMISED' && <Input type=\"date\" value={form.expectedAt} onChange={(e)=>setForm((c)=>({...c,expectedAt:e.target.value}))} className=\"border-gold/20 bg-espresso/70\" aria-label=\"Expected contribution date\" />}{form.type === 'DIRECT_VENDOR_PAYMENT' && <Input value={form.paymentReference} onChange={(e) => setForm((c) => ({...c,paymentReference:e.target.value}))} placeholder=\"Payment reference (optional)\" className=\"border-gold/20 bg-espresso/70\" />}{form.type === 'DIRECT_VENDOR_PAYMENT' && form.budgetItemId && <label className=\"flex items-start gap-2 rounded-lg border border-gold/15 p-3 text-xs text-champagne/60 sm:col-span-2\"><Checkbox checked={form.alreadyIncludedInBudgetPaid} onCheckedChange={(checked) => setForm((c) => ({...c,alreadyIncludedInBudgetPaid:checked===true}))} /><span><strong className=\"text-champagne/80\">This payment is already included in the Budget “Paid” amount.</strong><br/>Check this for historical payments so Wewed records who funded it without adding the amount again.</span></label>}<Textarea value={form.notes} onChange={(e) => setForm((c) => ({...c,notes:e.target.value}))} placeholder=\"Optional context\" className=\"border-gold/20 bg-espresso/70 sm:col-span-2\" /></div></fieldset>"""
new = """<fieldset><legend className=\"font-medium\">4. What is the current state?</legend>{form.type === 'DIRECT_VENDOR_PAYMENT' ? <div className=\"mt-2 grid gap-2 sm:grid-cols-2\"><div><Label>Amount actually paid to vendor so far</Label><Input inputMode=\"decimal\" value={form.paidNow} onChange={(e)=>setForm((c)=>({...c,paidNow:e.target.value}))} placeholder=\"0 if nothing has been paid\" className=\"mt-1 border-gold/20 bg-espresso/70\" /></div><div><Label>Remaining payment due</Label><Input type=\"date\" value={form.expectedAt} onChange={(e)=>setForm((c)=>({...c,expectedAt:e.target.value}))} className=\"mt-1 border-gold/20 bg-espresso/70\" aria-label=\"Remaining contribution due date\" /></div><Input value={form.paymentReference} onChange={(e) => setForm((c) => ({...c,paymentReference:e.target.value}))} placeholder=\"Payment reference for amount paid (optional)\" className=\"border-gold/20 bg-espresso/70 sm:col-span-2\" />{form.budgetItemId && <label className=\"flex items-start gap-2 rounded-lg border border-gold/15 p-3 text-xs text-champagne/60 sm:col-span-2\"><Checkbox checked={form.alreadyIncludedInBudgetPaid} onCheckedChange={(checked) => setForm((c) => ({...c,alreadyIncludedInBudgetPaid:checked===true}))} /><span><strong className=\"text-champagne/80\">The amount paid above is already included in Budget “Paid”.</strong><br/>Use this only when reconciling a historical payment. Otherwise Wewed will add only the amount actually paid now to Budget Paid.</span></label>}<p className=\"text-xs leading-5 text-champagne/50 sm:col-span-2\">Example: promised $150, paid $100, due Dec 15. Enter 150 above, 100 here, and Dec 15 as the due date. Wewed records only the $100 payment and keeps $50 outstanding.</p><Textarea value={form.notes} onChange={(e) => setForm((c) => ({...c,notes:e.target.value}))} placeholder=\"Optional context\" className=\"border-gold/20 bg-espresso/70 sm:col-span-2\" /></div> : <div className=\"mt-2 grid gap-2 sm:grid-cols-2\"><select value={form.status} onChange={(e) => setForm((c) => ({...c,status:e.target.value}))} className=\"h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm\"><option value=\"PROMISED\">Promised — not received yet</option><option value=\"RECEIVED\">Received / paid / delivered</option></select>{form.status === 'PROMISED' && <Input type=\"date\" value={form.expectedAt} onChange={(e)=>setForm((c)=>({...c,expectedAt:e.target.value}))} className=\"border-gold/20 bg-espresso/70\" aria-label=\"Expected contribution date\" />}<Textarea value={form.notes} onChange={(e) => setForm((c) => ({...c,notes:e.target.value}))} placeholder=\"Optional context\" className=\"border-gold/20 bg-espresso/70 sm:col-span-2\" /></div>}</fieldset>"""
ui = replace_once(ui, old, new, 'direct current state UI')
old = """<td className=\"p-3\"><p>{item.title}</p><p className=\"text-xs text-champagne/45\">{contributionTypeText(item)}</p></td>"""
new = """<td className=\"p-3\"><p>{item.title}</p><p className=\"text-xs text-champagne/45\">{contributionTypeText(item)}</p>{item.type === 'DIRECT_VENDOR_PAYMENT' && <p className=\"mt-1 text-[10px] text-champagne/45\">Promised {money(item.amount ?? 0,item.currency)} · Paid {money(item.directVendorPaidAmount,item.currency)} · Remaining {money(item.remainingAmount,item.currency)}{item.expectedAt ? ` · Due ${new Date(item.expectedAt).toLocaleDateString()}` : ''}</p>}</td>"""
ui = replace_once(ui, old, new, 'desktop direct summary')
ui = replace_once(ui, ">Manage</Button></td></tr>)", ">{item.type === 'DIRECT_VENDOR_PAYMENT' && item.remainingAmount > 0 ? 'Record payment' : 'Manage'}</Button></td></tr>)", 'desktop payment CTA')
old = """<div className=\"mt-3 flex flex-wrap gap-2\"><Badge variant=\"outline\" className=\"border-gold/25 text-[10px] text-champagne/70\">{human(item.fulfillmentState)}</Badge>"""
new = """{item.type === 'DIRECT_VENDOR_PAYMENT' && <p className=\"mt-2 text-xs text-champagne/55\">Promised {money(item.amount ?? 0,item.currency)} · Paid {money(item.directVendorPaidAmount,item.currency)} · Remaining {money(item.remainingAmount,item.currency)}{item.expectedAt ? ` · Due ${new Date(item.expectedAt).toLocaleDateString()}` : ''}</p>}<div className=\"mt-3 flex flex-wrap gap-2\"><Badge variant=\"outline\" className=\"border-gold/25 text-[10px] text-champagne/70\">{human(item.fulfillmentState)}</Badge>"""
ui = replace_once(ui, old, new, 'mobile direct summary')
old = """</Panel></div> : <div className=\"mt-5 grid gap-3 sm:grid-cols-2\">"""
new = """</Panel></div>{manage.type === 'DIRECT_VENDOR_PAYMENT' && manage.expectedAt && manage.remainingAmount > 0 && <p className=\"mt-2 text-xs text-champagne/55\">Remaining payment due {new Date(manage.expectedAt).toLocaleDateString()}</p>} : <div className=\"mt-5 grid gap-3 sm:grid-cols-2\">"""
ui = replace_once(ui, old, new, 'manage due date')
ui_path.write_text(ui)

# 3) Budget category filter/form from canonical provider catalog with legacy normalization.
budget_path = Path('src/components/wedding/planner/modules/planner-budget-module.tsx')
budget = budget_path.read_text()
budget = replace_once(budget, "import { usePlannerFilterState } from '@/lib/planner-filter-state'\n", "import { usePlannerFilterState } from '@/lib/planner-filter-state'\nimport { PROVIDER_CATEGORIES } from '@/lib/provider-catalog'\n", 'budget provider import')
old = """const BUDGET_CATEGORIES = [
  { value: 'all', label: 'All categories' }, { value: 'venue', label: 'Venue' }, { value: 'catering', label: 'Catering' }, { value: 'attire', label: 'Attire' }, { value: 'roora', label: 'Roora' }, { value: 'decor', label: 'Decor' }, { value: 'photo_video', label: 'Photo/Video' }, { value: 'music', label: 'Music' }, { value: 'transport', label: 'Transport' }, { value: 'stationery', label: 'Stationery' }, { value: 'miscellaneous', label: 'Miscellaneous' },
] as const
"""
new = """const BUDGET_CATEGORIES = [{ value: 'all', label: 'All categories' }, ...PROVIDER_CATEGORIES.map((category) => ({ value: category.value, label: category.label })), { value: 'roora', label: 'Roora / traditional ceremony' }]
const LEGACY_BUDGET_CATEGORY_ALIASES: Record<string,string> = { decor:'decor-rentals', photo_video:'photography', music:'entertainment', miscellaneous:'other' }
function canonicalBudgetCategory(value: string): string { return LEGACY_BUDGET_CATEGORY_ALIASES[value] ?? value }
"""
budget = replace_once(budget, old, new, 'budget categories')
budget = replace_once(budget, "function categoryLabel(value: string): string { return BUDGET_CATEGORIES.find((category) => category.value === value)?.label ?? value.replaceAll('_', ' ') }", "function categoryLabel(value: string): string { const canonical=canonicalBudgetCategory(value); return BUDGET_CATEGORIES.find((category) => category.value === canonical)?.label ?? value.replaceAll('_', ' ') }", 'budget category label')
budget = replace_once(budget, "if (filters.category !== 'all' && item.category !== filters.category) return false", "if (filters.category !== 'all' && canonicalBudgetCategory(item.category) !== filters.category) return false", 'budget category filter')
budget = replace_once(budget, "value={budgetForm.category} onChange={(event) => setBudgetForm", "value={canonicalBudgetCategory(budgetForm.category)} onChange={(event) => setBudgetForm", 'budget form normalized value')
budget_path.write_text(budget)

# 4) Vendor add form uses the same marketplace/provider taxonomy.
vendor_path = Path('src/components/wedding/planner/modules/planner-vendors-module.tsx')
vendor = vendor_path.read_text()
vendor = replace_once(vendor, "import { useToast } from '@/hooks/use-toast'\n", "import { useToast } from '@/hooks/use-toast'\nimport { PROVIDER_CATEGORIES } from '@/lib/provider-catalog'\n", 'vendor provider import')
old = """const VENDOR_CATEGORIES = [
  'venue',
  'caterer',
  'photographer',
  'videographer',
  'florist',
  'dj',
  'decor',
  'transport',
  'stationery',
  'other',
]
"""
new = """const VENDOR_CATEGORIES = PROVIDER_CATEGORIES.map((category) => ({ value: category.value, label: category.label }))
"""
vendor = replace_once(vendor, old, new, 'vendor categories')
vendor = replace_once(vendor, "{VENDOR_CATEGORIES.map((category) => <option key={category} value={category}>{titleCase(category)}</option>)}", "{VENDOR_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}", 'vendor category options')
vendor_path.write_text(vendor)

# 5) Source-level regression contract for the exact UAT failure and taxonomy drift.
test_path = Path('src/lib/contributions-installment-entry-taxonomy-uat.test.ts')
test_path.write_text("""import { describe, expect, test } from 'bun:test'\nimport { readFileSync } from 'node:fs'\n\nconst route = readFileSync('src/app/api/planner/contributions/route.ts','utf8')\nconst ui = readFileSync('src/components/wedding/planner/planner-contributions-workspace.tsx','utf8')\nconst budget = readFileSync('src/components/wedding/planner/modules/planner-budget-module.tsx','utf8')\nconst vendors = readFileSync('src/components/wedding/planner/modules/planner-vendors-module.tsx','utf8')\n\ndescribe('Contributions installment-entry UAT guard', () => {\n  test('direct vendor creation separates promised total from amount actually paid', () => {\n    expect(route).toContain('directPaidNowProvided')\n    expect(route).toContain("fulfillmentState = 'PARTIALLY_RECEIVED'")\n    expect(route).toContain('const paymentAmount = directPaidNow ?? amount')\n    expect(route).toContain('increment: paymentAmount')\n    expect(ui).toContain('Amount actually paid to vendor so far')\n    expect(ui).toContain('Remaining payment due')\n    expect(ui).toContain('directPaidNow: direct ? directPaidNow : undefined')\n    expect(ui).toContain("'Record payment' : 'Manage'")\n    expect(ui).toContain('Promised {money(item.amount ?? 0,item.currency)} · Paid {money(item.directVendorPaidAmount,item.currency)} · Remaining')\n  })\n\n  test('Planner category selectors share the canonical provider catalog', () => {\n    expect(budget).toContain("import { PROVIDER_CATEGORIES } from '@/lib/provider-catalog'")\n    expect(vendors).toContain("import { PROVIDER_CATEGORIES } from '@/lib/provider-catalog'")\n    expect(ui).toContain("import { PROVIDER_CATEGORIES } from '@/lib/provider-catalog'")\n    expect(budget).toContain('PROVIDER_CATEGORIES.map')\n    expect(vendors).toContain('PROVIDER_CATEGORIES.map')\n    expect(ui).toContain('PLANNER_SERVICE_CATEGORIES')\n    expect(budget).toContain("photo_video:'photography'")\n  })\n})\n""")

for path in [route_path, ui_path, budget_path, vendor_path, test_path]:
    if not path.exists() or path.stat().st_size == 0:
        raise SystemExit(f'missing generated file: {path}')
print('Contributions installment-entry + taxonomy patch materialized')
