'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CircleDollarSign, Download, Gift, HandHeart, Loader2, NotebookPen, Plus, Search, Sparkles, Store, Users, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { CONTRIBUTION_TYPE_LABELS } from '@/lib/contributions'

type ContributionType = keyof typeof CONTRIBUTION_TYPE_LABELS
interface Contributor { id: string; displayName: string; email: string | null; relationship: string | null }
interface BudgetOption { id: string; description: string; category: string; currency: string; paidAmount: number; actualCost: number | null; estimatedCost: number; serviceEngagementId: string | null }
interface EngagementOption { id: string; serviceCategory: string; serviceDescription: string | null; currency: string; vendor: { id: string; name: string } }
interface Allocation { id: string; budgetItemId: string; amount: number; currency: string; allocationKind: string; budgetItem: { id: string; description: string; category: string } }
interface Contribution {
  id: string; type: ContributionType; title: string; description: string | null; amount: number | null; currency: string; estimatedValue: number | null; estimatedValueCurrency: string | null; quantity: number | null; unit: string | null; route: string; commitmentState: string; fulfillmentState: string; verificationState: string; thankYouState: string; notes: string | null; contributor: Contributor; campaign: { id: string; title: string } | null; vendor: { id: string; name: string } | null; serviceEngagement: { id: string; serviceCategory: string | null; serviceDescription: string | null } | null; allocations: Allocation[]; availableAmount: number; allocatedAmount: number; taskLinks: Array<{ plannerTask: { id: string; title: string; status: string } }>;
}
interface Campaign { id: string; type: string; title: string; description: string | null; targetAmount: number | null; currency: string; published: boolean; showTarget: boolean; showRaised: boolean; externalUrl: string | null; ctaLabel: string | null; invitationVisible: boolean; publicNote: string | null; raised: number }
interface CurrencySummary { currency: string; cashReceived: number; directVendorPaid: number; inKindValue: number; pledged: number; availableCash: number }
interface WorkspacePayload { success: boolean; weddingId: string; data: Contribution[]; contributors: Contributor[]; campaigns: Campaign[]; summaryByCurrency: CurrencySummary[]; counts: { contributors: number; pledged: number; toThank: number }; options: { budgetItems: BudgetOption[]; engagements: EngagementOption[]; guests: Array<{id:string;name:string;email:string|null}>; vendors: Array<{id:string;name:string;category:string}> } }
interface FundingItem { id: string; description: string; paidAmount: number; currency: string; category: string; unattributed: number; funding: Array<{ sourceKind: string; contributionId: string | null; amount: number; currency: string }> }

const INITIAL_FORM = { contributorId: '', contributorName: '', email: '', relationship: '', guestId: '', type: 'CASH_TO_COUPLE' as ContributionType, title: '', amount: '', currency: 'USD', estimatedValue: '', quantity: '', unit: '', status: 'RECEIVED', budgetItemId: '', serviceEngagementId: '', campaignId: '', paymentReference: '', alreadyIncludedInBudgetPaid: false, notes: '' }

function money(value: number, currency = 'USD') { try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value) } catch { return `${currency} ${value.toFixed(2)}` } }
function human(value: string) { return value.toLowerCase().replaceAll('_',' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <section className={`rounded-2xl border border-gold/15 bg-champagne/[0.035] ${className}`}>{children}</section> }

export function PlannerContributionsWorkspace() {
  const router = useRouter()
  const { toast } = useToast()
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null)
  const [funding, setFunding] = useState<FundingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [manage, setManage] = useState<Contribution | null>(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [allocation, setAllocation] = useState({ budgetItemId: '', amount: '' })
  const [taskTitle, setTaskTitle] = useState('')
  const [noteText, setNoteText] = useState('')
  const [fundingContributionId, setFundingContributionId] = useState('')
  const [campaignForm, setCampaignForm] = useState({ title: '', description: '', targetAmount: '', currency: 'USD', externalUrl: '' })

  const load = useCallback(async (spinner = false) => {
    if (spinner) setLoading(true)
    setError('')
    try {
      const [contributionResponse, fundingResponse] = await Promise.all([
        fetch('/api/planner/contributions', { cache: 'no-store' }),
        fetch('/api/planner/budget/funding', { cache: 'no-store' }),
      ])
      const contributionBody = await contributionResponse.json()
      if (!contributionResponse.ok || contributionBody.success === false) throw new Error(contributionBody.error || 'Could not load contributions.')
      setWorkspace(contributionBody)
      if (fundingResponse.ok) {
        const fundingBody = await fundingResponse.json()
        if (fundingBody.success !== false) setFunding(fundingBody.data ?? [])
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load contributions.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load(true) }, [load])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (workspace?.data ?? []).filter((item) => {
      if (filter === 'pledged' && !(item.commitmentState === 'PLEDGED' && item.fulfillmentState === 'PENDING')) return false
      if (filter === 'received' && !['RECEIVED','DELIVERED','PAID_DIRECT','COMPLETED'].includes(item.fulfillmentState)) return false
      if (filter === 'direct' && item.type !== 'DIRECT_VENDOR_PAYMENT') return false
      if (filter === 'in-kind' && !['GOODS_IN_KIND','SERVICE_IN_KIND','TIME_LABOUR','DISCOUNT_SPONSORSHIP'].includes(item.type)) return false
      if (filter === 'thank' && !['TO_THANK','PREPARED'].includes(item.thankYouState)) return false
      return !query || [item.contributor.displayName,item.title,item.description ?? '',item.vendor?.name ?? '',item.campaign?.title ?? ''].some((value) => value.toLowerCase().includes(query))
    })
  }, [workspace, search, filter])

  async function mutate(url: string, init: RequestInit) {
    setSaving(true); setError('')
    try {
      const response = await fetch(url, init)
      const body = await response.json()
      if (!response.ok || body.success === false) throw new Error(body.error || 'The change could not be saved.')
      await load(false)
      return true
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'The change could not be saved.'
      setError(message); toast({ title: 'Could not save', description: message, variant: 'destructive' }); return false
    } finally { setSaving(false) }
  }

  async function addContribution(event: React.FormEvent) {
    event.preventDefault()
    const inKind = ['GOODS_IN_KIND','SERVICE_IN_KIND','TIME_LABOUR','DISCOUNT_SPONSORSHIP'].includes(form.type)
    const direct = form.type === 'DIRECT_VENDOR_PAYMENT'
    const fulfillmentState = form.status === 'PROMISED' ? 'PENDING' : direct ? 'PAID_DIRECT' : inKind ? 'DELIVERED' : 'RECEIVED'
    const success = await mutate('/api/planner/contributions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      contributorId: form.contributorId || undefined,
      contributor: form.contributorId ? undefined : { displayName: form.contributorName, email: form.email, relationship: form.relationship, guestId: form.guestId || null },
      type: form.type, title: form.title, amount: form.amount ? Number(form.amount) : null, currency: form.currency,
      estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : null, estimatedValueCurrency: form.currency,
      quantity: form.quantity ? Number(form.quantity) : null, unit: form.unit || null,
      commitmentState: form.status === 'PROMISED' ? 'PLEDGED' : 'NOT_APPLICABLE', fulfillmentState,
      budgetItemId: form.budgetItemId || null, serviceEngagementId: form.serviceEngagementId || null,
      campaignId: form.campaignId || null, paymentReference: form.paymentReference || null,
      alreadyIncludedInBudgetPaid: form.alreadyIncludedInBudgetPaid, notes: form.notes,
    }) })
    if (success) { setAddOpen(false); setForm(INITIAL_FORM); toast({ title: 'Contribution saved', description: 'The help is recorded separately from what you personally paid.' }) }
  }

  async function contributionAction(action: string, extra: Record<string, unknown> = {}) {
    if (!manage) return
    const success = await mutate(`/api/planner/contributions/${manage.id}/actions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...extra }) })
    if (success) setManage(null)
  }

  async function createNotebookNote() {
    if (!manage || !workspace || !noteText.trim()) return
    setSaving(true)
    try {
      const response = await fetch('/api/notebook', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: `Contribution — ${manage.contributor.displayName}`, contentText: noteText.trim(), weddingId: workspace.weddingId, noteType: 'QUICK', visibility: 'PRIVATE', contextType: 'contribution' }) })
      const note = await response.json()
      if (!response.ok || note.success === false || !note.data?.id) throw new Error(note.error || 'Could not create Notebook note.')
      const linkResponse = await fetch(`/api/notebook/${note.data.id}/actions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add-link', entityType: 'WeddingContribution', entityId: manage.id, labelSnapshot: `${manage.contributor.displayName} — ${manage.title}` }) })
      const link = await linkResponse.json()
      if (!linkResponse.ok || link.success === false) throw new Error(link.error || 'The note was created but could not be linked.')
      setNoteText(''); toast({ title: 'Notebook note linked' })
    } catch (reason) { toast({ title: 'Notebook link failed', description: reason instanceof Error ? reason.message : undefined, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  async function createCampaign(event: React.FormEvent) {
    event.preventDefault()
    const success = await mutate('/api/planner/contribution-campaigns', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'HONEYMOON', title: campaignForm.title, description: campaignForm.description, targetAmount: campaignForm.targetAmount ? Number(campaignForm.targetAmount) : null, currency: campaignForm.currency, externalUrl: campaignForm.externalUrl || null }) })
    if (success) setCampaignForm({ title: '', description: '', targetAmount: '', currency: 'USD', externalUrl: '' })
  }

  async function patchCampaign(campaign: Campaign, patch: Record<string, unknown>) {
    await mutate(`/api/planner/contribution-campaigns/${campaign.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
  }

  async function classifyFunding(item: FundingItem, sourceKind: 'COUPLE' | 'CONTRIBUTION') {
    if (item.unattributed <= 0) return
    if (sourceKind === 'CONTRIBUTION' && !fundingContributionId) { toast({ title: 'Choose a contribution first', variant: 'destructive' }); return }
    await mutate('/api/planner/budget/funding', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ budgetItemId: item.id, sourceKind, amount: item.unattributed, contributionId: sourceKind === 'CONTRIBUTION' ? fundingContributionId : null }) })
  }

  if (loading && !workspace) return <div className="flex min-h-[60dvh] items-center justify-center bg-espresso text-gold"><Loader2 className="size-8 animate-spin" /></div>

  return <div className="min-h-screen bg-espresso text-champagne" data-testid="planner-contributions-workspace">
    <header className="sticky top-0 z-40 border-b border-gold/15 bg-espresso/95 px-3 py-2 backdrop-blur sm:px-5"><div className="mx-auto flex max-w-7xl items-center gap-3"><Button variant="ghost" size="sm" onClick={() => router.push('/planner/overview')} className="text-champagne/70"><ArrowLeft className="size-4" />Planner</Button><div className="min-w-0 flex-1"><p className="truncate text-[10px] uppercase tracking-[0.18em] text-gold">Contributions</p><p className="hidden text-xs text-champagne/40 sm:block">Money, vendor payments, goods, services and time</p></div><Button asChild variant="outline" size="sm" className="border-gold/20 bg-transparent text-champagne/70"><a href="/api/planner/contributions/export"><Download className="size-4" /><span className="hidden sm:inline">Export</span></a></Button><Button size="sm" onClick={() => setAddOpen(true)} className="bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Add</Button></div></header>

    <main className="mx-auto max-w-7xl space-y-5 px-3 py-5 sm:px-5 sm:py-7">
      {error && <div role="alert" className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay-light">{error}</div>}
      <div><h1 className="font-serif text-2xl sm:text-3xl">Who helped make this possible?</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-champagne/55">Record support in everyday language. Wewed keeps “paid” separate from “paid by us” so your budget tells the truth.</p></div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {(workspace?.summaryByCurrency ?? []).length === 0 ? (
          <Panel className="col-span-2 p-4 lg:col-span-4">
            <p className="text-sm text-champagne/55">No contributions yet. Add the first person, family or organisation that helped.</p>
          </Panel>
        ) : (
          workspace!.summaryByCurrency.flatMap((summary) => {
            const cards = [
              { label: 'Money received', value: summary.cashReceived, detail: 'Cash given to you', Icon: CircleDollarSign },
              { label: 'Paid direct', value: summary.directVendorPaid, detail: 'Paid straight to a vendor', Icon: Store },
              { label: 'In-kind value', value: summary.inKindValue, detail: 'Estimated non-cash help', Icon: Gift },
              { label: 'Still available', value: summary.availableCash, detail: 'Received cash not yet allocated', Icon: HandHeart },
            ]
            return cards.map(({ label, value, detail, Icon }) => (
              <Panel key={`${summary.currency}-${label}`} className="p-3 sm:p-4">
                <div className="flex items-center justify-between text-gold">
                  <p className="text-[9px] uppercase tracking-[0.12em] sm:text-[10px]">{label}</p>
                  <Icon className="size-4" />
                </div>
                <p className="mt-2 font-serif text-xl sm:text-2xl">{money(value, summary.currency)}</p>
                <p className="mt-1 text-[10px] leading-4 text-champagne/45">{detail} · {summary.currency}</p>
              </Panel>
            ))
          })
        )}
      </div>
      {(workspace?.summaryByCurrency ?? []).some((summary) => summary.pledged > 0) && <Panel className="p-3"><p className="text-xs text-champagne/60"><span className="font-semibold text-gold">Promised, not received:</span> {workspace!.summaryByCurrency.filter((item) => item.pledged > 0).map((item) => money(item.pledged,item.currency)).join(' · ')}. Promises never count as cash received.</p></Panel>}

      <Panel className="overflow-hidden"><div className="grid gap-2 border-b border-gold/10 p-3 sm:grid-cols-[1fr_13rem]"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-champagne/35" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search contributor, item, vendor or campaign" className="border-gold/20 bg-espresso/70 pl-9" /></div><select aria-label="Filter contributions" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="all">Everything</option><option value="pledged">Promised</option><option value="received">Received / delivered</option><option value="direct">Paid vendor directly</option><option value="in-kind">Goods / services / time</option><option value="thank">Needs a thank-you</option></select></div>
        {filtered.length === 0 ? <div className="p-8 text-center text-sm text-champagne/50">No contributions in this view.</div> : <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-gold/10 text-[10px] uppercase tracking-wider text-champagne/45"><tr><th className="p-3">Contributor</th><th className="p-3">Help</th><th className="p-3">Value</th><th className="p-3">State</th><th className="p-3">Where it went</th><th className="p-3"></th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id} className="border-b border-gold/10 last:border-0"><td className="p-3"><p className="font-medium">{item.contributor.displayName}</p><p className="text-xs text-champagne/45">{item.contributor.relationship || 'Contributor'}</p></td><td className="p-3"><p>{item.title}</p><p className="text-xs text-champagne/45">{CONTRIBUTION_TYPE_LABELS[item.type]}</p></td><td className="p-3">{item.amount !== null ? money(item.amount,item.currency) : item.estimatedValue !== null ? `${money(item.estimatedValue,item.estimatedValueCurrency || item.currency)} est.` : 'Not valued'}</td><td className="p-3"><Badge variant="outline" className="border-gold/25 text-champagne/75">{human(item.fulfillmentState)}</Badge></td><td className="p-3 text-champagne/60">{item.allocations[0]?.budgetItem.description || item.vendor?.name || item.campaign?.title || (item.availableAmount > 0 ? `${money(item.availableAmount,item.currency)} still available` : 'Not allocated')}</td><td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => { setManage(item); setTaskTitle(`Follow up contribution from ${item.contributor.displayName}`) }} className="border-gold/20 bg-transparent">Manage</Button></td></tr>)}</tbody></table></div><div className="space-y-2 p-3 md:hidden">{filtered.map((item) => <button key={item.id} type="button" onClick={() => { setManage(item); setTaskTitle(`Follow up contribution from ${item.contributor.displayName}`) }} className="w-full rounded-xl border border-gold/12 bg-espresso/45 p-3 text-left"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{item.contributor.displayName}</p><p className="mt-0.5 text-xs text-champagne/50">{item.title}</p></div><p className="shrink-0 font-serif text-base text-gold">{item.amount !== null ? money(item.amount,item.currency) : item.estimatedValue !== null ? `${money(item.estimatedValue,item.estimatedValueCurrency || item.currency)} est.` : '—'}</p></div><div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline" className="border-gold/25 text-[10px] text-champagne/70">{human(item.fulfillmentState)}</Badge><Badge variant="outline" className="border-champagne/15 text-[10px] text-champagne/55">{CONTRIBUTION_TYPE_LABELS[item.type]}</Badge></div></button>)}</div></>}
      </Panel>

      {funding.some((item) => item.unattributed > 0) && <Panel className="p-4"><div className="flex items-start gap-3"><CircleDollarSign className="mt-0.5 size-5 text-gold" /><div><h2 className="font-serif text-xl">Previous payments to classify</h2><p className="mt-1 text-xs leading-5 text-champagne/50">These amounts were already marked Paid before Wewed tracked who funded them. They stay “source not recorded” until you tell us—never automatically “paid by us”.</p></div></div><div className="mt-4 grid gap-2 lg:grid-cols-2">{funding.filter((item) => item.unattributed > 0).map((item) => <div key={item.id} className="rounded-xl border border-gold/12 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{item.description}</p><p className="text-xs text-champagne/45">Already paid: {money(item.paidAmount,item.currency)}</p></div><Badge variant="outline" className="border-clay/30 text-clay-light">{money(item.unattributed,item.currency)} source not recorded</Badge></div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={saving} onClick={() => void classifyFunding(item,'COUPLE')} className="border-gold/20 bg-transparent">Paid by us</Button><select aria-label={`Contribution funding ${item.description}`} value={fundingContributionId} onChange={(event) => setFundingContributionId(event.target.value)} className="h-9 min-w-44 rounded-md border border-gold/20 bg-espresso px-2 text-xs"><option value="">Choose contribution…</option>{workspace?.data.filter((contribution) => contribution.currency === item.currency && ['RECEIVED','PAID_DIRECT'].includes(contribution.fulfillmentState)).map((contribution) => <option key={contribution.id} value={contribution.id}>{contribution.contributor.displayName} — {contribution.title}</option>)}</select><Button size="sm" variant="outline" disabled={saving || !fundingContributionId} onClick={() => void classifyFunding(item,'CONTRIBUTION')} className="border-gold/20 bg-transparent">Paid by contributor</Button></div></div>)}</div></Panel>}

      <Panel className="p-4"><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"><div><p className="text-[10px] uppercase tracking-[0.16em] text-gold">Honeymoon & gifting</p><h2 className="mt-1 font-serif text-xl">Optional information, never a begging page</h2><p className="mt-1 text-xs leading-5 text-champagne/50">Create it privately first. Publication, invitation visibility, target and progress are separate choices. Contributor names and individual amounts stay private.</p>{workspace?.campaigns.length ? <div className="mt-4 space-y-2">{workspace.campaigns.map((campaign) => <div key={campaign.id} className="rounded-xl border border-gold/12 p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{campaign.title}</p><p className="text-xs text-champagne/45">{campaign.raised > 0 ? `${money(campaign.raised,campaign.currency)} recorded` : 'No received contributions yet'}</p></div><Badge variant="outline" className={campaign.published ? 'border-sage/40 text-sage-light' : 'border-gold/20 text-champagne/55'}>{campaign.published ? 'Published' : 'Private'}</Badge></div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void patchCampaign(campaign,{published:!campaign.published})} className="border-gold/20 bg-transparent">{campaign.published ? 'Unpublish' : 'Publish'}</Button><Button size="sm" variant="outline" onClick={() => void patchCampaign(campaign,{invitationVisible:!campaign.invitationVisible})} className="border-gold/20 bg-transparent">Invitation: {campaign.invitationVisible ? 'On' : 'Off'}</Button><Button size="sm" variant="outline" onClick={() => void patchCampaign(campaign,{showRaised:!campaign.showRaised})} className="border-gold/20 bg-transparent">Progress: {campaign.showRaised ? 'Shown' : 'Hidden'}</Button><Button size="sm" variant="outline" onClick={() => void patchCampaign(campaign,{showTarget:!campaign.showTarget})} className="border-gold/20 bg-transparent">Target: {campaign.showTarget ? 'Shown' : 'Hidden'}</Button></div></div>)}</div> : null}</div><form onSubmit={createCampaign} className="grid content-start gap-2 sm:grid-cols-2"><Input required value={campaignForm.title} onChange={(e) => setCampaignForm((c) => ({...c,title:e.target.value}))} placeholder="Honeymoon fund" className="border-gold/20 bg-espresso/70" /><Input inputMode="decimal" value={campaignForm.targetAmount} onChange={(e) => setCampaignForm((c) => ({...c,targetAmount:e.target.value}))} placeholder="Optional target" className="border-gold/20 bg-espresso/70" /><Input value={campaignForm.description} onChange={(e) => setCampaignForm((c) => ({...c,description:e.target.value}))} placeholder="A short, appreciative note" className="border-gold/20 bg-espresso/70 sm:col-span-2" /><Input value={campaignForm.externalUrl} onChange={(e) => setCampaignForm((c) => ({...c,externalUrl:e.target.value}))} placeholder="Optional HTTPS registry/payment link" className="border-gold/20 bg-espresso/70 sm:col-span-2" /><Button disabled={saving} className="bg-gold text-espresso sm:col-span-2">Create private campaign</Button></form></div></Panel>
    </main>

    {addOpen && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-2 backdrop-blur-sm sm:items-center"><button aria-label="Close add contribution" className="absolute inset-0" onClick={() => setAddOpen(false)} /><form onSubmit={addContribution} role="dialog" aria-modal="true" aria-label="Add contribution" className="relative z-10 max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gold/25 bg-espresso p-4 shadow-2xl sm:p-5"><div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[0.16em] text-gold">Add contribution</p><h2 className="mt-1 font-serif text-xl">Record the help, not accounting jargon</h2></div><Button type="button" variant="ghost" size="icon" onClick={() => setAddOpen(false)}><X className="size-4" /></Button></div><div className="mt-5 space-y-5">
      <fieldset><legend className="font-medium">1. Who contributed?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><select aria-label="Choose existing contributor" value={form.contributorId} onChange={(e) => setForm((c) => ({...c,contributorId:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">Add someone new</option>{workspace?.contributors.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select>{!form.contributorId && <Input required value={form.contributorName} onChange={(e) => setForm((c) => ({...c,contributorName:e.target.value}))} placeholder="Name or organisation" className="border-gold/20 bg-espresso/70" />}{!form.contributorId && <><Input type="email" value={form.email} onChange={(e) => setForm((c) => ({...c,email:e.target.value}))} placeholder="Email (optional)" className="border-gold/20 bg-espresso/70" /><Input value={form.relationship} onChange={(e) => setForm((c) => ({...c,relationship:e.target.value}))} placeholder="Relationship, e.g. Bride's aunt" className="border-gold/20 bg-espresso/70" /><select value={form.guestId} onChange={(e) => setForm((c) => ({...c,guestId:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm sm:col-span-2"><option value="">Not linked to guest list</option>{workspace?.options.guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.name}</option>)}</select></>}</div></fieldset>
      <fieldset><legend className="font-medium">2. What did they contribute?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><select value={form.type} onChange={(e) => setForm((c) => ({...c,type:e.target.value as ContributionType,serviceEngagementId:''}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">{Object.entries(CONTRIBUTION_TYPE_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><Input required value={form.title} onChange={(e) => setForm((c) => ({...c,title:e.target.value}))} placeholder="What did they help with?" className="border-gold/20 bg-espresso/70" />{['CASH_TO_COUPLE','DIRECT_VENDOR_PAYMENT','HONEYMOON_GIFT'].includes(form.type) ? <Input required inputMode="decimal" value={form.amount} onChange={(e) => setForm((c) => ({...c,amount:e.target.value}))} placeholder="Amount" className="border-gold/20 bg-espresso/70" /> : <Input inputMode="decimal" value={form.estimatedValue} onChange={(e) => setForm((c) => ({...c,estimatedValue:e.target.value}))} placeholder="Estimated value (optional)" className="border-gold/20 bg-espresso/70" />}<Input value={form.currency} maxLength={3} onChange={(e) => setForm((c) => ({...c,currency:e.target.value.toUpperCase()}))} placeholder="USD" className="border-gold/20 bg-espresso/70" />{['GOODS_IN_KIND','SERVICE_IN_KIND','TIME_LABOUR'].includes(form.type) && <><Input inputMode="decimal" value={form.quantity} onChange={(e) => setForm((c) => ({...c,quantity:e.target.value}))} placeholder="Quantity (optional)" className="border-gold/20 bg-espresso/70" /><Input value={form.unit} onChange={(e) => setForm((c) => ({...c,unit:e.target.value}))} placeholder="Unit, e.g. crates, hours" className="border-gold/20 bg-espresso/70" /></>}</div></fieldset>
      <fieldset><legend className="font-medium">3. Where is it going?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><select value={form.budgetItemId} onChange={(e) => { const item=workspace?.options.budgetItems.find((candidate)=>candidate.id===e.target.value); setForm((c)=>({...c,budgetItemId:e.target.value,serviceEngagementId:c.serviceEngagementId || item?.serviceEngagementId || ''})) }} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">Not allocated yet</option>{workspace?.options.budgetItems.map((item) => <option key={item.id} value={item.id}>{item.description}</option>)}</select>{form.type === 'DIRECT_VENDOR_PAYMENT' && <select required value={form.serviceEngagementId} onChange={(e) => setForm((c) => ({...c,serviceEngagementId:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">Choose vendor service engagement</option>{workspace?.options.engagements.map((item) => <option key={item.id} value={item.id}>{item.vendor.name} — {item.serviceCategory}</option>)}</select>}<select value={form.campaignId} onChange={(e) => setForm((c) => ({...c,campaignId:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">No honeymoon/campaign</option>{workspace?.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select></div></fieldset>
      <fieldset><legend className="font-medium">4. What is the current state?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><select value={form.status} onChange={(e) => setForm((c) => ({...c,status:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="PROMISED">Promised — not received yet</option><option value="RECEIVED">Received / paid / delivered</option></select>{form.type === 'DIRECT_VENDOR_PAYMENT' && <Input value={form.paymentReference} onChange={(e) => setForm((c) => ({...c,paymentReference:e.target.value}))} placeholder="Payment reference (optional)" className="border-gold/20 bg-espresso/70" />}{form.type === 'DIRECT_VENDOR_PAYMENT' && form.budgetItemId && <label className="flex items-start gap-2 rounded-lg border border-gold/15 p-3 text-xs text-champagne/60 sm:col-span-2"><Checkbox checked={form.alreadyIncludedInBudgetPaid} onCheckedChange={(checked) => setForm((c) => ({...c,alreadyIncludedInBudgetPaid:checked===true}))} /><span><strong className="text-champagne/80">This payment is already included in the Budget “Paid” amount.</strong><br/>Check this for historical payments so Wewed records who funded it without adding the amount again.</span></label>}<Textarea value={form.notes} onChange={(e) => setForm((c) => ({...c,notes:e.target.value}))} placeholder="Optional context" className="border-gold/20 bg-espresso/70 sm:col-span-2" /></div></fieldset>
      <div className="rounded-xl border border-gold/15 bg-gold/5 p-3 text-xs leading-5 text-champagne/60">A promise is never counted as money received. Direct vendor payments remain real vendor payments with the contributor recorded as the funding source. In-kind values stay separate from cash paid.</div><Button disabled={saving} className="w-full bg-gold text-espresso hover:bg-gold-light">{saving ? <Loader2 className="size-4 animate-spin" /> : <HandHeart className="size-4" />}Save contribution</Button>
    </div></form></div>}

    {manage && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-2 backdrop-blur-sm sm:items-center"><button aria-label="Close contribution details" className="absolute inset-0" onClick={() => setManage(null)} /><section role="dialog" aria-modal="true" aria-label="Manage contribution" className="relative z-10 max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gold/25 bg-espresso p-4 shadow-2xl sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.16em] text-gold">{manage.contributor.displayName}</p><h2 className="mt-1 font-serif text-xl">{manage.title}</h2><p className="mt-1 text-xs text-champagne/50">{CONTRIBUTION_TYPE_LABELS[manage.type]} · {human(manage.fulfillmentState)}</p></div><Button variant="ghost" size="icon" onClick={() => setManage(null)}><X className="size-4" /></Button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Panel className="p-3"><p className="text-[10px] uppercase text-champagne/40">Recorded value</p><p className="mt-1 font-serif text-xl">{manage.amount !== null ? money(manage.amount,manage.currency) : manage.estimatedValue !== null ? `${money(manage.estimatedValue,manage.estimatedValueCurrency || manage.currency)} est.` : 'Not valued'}</p></Panel><Panel className="p-3"><p className="text-[10px] uppercase text-champagne/40">Still available</p><p className="mt-1 font-serif text-xl">{money(manage.availableAmount,manage.currency)}</p></Panel></div>{manage.commitmentState === 'PLEDGED' && manage.fulfillmentState === 'PENDING' && manage.type !== 'DIRECT_VENDOR_PAYMENT' && <Button onClick={() => void contributionAction('mark-received')} disabled={saving} className="mt-4 bg-gold text-espresso">Mark received / delivered</Button>}{manage.availableAmount > 0 && <div className="mt-4 rounded-xl border border-gold/15 p-3"><h3 className="font-medium">Use some of this money</h3><p className="mt-1 text-xs text-champagne/50">This allocation records where received contribution money is intended to be used. It does not create a second payment.</p><div className="mt-2 grid gap-2 sm:grid-cols-[1fr_9rem_auto]"><select value={allocation.budgetItemId} onChange={(e) => setAllocation((c) => ({...c,budgetItemId:e.target.value}))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">Choose budget item</option>{workspace?.options.budgetItems.filter((item) => item.currency === manage.currency).map((item) => <option key={item.id} value={item.id}>{item.description}</option>)}</select><Input inputMode="decimal" value={allocation.amount} onChange={(e) => setAllocation((c) => ({...c,amount:e.target.value}))} placeholder="Amount" className="border-gold/20 bg-espresso/70" /><Button disabled={saving} onClick={() => void contributionAction('allocate',{budgetItemId:allocation.budgetItemId,amount:Number(allocation.amount)})} className="bg-gold text-espresso">Allocate</Button></div></div>}<div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-gold/15 p-3"><h3 className="font-medium">Follow-up task</h3><Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="mt-2 border-gold/20 bg-espresso/70" /><Button size="sm" disabled={saving} onClick={() => void contributionAction('create-task',{title:taskTitle})} className="mt-2 bg-gold text-espresso"><Plus className="size-3.5" />Create task</Button></div><div className="rounded-xl border border-gold/15 p-3"><h3 className="font-medium">Notebook context</h3><Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Capture a promise, detail or conversation…" className="mt-2 min-h-20 border-gold/20 bg-espresso/70" /><Button size="sm" variant="outline" disabled={saving || !noteText.trim()} onClick={() => void createNotebookNote()} className="mt-2 border-gold/20 bg-transparent"><NotebookPen className="size-3.5" />Save linked note</Button></div></div><div className="mt-4 flex flex-wrap items-center gap-2"><Button variant="outline" disabled={saving || manage.thankYouState === 'SENT'} onClick={() => void contributionAction('mark-thanked')} className="border-gold/20 bg-transparent"><Sparkles className="size-4" />{manage.thankYouState === 'SENT' ? 'Thank-you sent' : 'Mark thank-you sent'}</Button>{manage.allocations.length > 0 && <span className="text-xs text-champagne/45">Allocated: {manage.allocations.map((item) => `${item.budgetItem.description} ${money(item.amount,item.currency)}`).join(' · ')}</span>}</div></section></div>}
  </div>
}
