from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UI = ROOT / 'src/components/wedding/planner/planner-contributions-workspace.tsx'
CORE = ROOT / 'src/lib/planner-engagement-route-core.ts'
TEST = ROOT / 'src/lib/contributions-inline-dependencies-uat.test.ts'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old, new, 1)


ui = UI.read_text()
if 'Add budget item here' in ui or 'createInlineBudgetDependency' in ui:
    raise SystemExit('Contributions inline dependency product is already materialized.')

state_anchor = "  const [campaignForm, setCampaignForm] = useState({ type: 'HONEYMOON', title: '', description: '', targetAmount: '', currency: 'USD', externalUrl: '' })\n"
state_insert = state_anchor + """  const [dependencySaving, setDependencySaving] = useState<'budget'|'service'|''>('')
  const [budgetQuickOpen, setBudgetQuickOpen] = useState(false)
  const [budgetQuick, setBudgetQuick] = useState({ description:'', category:'miscellaneous', estimatedCost:'', actualCost:'', currency:'USD', dueDate:'' })
  const [vendorQuickOpen, setVendorQuickOpen] = useState(false)
  const [vendorQuick, setVendorQuick] = useState({ vendorId:'', vendorName:'', vendorCategory:'other', serviceCategory:'', serviceDescription:'', agreedAmount:'', currency:'USD' })
"""
ui = replace_once(ui, state_anchor, state_insert, 'dependency state')

add_anchor = "  async function addContribution(event: React.FormEvent) {\n"
helpers = r'''  function dependencyError(message: string) {
    setError(message)
    toast({ title: 'Setup needed', description: message, variant: 'destructive' })
  }

  function openBudgetQuickCreate() {
    setBudgetQuick((current) => ({
      ...current,
      description: current.description || form.title,
      currency: form.currency || 'USD',
    }))
    setBudgetQuickOpen(true)
  }

  async function createInlineBudgetDependency() {
    const description = budgetQuick.description.trim()
    if (!description) return dependencyError('Name the Budget cost before adding it.')
    const estimatedCost = budgetQuick.estimatedCost.trim() ? Number(budgetQuick.estimatedCost) : 0
    const actualCost = budgetQuick.actualCost.trim() ? Number(budgetQuick.actualCost) : null
    if (!Number.isFinite(estimatedCost) || estimatedCost < 0 || (actualCost !== null && (!Number.isFinite(actualCost) || actualCost < 0))) {
      return dependencyError('Budget amounts must be zero or greater.')
    }

    setDependencySaving('budget'); setError('')
    try {
      const response = await fetch('/api/planner/budget', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          description,
          category: budgetQuick.category,
          estimatedCost,
          actualCost,
          paidAmount: 0,
          currency: budgetQuick.currency || form.currency || 'USD',
          dueDate: budgetQuick.dueDate || null,
        }),
      })
      const body = await response.json()
      if (!response.ok || body.success === false || !body.data?.id) throw new Error(body.error || 'Could not add the Budget item.')
      setForm((current) => ({ ...current, budgetItemId: String(body.data.id) }))
      setBudgetQuickOpen(false)
      await load(false)
      refreshPlannerWorksheet()
      toast({ title: 'Budget item added', description: 'The cost is selected here. Its Paid amount starts at 0.' })
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not add the Budget item.'
      setError(message); toast({ title: 'Could not add Budget item', description: message, variant: 'destructive' })
    } finally { setDependencySaving('') }
  }

  function openVendorQuickCreate() {
    const budget = workspace?.options.budgetItems.find((item) => item.id === form.budgetItemId)
    setVendorQuick((current) => ({
      ...current,
      serviceCategory: current.serviceCategory || budget?.category || '',
      serviceDescription: current.serviceDescription || form.title,
      currency: form.currency || 'USD',
    }))
    setVendorQuickOpen(true)
  }

  async function createInlineVendorServiceDependency() {
    if (!form.budgetItemId) return dependencyError('Choose or add the Budget cost first so Wewed can link the vendor service to the same transaction.')
    if (!vendorQuick.vendorId && !vendorQuick.vendorName.trim()) return dependencyError('Choose an existing vendor or enter the new vendor name.')
    if (!vendorQuick.serviceCategory.trim()) return dependencyError('Enter the service category before adding the vendor service.')
    const agreedAmount = vendorQuick.agreedAmount.trim() ? Number(vendorQuick.agreedAmount) : null
    if (agreedAmount !== null && (!Number.isFinite(agreedAmount) || agreedAmount < 0)) return dependencyError('The agreed service amount must be zero or greater.')

    setDependencySaving('service'); setError('')
    let createdVendorId = ''
    try {
      let vendorId = vendorQuick.vendorId
      if (!vendorId) {
        const vendorResponse = await fetch('/api/planner/vendors', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: vendorQuick.vendorName.trim(), category: vendorQuick.vendorCategory, paymentStatus: 'unpaid', contractStatus: 'pending' }),
        })
        const vendorBody = await vendorResponse.json()
        if (!vendorResponse.ok || vendorBody.success === false || !vendorBody.data?.id) throw new Error(vendorBody.error || 'Could not add the vendor.')
        vendorId = String(vendorBody.data.id)
        createdVendorId = vendorId
        setVendorQuick((current) => ({ ...current, vendorId }))
      }

      const engagementResponse = await fetch('/api/planner/engagements', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          vendorId,
          serviceCategory: vendorQuick.serviceCategory.trim(),
          serviceDescription: vendorQuick.serviceDescription.trim() || form.title || null,
          agreedAmount,
          currency: vendorQuick.currency || form.currency || 'USD',
          externalAgreementStatus: 'unknown',
          budgetItemIds: [form.budgetItemId],
          payments: [],
        }),
      })
      const engagementBody = await engagementResponse.json()
      if (!engagementResponse.ok || engagementBody.success === false || !engagementBody.data?.id) throw new Error(engagementBody.error || 'Could not add the vendor service.')
      setForm((current) => ({ ...current, serviceEngagementId: String(engagementBody.data.id) }))
      setVendorQuickOpen(false)
      await load(false)
      refreshPlannerWorksheet()
      toast({ title: 'Vendor service added', description: 'The vendor and service are selected here and linked to the same Budget cost.' })
    } catch (reason) {
      if (createdVendorId) await load(false)
      const message = reason instanceof Error ? reason.message : 'Could not add the vendor service.'
      setError(message); toast({ title: 'Could not add vendor service', description: message, variant: 'destructive' })
    } finally { setDependencySaving('') }
  }

'''
ui = replace_once(ui, add_anchor, helpers + add_anchor, 'dependency helpers')

validation_anchor = "    const direct = form.type === 'DIRECT_VENDOR_PAYMENT'\n"
validation = validation_anchor + """    if (direct && !form.budgetItemId) {
      dependencyError('Choose or add the Budget cost in Step 3 before saving this direct vendor contribution.')
      return
    }
    if (direct && !form.serviceEngagementId) {
      dependencyError('Choose or add the vendor service in Step 3 before saving this direct vendor contribution.')
      return
    }
"""
ui = replace_once(ui, validation_anchor, validation, 'direct contribution prerequisite validation')

start_marker = '      <fieldset><legend className="font-medium">3. Where is it going?</legend>'
end_marker = '      <fieldset><legend className="font-medium">4. What is the current state?</legend>'
start = ui.find(start_marker)
end = ui.find(end_marker, start)
if start < 0 or end < 0 or end <= start:
    raise SystemExit('where-it-is-going fieldset anchors were not found')

where_block = r'''      <fieldset><legend className="font-medium">3. Where is it going?</legend><div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gold/15 p-3 sm:col-span-2"><div className="flex items-center justify-between gap-2"><div><Label>Budget cost</Label><p className="mt-0.5 text-[11px] text-champagne/45">Use the real Budget item. If it does not exist yet, add it here without losing this contribution.</p></div><Button type="button" size="sm" variant="outline" disabled={!canEdit || dependencySaving !== ''} onClick={openBudgetQuickCreate} className="shrink-0 border-gold/20 bg-transparent"><Plus className="size-3.5" />Add budget item here</Button></div><select aria-label="Choose budget item" value={form.budgetItemId} onChange={(e) => { const item=workspace?.options.budgetItems.find((candidate)=>candidate.id===e.target.value); setForm((c)=>({...c,budgetItemId:e.target.value,serviceEngagementId:c.serviceEngagementId || item?.serviceEngagementId || ''})) }} className="mt-2 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">Not allocated yet</option>{workspace?.options.budgetItems.map((item) => <option key={item.id} value={item.id}>{item.description}</option>)}</select></div>
        {budgetQuickOpen && <div className="rounded-xl border border-gold/25 bg-gold/5 p-3 sm:col-span-2"><div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-medium">Add the missing Budget cost</h3><p className="mt-0.5 text-[11px] text-champagne/50">This creates the normal Planner Budget record. Paid starts at 0; the contribution amount is not copied into Paid.</p></div><Button type="button" size="icon" variant="ghost" onClick={() => setBudgetQuickOpen(false)}><X className="size-4" /></Button></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><Input value={budgetQuick.description} onChange={(e)=>setBudgetQuick((c)=>({...c,description:e.target.value}))} placeholder="Budget cost, e.g. Bridal gown" className="border-gold/20 bg-espresso/70"/><select aria-label="New budget category" value={budgetQuick.category} onChange={(e)=>setBudgetQuick((c)=>({...c,category:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="venue">Venue</option><option value="catering">Catering</option><option value="attire">Attire</option><option value="roora">Roora</option><option value="decor">Decor</option><option value="photo_video">Photo / video</option><option value="music">Music</option><option value="transport">Transport</option><option value="stationery">Stationery</option><option value="miscellaneous">Other</option></select><Input inputMode="decimal" value={budgetQuick.estimatedCost} onChange={(e)=>setBudgetQuick((c)=>({...c,estimatedCost:e.target.value}))} placeholder="Estimated cost (optional)" className="border-gold/20 bg-espresso/70"/><Input inputMode="decimal" value={budgetQuick.actualCost} onChange={(e)=>setBudgetQuick((c)=>({...c,actualCost:e.target.value}))} placeholder="Actual/quoted total (optional)" className="border-gold/20 bg-espresso/70"/><Input value={budgetQuick.currency} maxLength={3} onChange={(e)=>setBudgetQuick((c)=>({...c,currency:e.target.value.toUpperCase()}))} placeholder="USD" className="border-gold/20 bg-espresso/70"/><Input type="date" aria-label="New budget due date" value={budgetQuick.dueDate} onChange={(e)=>setBudgetQuick((c)=>({...c,dueDate:e.target.value}))} className="border-gold/20 bg-espresso/70"/></div><Button type="button" disabled={dependencySaving !== '' || !canEdit} onClick={() => void createInlineBudgetDependency()} className="mt-3 bg-gold text-espresso">{dependencySaving === 'budget' ? <Loader2 className="size-4 animate-spin"/> : <Plus className="size-4"/>}Create & use Budget item</Button></div>}
        {form.type === 'DIRECT_VENDOR_PAYMENT' && <><div className="rounded-xl border border-gold/15 p-3 sm:col-span-2"><div className="flex items-center justify-between gap-2"><div><Label>Vendor service</Label><p className="mt-0.5 text-[11px] text-champagne/45">A direct vendor payment must belong to the real vendor service. Add it here if it is missing.</p></div><Button type="button" size="sm" variant="outline" disabled={!canEdit || dependencySaving !== ''} onClick={openVendorQuickCreate} className="shrink-0 border-gold/20 bg-transparent"><Plus className="size-3.5" />Add vendor / service here</Button></div><select aria-label="Choose vendor service engagement" value={form.serviceEngagementId} onChange={(e) => setForm((c) => ({...c,serviceEngagementId:e.target.value}))} className="mt-2 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">Choose vendor service engagement</option>{workspace?.options.engagements.map((item) => <option key={item.id} value={item.id}>{item.vendor.name} — {item.serviceCategory}</option>)}</select>{!form.budgetItemId && <p className="mt-2 text-[11px] text-gold/80">Add or choose the Budget cost first. Wewed will then link the vendor service to that same cost.</p>}</div>
        {vendorQuickOpen && <div className="rounded-xl border border-gold/25 bg-gold/5 p-3 sm:col-span-2"><div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-medium">Add the missing vendor service</h3><p className="mt-0.5 text-[11px] text-champagne/50">This creates the normal wedding Vendor and Service Engagement. No payment is created here.</p></div><Button type="button" size="icon" variant="ghost" onClick={() => setVendorQuickOpen(false)}><X className="size-4" /></Button></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><select aria-label="Choose existing vendor for new service" value={vendorQuick.vendorId} onChange={(e)=>setVendorQuick((c)=>({...c,vendorId:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">Add a new wedding vendor</option>{workspace?.options.vendors.map((vendor)=><option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select>{!vendorQuick.vendorId && <Input value={vendorQuick.vendorName} onChange={(e)=>setVendorQuick((c)=>({...c,vendorName:e.target.value}))} placeholder="Vendor name" className="border-gold/20 bg-espresso/70"/>}{!vendorQuick.vendorId && <select aria-label="New vendor category" value={vendorQuick.vendorCategory} onChange={(e)=>setVendorQuick((c)=>({...c,vendorCategory:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="venue">Venue</option><option value="caterer">Caterer</option><option value="photographer">Photographer</option><option value="videographer">Videographer</option><option value="florist">Florist</option><option value="dj">DJ</option><option value="decor">Decor</option><option value="transport">Transport</option><option value="stationery">Stationery</option><option value="other">Other</option></select>}<Input value={vendorQuick.serviceCategory} onChange={(e)=>setVendorQuick((c)=>({...c,serviceCategory:e.target.value}))} placeholder="Service category, e.g. Bridal attire" className="border-gold/20 bg-espresso/70"/><Input value={vendorQuick.serviceDescription} onChange={(e)=>setVendorQuick((c)=>({...c,serviceDescription:e.target.value}))} placeholder="Service description (optional)" className="border-gold/20 bg-espresso/70"/><Input inputMode="decimal" value={vendorQuick.agreedAmount} onChange={(e)=>setVendorQuick((c)=>({...c,agreedAmount:e.target.value}))} placeholder="Agreed service total (optional)" className="border-gold/20 bg-espresso/70"/><Input value={vendorQuick.currency} maxLength={3} onChange={(e)=>setVendorQuick((c)=>({...c,currency:e.target.value.toUpperCase()}))} placeholder="USD" className="border-gold/20 bg-espresso/70"/></div><Button type="button" disabled={dependencySaving !== '' || !canEdit || !form.budgetItemId} onClick={() => void createInlineVendorServiceDependency()} className="mt-3 bg-gold text-espresso">{dependencySaving === 'service' ? <Loader2 className="size-4 animate-spin"/> : <Store className="size-4"/>}Create & use vendor service</Button></div>}</>}
        <select aria-label="Choose contribution campaign" value={form.campaignId} onChange={(e) => setForm((c) => ({...c,campaignId:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm sm:col-span-2"><option value="">No honeymoon/campaign</option>{workspace?.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select>
      </div></fieldset>
'''
ui = ui[:start] + where_block + ui[end:]

for invariant in [
    'Add budget item here',
    'Add vendor / service here',
    'paidAmount: 0',
    'budgetItemIds: [form.budgetItemId]',
    'payments: []',
    'Choose or add the Budget cost in Step 3',
    'Choose or add the vendor service in Step 3',
]:
    if invariant not in ui:
        raise SystemExit(f'missing UI invariant after materialization: {invariant}')
if 'select required value={form.serviceEngagementId}' in ui:
    raise SystemExit('generic required service-engagement browser validation still present')
UI.write_text(ui)

core = CORE.read_text()
core = replace_once(
    core,
    "  const vendor = await db.vendor.findFirst({\n    where: { id: input.vendorId, weddingId },\n    select: { id: true },\n  })",
    "  const vendor = await db.vendor.findFirst({\n    where: { id: input.vendorId, weddingId },\n    select: { id: true, name: true },\n  })",
    'engagement vendor identity selection',
)
core = replace_once(
    core,
    "        data: { serviceEngagementId: engagement.id },",
    "        data: { serviceEngagementId: engagement.id, vendorId: vendor.id, vendorName: vendor.name },",
    'budget engagement/vendor synchronization',
)
CORE.write_text(core)

TEST.write_text(r'''import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const ui = readFileSync('src/components/wedding/planner/planner-contributions-workspace.tsx', 'utf8')
const engagementCore = readFileSync('src/lib/planner-engagement-route-core.ts', 'utf8')
const budgetApi = readFileSync('src/app/api/planner/budget/route.ts', 'utf8')
const vendorApi = readFileSync('src/app/api/planner/vendors/route.ts', 'utf8')
const engagementApi = readFileSync('src/app/api/planner/engagements/route.ts', 'utf8')

describe('Contributions inline dependency UAT contract', () => {
  test('keeps the planner in Contributions when the Budget cost is missing', () => {
    expect(ui).toContain('Add budget item here')
    expect(ui).toContain("fetch('/api/planner/budget'")
    expect(ui).toContain('paidAmount: 0')
    expect(ui).toContain('Create & use Budget item')
    expect(ui).toContain('budgetItemId: String(body.data.id)')
    expect(budgetApi).toContain("requireWeddingPermission(request, 'budget.edit')")
  })

  test('creates canonical vendor and service records without fabricating payment', () => {
    expect(ui).toContain('Add vendor / service here')
    expect(ui).toContain("fetch('/api/planner/vendors'")
    expect(ui).toContain("fetch('/api/planner/engagements'")
    expect(ui).toContain('budgetItemIds: [form.budgetItemId]')
    expect(ui).toContain('payments: []')
    expect(ui).toContain('No payment is created here.')
    expect(vendorApi).toContain("requireWeddingPermission(request, 'vendors.edit')")
    expect(engagementApi).toContain("requireWeddingPermission(request, 'vendors.edit')")
  })

  test('links the same Budget item to the engagement and vendor identity', () => {
    expect(engagementCore).toContain('select: { id: true, name: true }')
    expect(engagementCore).toContain('serviceEngagementId: engagement.id, vendorId: vendor.id, vendorName: vendor.name')
    expect(engagementCore).toContain('item.vendorId && item.vendorId !== vendor.id')
  })

  test('replaces native dead-end validation with guided prerequisites', () => {
    expect(ui).toContain('Choose or add the Budget cost in Step 3 before saving this direct vendor contribution.')
    expect(ui).toContain('Choose or add the vendor service in Step 3 before saving this direct vendor contribution.')
    expect(ui).not.toContain('select required value={form.serviceEngagementId}')
    expect(ui).toContain('Add or choose the Budget cost first. Wewed will then link the vendor service to that same cost.')
  })

  test('does not close the contribution dialog while dependencies are created', () => {
    const budgetStart = ui.indexOf('async function createInlineBudgetDependency')
    const vendorStart = ui.indexOf('async function createInlineVendorServiceDependency')
    const contributionStart = ui.indexOf('async function addContribution')
    expect(budgetStart).toBeGreaterThan(-1)
    expect(vendorStart).toBeGreaterThan(budgetStart)
    expect(contributionStart).toBeGreaterThan(vendorStart)
    const dependencyFunctions = ui.slice(budgetStart, contributionStart)
    expect(dependencyFunctions).not.toContain('setAddOpen(false)')
    expect(dependencyFunctions).toContain('setForm((current) => ({ ...current, budgetItemId: String(body.data.id) }))')
    expect(dependencyFunctions).toContain('setForm((current) => ({ ...current, serviceEngagementId: String(engagementBody.data.id) }))')
  })
})
''')

print('Contributions inline dependency UAT materialized successfully.')
