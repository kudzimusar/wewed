'use client'

import { useMemo, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  PlannerVendorPicker,
  type PlannerVendorOption,
} from '@/components/wedding/planner/planner-vendor-picker'
import { usePlannerFilterState } from '@/lib/planner-filter-state'

interface BudgetFunding {
  coupleFunded: number
  contributorFunded: number
  legacyUnattributed: number
  otherAttributed: number
  inKindValue: number
  contributionAllocated: number
}
interface BudgetContributionContext { contributionId: string; contributorName: string; title: string; notes: string | null; type: string; commitmentState: string; fulfillmentState: string; promisedAmount: number; paidAmount: number; remainingAmount: number; currency: string }
interface BudgetRow {
  id: string
  category: string
  description: string
  estimatedCost: number
  actualCost: number | null
  paidAmount: number
  currency: string
  vendorId: string | null
  vendorName: string | null
  notes: string | null
  dueDate: string | null
  funding?: BudgetFunding
  contributions?: BudgetContributionContext[]
}
interface BudgetSummary { totalEstimated: number; totalActual: number; totalPaid: number; totalOutstanding: number; currency: string; percentPaid: number }
interface CategoryBreakdown { category: string; estimated: number; actual: number; paid: number; outstanding: number; count: number }
interface BudgetForm { description: string; category: string; estimatedCost: string; actualCost: string; paidAmount: string; vendorId: string; vendorName: string; notes: string; dueDate: string }
interface PlannerBudgetModuleProps {
  budget: BudgetRow[]
  budgetSummary: BudgetSummary | null
  budgetByCategory: CategoryBreakdown[]
  budgetForm: BudgetForm
  setBudgetForm: Dispatch<SetStateAction<BudgetForm>>
  vendors: PlannerVendorOption[]
  saving: boolean
  onAddBudgetItem: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onUpdateBudgetItem: (item: BudgetRow, field: 'actualCost' | 'paidAmount', value: string) => void | Promise<void>
  onDeleteBudgetItem: (item: BudgetRow) => void | Promise<void>
}
const BUDGET_CATEGORIES = [
  { value: 'all', label: 'All categories' }, { value: 'venue', label: 'Venue' }, { value: 'catering', label: 'Catering' }, { value: 'attire', label: 'Attire' }, { value: 'roora', label: 'Roora' }, { value: 'decor', label: 'Decor' }, { value: 'photo_video', label: 'Photo/Video' }, { value: 'music', label: 'Music' }, { value: 'transport', label: 'Transport' }, { value: 'stationery', label: 'Stationery' }, { value: 'miscellaneous', label: 'Miscellaneous' },
] as const
function money(value: number, currency = 'USD'): string { try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD', maximumFractionDigits: 0 }).format(value) } catch { return `$${Math.round(value).toLocaleString('en-US')}` } }
function dateText(value: string | null): string { if (!value) return 'No due date'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date) }
function categoryLabel(value: string): string { return BUDGET_CATEGORIES.find((category) => category.value === value)?.label ?? value.replaceAll('_', ' ') }
function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <section className={`rounded-2xl border border-gold/15 bg-champagne/[0.035] ${className}`}>{children}</section> }
function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="rounded-xl border border-dashed border-gold/20 px-5 py-10 text-center"><p className="font-serif text-lg text-champagne">{title}</p><p className="mx-auto mt-2 max-w-lg font-sans text-xs leading-5 text-champagne/50">{detail}</p></div> }

function FundingLine({ item }: { item: BudgetRow }) {
  const funding = item.funding
  if (!funding) return null
  const hasFunding = funding.coupleFunded > 0 || funding.contributorFunded > 0 || funding.legacyUnattributed > 0 || funding.inKindValue > 0 || funding.contributionAllocated > 0 || funding.otherAttributed > 0
  if (!hasFunding) return null
  return <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-sans text-[10px] leading-4 text-champagne/50">
    <span className="font-semibold text-gold/80">Paid by:</span>
    {funding.coupleFunded > 0 && <span>Us {money(funding.coupleFunded,item.currency)}</span>}
    {funding.contributorFunded > 0 && <span>Contributors {money(funding.contributorFunded,item.currency)}</span>}
    {funding.otherAttributed > 0 && <span>Other {money(funding.otherAttributed,item.currency)}</span>}
    {funding.legacyUnattributed > 0 && <span className="font-medium text-clay-light">Source not recorded {money(funding.legacyUnattributed,item.currency)}</span>}
    {funding.contributionAllocated > 0 && <span>Contribution money set aside {money(funding.contributionAllocated,item.currency)}</span>}
    {funding.inKindValue > 0 && <span>In-kind {money(funding.inKindValue,item.currency)} est.</span>}
  </div>
}

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


export function PlannerBudgetModule({ budget, budgetSummary, budgetByCategory, budgetForm, setBudgetForm, vendors, saving, onAddBudgetItem, onUpdateBudgetItem, onDeleteBudgetItem }: PlannerBudgetModuleProps) {
  const [filters, setFilters, resetFilters] = usePlannerFilterState('wewed:planner:budget:filters', { search: '', category: 'all', status: 'all' })
  const filteredBudget = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    const now = Date.now()
    return budget.filter((item) => {
      const actual = item.actualCost ?? item.estimatedCost
      const outstanding = Math.max(0, actual - item.paidAmount)
      const paid = actual > 0 && outstanding === 0
      const overdue = Boolean(item.dueDate && new Date(item.dueDate).getTime() < now && !paid)
      if (filters.category !== 'all' && item.category !== filters.category) return false
      if (filters.status === 'paid' && !paid) return false
      if (filters.status === 'outstanding' && outstanding <= 0) return false
      if (filters.status === 'overdue' && !overdue) return false
      return !query || [item.description, item.vendorName ?? '', item.category, categoryLabel(item.category), item.notes ?? ''].some((value) => value.toLowerCase().includes(query))
    })
  }, [budget, filters])

  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">{[['Estimated', budgetSummary?.totalEstimated ?? 0], ['Actual', budgetSummary?.totalActual ?? 0], ['Paid', budgetSummary?.totalPaid ?? 0], ['Outstanding', budgetSummary?.totalOutstanding ?? 0]].map(([label, value]) => <SectionCard key={String(label)} className="p-3 sm:p-4"><p className="font-sans text-[9px] uppercase tracking-[0.12em] text-gold/75 sm:text-[10px] sm:tracking-[0.16em]">{label}</p><p className="mt-1.5 font-serif text-xl sm:mt-2 sm:text-2xl">{money(Number(value), budgetSummary?.currency)}</p></SectionCard>)}</div>
    {budgetSummary && <SectionCard className="p-4"><div className="flex items-center justify-between gap-3 font-sans text-xs text-champagne/60"><span>Payment progress</span><span className="text-gold">{budgetSummary.percentPaid}% paid</span></div><Progress value={budgetSummary.percentPaid} className="mt-2 h-1.5 bg-champagne/10 [&>div]:bg-gold" /><p className="mt-2 text-[10px] leading-4 text-champagne/45">“Paid” means the obligation was covered. Each item below now shows whether it was paid by you, a contributor, or has a historical source that has not been classified yet.</p></SectionCard>}
    {budgetByCategory.length > 0 && <SectionCard className="p-4"><div className="mb-3"><h2 className="font-serif text-lg">Budget category breakdown</h2><p className="font-sans text-xs text-champagne/50">Paid progress against the estimate for each category.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{budgetByCategory.map((category) => { const percent = category.estimated > 0 ? Math.min(100, Math.round((category.paid / category.estimated) * 100)) : 0; return <div key={category.category} className="rounded-xl border border-gold/15 bg-espresso/45 p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-sans text-sm font-medium">{categoryLabel(category.category)}</p><p className="font-sans text-[10px] text-champagne/50">{category.count} {category.count === 1 ? 'item' : 'items'}</p></div><p className="font-sans text-xs text-gold">{money(category.paid, budgetSummary?.currency)} / {money(category.estimated, budgetSummary?.currency)}</p></div><Progress value={percent} className="mt-2 h-1 bg-champagne/10 [&>div]:bg-gold" /></div>})}</div></SectionCard>}

    <SectionCard className="p-4"><form onSubmit={onAddBudgetItem} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div><Label htmlFor="workspace-budget-description">Description</Label><Input id="workspace-budget-description" value={budgetForm.description} onChange={(event) => setBudgetForm((current) => ({ ...current, description: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" placeholder="Venue hire" /></div>
      <div><Label htmlFor="workspace-budget-vendor">Vendor</Label><div className="mt-1"><PlannerVendorPicker vendors={vendors} vendorId={budgetForm.vendorId} vendorName={budgetForm.vendorName} disabled={saving} inputId="workspace-budget-vendor" onChange={(value) => setBudgetForm((current) => ({ ...current, ...value }))} /></div></div>
      <div><Label htmlFor="workspace-budget-category">Category</Label><select id="workspace-budget-category" value={budgetForm.category} onChange={(event) => setBudgetForm((current) => ({ ...current, category: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">{BUDGET_CATEGORIES.filter((category) => category.value !== 'all').map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></div>
      <div><Label htmlFor="workspace-budget-due-date">Due date</Label><Input id="workspace-budget-due-date" type="date" value={budgetForm.dueDate} onChange={(event) => setBudgetForm((current) => ({ ...current, dueDate: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div>
      <div><Label htmlFor="workspace-budget-estimated-cost">Estimate</Label><Input id="workspace-budget-estimated-cost" type="number" min="0" value={budgetForm.estimatedCost} onChange={(event) => setBudgetForm((current) => ({ ...current, estimatedCost: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div>
      <div><Label htmlFor="workspace-budget-actual-cost">Actual</Label><Input id="workspace-budget-actual-cost" type="number" min="0" value={budgetForm.actualCost} onChange={(event) => setBudgetForm((current) => ({ ...current, actualCost: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div>
      <div><Label htmlFor="workspace-budget-paid-amount">Paid</Label><Input id="workspace-budget-paid-amount" type="number" min="0" value={budgetForm.paidAmount} onChange={(event) => setBudgetForm((current) => ({ ...current, paidAmount: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" /></div>
      <div className="md:col-span-2 xl:col-span-3"><Label htmlFor="workspace-budget-notes">Notes</Label><Input id="workspace-budget-notes" value={budgetForm.notes} onChange={(event) => setBudgetForm((current) => ({ ...current, notes: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" placeholder="Contract, quote, or payment context" /></div>
      <Button type="submit" disabled={saving} className="self-end bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Add</Button>
    </form><p className="mt-3 font-sans text-[10px] leading-4 text-champagne/45">Search and select an existing wedding vendor to create a durable link. If the vendor is not in Wewed yet, keep the typed name as a manual external vendor.</p></SectionCard>

    <SectionCard className="overflow-hidden">
      <div className="grid gap-3 border-b border-gold/10 p-4 lg:grid-cols-[minmax(0,1fr)_14rem_12rem_auto]"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/35" /><Input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search item, vendor, category, or notes" className="border-gold/20 bg-espresso/70 pl-9" /></div><select aria-label="Filter budget by category" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">{BUDGET_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select><select aria-label="Filter budget by payment status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">All payment states</option><option value="paid">Paid</option><option value="outstanding">Outstanding</option><option value="overdue">Overdue</option></select><Button type="button" variant="outline" onClick={resetFilters} className="border-gold/20 bg-transparent text-champagne/60">Reset</Button></div>
      <div className="space-y-2 p-4">{budget.length === 0 ? <EmptyState title="No budget items" detail="Add your first estimate or import the wedding budget worksheet." /> : filteredBudget.length === 0 ? <EmptyState title="No budget items in this view" detail="Clear the search or filters to see the remaining costs." /> : filteredBudget.map((item) => { const actual = item.actualCost ?? item.estimatedCost; const outstanding = Math.max(0, actual - item.paidAmount); const isPaid = actual > 0 && item.paidAmount >= actual; return <div key={item.id} className="grid gap-3 rounded-xl border border-gold/10 bg-espresso/45 p-3 lg:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><p className="font-sans text-sm font-medium">{item.description}</p><Badge variant="outline" className="border-champagne bg-champagne text-[10px] font-semibold text-espresso">{categoryLabel(item.category)}</Badge>{item.vendorId && <Badge variant="outline" className="border-sage/40 bg-sage/10 text-[10px] text-sage-light">Vendor linked</Badge>}<Badge variant="outline" className={isPaid ? 'border-sage/50 bg-sage/10 text-sage-light' : 'border-gold/30 bg-espresso text-champagne/80'}>{isPaid ? 'Paid' : `${money(outstanding, item.currency)} outstanding`}</Badge></div>{item.vendorName && <p className="mt-1 font-sans text-xs text-champagne/70">Vendor: {item.vendorName}</p>}<p className="mt-1 text-xs text-champagne/55">Estimated {money(item.estimatedCost, item.currency)} · {dateText(item.dueDate)}</p>{item.notes && <p className="mt-1 font-sans text-xs text-champagne/55">{item.notes}</p>}<FundingLine item={item} /><ContributionContextLine item={item} /></div><div><Label className="text-[10px]">Actual</Label><Input type="number" min="0" aria-label={`Actual cost for ${item.description}`} defaultValue={item.actualCost ?? ''} onBlur={(event) => void onUpdateBudgetItem(item, 'actualCost', event.target.value)} className="mt-1 h-8 border-gold/20 bg-espresso/70 text-xs" /></div><div><Label className="text-[10px]">Paid</Label><Input type="number" min="0" aria-label={`Paid amount for ${item.description}`} defaultValue={item.paidAmount} onBlur={(event) => void onUpdateBudgetItem(item, 'paidAmount', event.target.value)} className="mt-1 h-8 border-gold/20 bg-espresso/70 text-xs" /></div><Button type="button" variant="ghost" size="icon" aria-label={`Delete ${item.description}`} disabled={saving} onClick={() => { if (window.confirm(`Delete budget item “${item.description}”?`)) void onDeleteBudgetItem(item) }} className="size-9 text-champagne/45 hover:bg-clay/10 hover:text-clay-light"><Trash2 className="size-4" /></Button></div>})}</div>
    </SectionCard>
  </div>
}
