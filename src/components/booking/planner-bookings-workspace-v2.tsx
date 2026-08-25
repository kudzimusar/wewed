'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronDown, Clock3, DollarSign, FileSignature, Gift, Loader2, MessageCircle, RefreshCw, Store, Truck, XCircle } from 'lucide-react'

type BookingLine = { name?: string; quantity?: number; catalogItemId?: string; variantId?: string | null }
type WeddingBooking = {
  id: string; publicReference: string; businessAccountId: string; offeringId: string; status: string; bookingMode: string; currency: string; totalCents: number | null; depositCents: number | null; eventDate: string | null; serviceStart: string | null; serviceEnd: string | null; appointmentAt: string | null; serviceLocation: string | null; serviceEngagementId: string | null; confirmedAt: string | null; createdAt: string; updatedAt: string; providerSlug: string; providerName: string; category: string; lines: BookingLine[]
}
type Governance = { acceptedQuoteId?: string | null; quoteId?: string | null; quoteStatus?: string | null; quoteCurrency?: string | null; quoteSubtotalCents?: number | null; quoteFeesCents?: number | null; quoteDepositCents?: number | null; quoteTotalCents?: number | null; quoteNotes?: string | null; quoteProposedAt?: string | null; contractId?: string | null; contractNumber?: string | null; contractStatus?: string | null; currentVersionNumber?: number | null }
type CommercialContext = {
  bookingId: string
  serviceEngagementId: string | null
  logistics: { pickupAt: string | null; deliveryAt: string | null; setupStart: string | null; setupEnd: string | null; collectionAt: string | null; returnDueAt: string | null }
  budget: null | { id: string; estimatedCost: number; actualCost: number | null; paidAmount: number; currency: string; dueDate: string | null }
  contract: null | { id: string; contractNumber: string; status: string; currentVersionNumber: number }
  paymentMilestones: Array<{ id: string; milestoneType: string; label: string; amount: string; currency: string; dueAt: string | null; status: string; sequence: number }>
  paymentFacts: Array<{ id: string; entryType: string; amount: string; currency: string; paidAt: string; method: string | null; reference: string | null; source: string }>
  contributions: Array<{ id: string; type: string; title: string; amount: string | null; currency: string; estimatedValue: string | null; estimatedValueCurrency: string | null; commitmentState: string; fulfillmentState: string; verificationState: string; route: string; allocationAmount: string | null; allocationCurrency: string | null; allocationKind: string | null }>
  fundingAllocations: Array<{ id: string; sourceKind: string; amount: string; currency: string; contributionId: string | null; paymentId: string | null; reconciledAt: string | null }>
  conversationId: string | null
}

type Filter = 'all' | 'attention' | 'active' | 'completed'

function money(value: number | null | undefined, currency: string) {
  if (value == null) return 'Quote pending'
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value / 100) }
  catch { return `${currency} ${(value / 100).toFixed(2)}` }
}
function moneyMajor(value: number | string | null | undefined, currency: string) {
  if (value == null || value === '') return 'Not recorded'
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return `${currency} ${String(value)}`
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(parsed) }
  catch { return `${currency} ${parsed.toFixed(2)}` }
}
function dateLabel(value: string | null | undefined) {
  if (!value) return 'Date to be confirmed'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined }).format(date)
}
function human(value: string | null | undefined) { return value ? value.replaceAll('_', ' ').replaceAll('-', ' ') : 'Not recorded' }

const attentionStatuses = new Set(['draft','held','requested','quote_requested','quote_proposed','awaiting_vendor','awaiting_terms','awaiting_deposit'])
const activeStatuses = new Set(['confirmed','preparing','ready','in_progress','return_due','inspection'])
const cancellable = new Set(['draft','held','requested','quote_requested','quote_proposed','awaiting_vendor','awaiting_terms','awaiting_deposit'])

export function PlannerBookingsWorkspaceV2() {
  const [bookings, setBookings] = useState<WeddingBooking[]>([])
  const [governance, setGovernance] = useState<Record<string, Governance>>({})
  const [commercial, setCommercial] = useState<Record<string, CommercialContext>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [bookingResponse, commercialResponse] = await Promise.all([
        fetch('/api/bookings', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/bookings/commercial-context', { credentials: 'include', cache: 'no-store' }),
      ])
      const bookingPayload = await bookingResponse.json() as { success?: boolean; data?: WeddingBooking[]; error?: string }
      const commercialPayload = await commercialResponse.json() as { success?: boolean; data?: CommercialContext[]; error?: string }
      if (!bookingResponse.ok || !bookingPayload.success || !bookingPayload.data) throw new Error(bookingPayload.error || 'Unable to load bookings.')
      if (!commercialResponse.ok || !commercialPayload.success || !commercialPayload.data) throw new Error(commercialPayload.error || 'Unable to load booking payment and funding context.')
      setBookings(bookingPayload.data)
      setCommercial(Object.fromEntries(commercialPayload.data.map((entry) => [entry.bookingId, entry])))
      const governed = bookingPayload.data.filter((booking) => ['quote_proposed','awaiting_terms','awaiting_deposit','confirmed'].includes(booking.status) || booking.serviceEngagementId)
      const results = await Promise.all(governed.map(async (booking) => {
        const detail = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}/terms`, { credentials: 'include', cache: 'no-store' })
        const detailPayload = await detail.json().catch(() => ({})) as { success?: boolean; data?: Governance }
        return [booking.id, detail.ok && detailPayload.success ? detailPayload.data ?? {} : {}] as const
      }))
      setGovernance(Object.fromEntries(results))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load bookings.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const counts = useMemo(() => ({
    attention: bookings.filter((booking) => attentionStatuses.has(booking.status)).length,
    active: bookings.filter((booking) => activeStatuses.has(booking.status)).length,
    completed: bookings.filter((booking) => booking.status === 'completed').length,
  }), [bookings])

  const visible = useMemo(() => bookings.filter((booking) => {
    if (filter === 'attention') return attentionStatuses.has(booking.status)
    if (filter === 'active') return activeStatuses.has(booking.status)
    if (filter === 'completed') return booking.status === 'completed'
    return true
  }), [bookings, filter])

  async function postAction(bookingId: string, endpoint: string, body: Record<string, unknown> = {}) {
    if (busyId) return
    setBusyId(bookingId); setError('')
    try {
      const response = await fetch(endpoint, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const payload = await response.json() as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to update booking.')
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update booking.') }
    finally { setBusyId('') }
  }

  return <main className="min-h-dvh bg-[#f7f2ea] px-3 py-4 text-[#211a15] sm:px-6 sm:py-7">
    <div className="mx-auto max-w-7xl">
      <div className="flex items-center justify-between gap-3"><Link href="/planner/marketplace" className="inline-flex items-center gap-2 text-sm font-semibold text-[#8b6b31]"><ArrowLeft className="size-4" /> Marketplace</Link><button onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#ddcfbd] bg-white px-3 text-sm font-semibold disabled:opacity-60"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button></div>

      <header className="mt-4 flex flex-col gap-4 border-b border-[#e5d9ca] pb-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#9a7938]">Wedding order book</p><h1 className="mt-1 font-serif text-4xl sm:text-5xl">Bookings</h1><p className="mt-2 max-w-2xl text-xs leading-5 text-[#75695d]">Triage the next action first. Payment, funding and contract evidence stay available without dominating every card.</p></div><div className="grid grid-cols-3 gap-2"><Stat label="Needs action" value={counts.attention} /><Stat label="Active" value={counts.active} /><Stat label="Done" value={counts.completed} /></div></header>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{([['all','All'],['attention','Needs action'],['active','Active'],['completed','Completed']] as Array<[Filter,string]>).map(([value,label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold ${filter === value ? 'bg-[#211a15] text-white' : 'border border-[#ded1bf] bg-white text-[#66594e]'}`}>{label}</button>)}<Link href="/vendors" className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#ded1bf] bg-white px-3 py-2 text-xs font-semibold text-[#66594e]"><Store className="size-3.5" /> Find vendor</Link></div>

      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
      {loading && bookings.length === 0 ? <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-[#e5d9ca] bg-white p-8 text-sm text-[#74685d]"><Loader2 className="size-5 animate-spin" /> Loading bookings…</div> : null}
      {!loading && bookings.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-[#d9cbb7] bg-white p-8 text-center"><CalendarDays className="mx-auto size-7 text-[#9a7938]" /><h2 className="mt-3 font-serif text-3xl">No marketplace bookings yet</h2><Link href="/vendors" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#211a15] px-4 text-sm font-bold text-white"><Store className="size-4" /> Browse vendors</Link></div> : null}

      <div className="mt-4 space-y-3">{visible.map((booking) => {
        const date = booking.serviceStart || booking.appointmentAt || booking.eventDate
        const terms = governance[booking.id] ?? {}
        const context = commercial[booking.id]
        const quoteCurrency = terms.quoteCurrency || booking.currency
        const contract = context?.contract ?? (terms.contractId ? { id: terms.contractId, contractNumber: terms.contractNumber || 'Governed contract', status: terms.contractStatus || 'DRAFT', currentVersionNumber: terms.currentVersionNumber || 1 } : null)
        const logisticsRows = context?.logistics ? [['Pickup', context.logistics.pickupAt],['Delivery', context.logistics.deliveryAt],['Setup', context.logistics.setupStart],['Collection', context.logistics.collectionAt],['Return', context.logistics.returnDueAt]].filter((entry): entry is [string,string] => Boolean(entry[1])) : []
        return <article key={booking.id} className="overflow-hidden rounded-2xl border border-[#e2d5c4] bg-white shadow-[0_8px_24px_rgba(44,31,18,.04)]">
          <div className="p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusPill status={booking.status} /><span className="text-[10px] font-medium text-[#988b7d]">{booking.publicReference}</span></div><h2 className="mt-2 truncate font-serif text-2xl sm:text-3xl">{booking.providerName}</h2><p className="mt-0.5 text-xs text-[#75695d]">{human(booking.category)} · {human(booking.bookingMode)}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#5f554b]">{booking.lines?.[0] ? <span className="font-semibold">{booking.lines[0].name || 'Service'}{booking.lines[0].quantity ? ` × ${booking.lines[0].quantity}` : ''}</span> : null}<span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5 text-[#9a7938]" />{dateLabel(date)}</span>{booking.serviceLocation ? <span className="truncate">{booking.serviceLocation}</span> : null}</div></div><div className="flex shrink-0 items-center justify-between gap-3 rounded-xl bg-[#f7f2eb] px-3 py-2 sm:block sm:min-w-40 sm:text-right"><span className="text-[10px] uppercase tracking-[.08em] text-[#897b6d]">Booking value</span><div className="text-sm font-bold text-[#211a15] sm:mt-1">{money(booking.totalCents, booking.currency)}</div></div></div>
            <div className="mt-3 flex flex-wrap gap-2"><Link href={`/vendors/${encodeURIComponent(booking.providerSlug)}`} className="rounded-lg border border-[#ded1bf] px-3 py-2 text-xs font-semibold text-[#65574b]">Vendor</Link>{context?.conversationId ? <Link href={`/messages?conversation=${encodeURIComponent(context.conversationId)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#ded1bf] px-3 py-2 text-xs font-semibold text-[#65574b]"><MessageCircle className="size-3.5" /> Messages</Link> : null}{contract?.id ? <Link href={`/planner/contracts/${encodeURIComponent(contract.id)}/governance`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#ded1bf] px-3 py-2 text-xs font-semibold text-[#65574b]"><FileSignature className="size-3.5" /> Contract</Link> : null}</div>
          </div>

          {booking.status === 'quote_proposed' ? <div className="border-t border-[#eadfce] bg-[#fff8e9] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#9a7938]">Decision needed · vendor quote</p><div className="mt-1 flex flex-wrap gap-3 text-xs text-[#62564b]"><span>Total <strong>{money(terms.quoteTotalCents, quoteCurrency)}</strong></span>{terms.quoteDepositCents != null ? <span>Deposit <strong>{money(terms.quoteDepositCents, quoteCurrency)}</strong></span> : null}</div>{terms.quoteNotes ? <p className="mt-1 line-clamp-2 text-xs text-[#7a6e62]">{terms.quoteNotes}</p> : null}</div><button disabled={busyId === booking.id || !terms.quoteId} onClick={() => void postAction(booking.id, `/api/bookings/${encodeURIComponent(booking.id)}/quote/accept`, { quoteId: terms.quoteId })} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#211a15] px-4 text-xs font-bold text-white disabled:opacity-50">{busyId === booking.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Accept quote</button></div><p className="mt-2 text-[10px] leading-4 text-[#8a7c6f]">Quote acceptance is not contract acceptance and does not record payment.</p></div> : null}

          {booking.status === 'awaiting_terms' ? <div className="border-t border-[#eadfce] bg-amber-50 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-amber-900">Contract effectivity required</p><p className="mt-1 text-xs leading-5 text-amber-900/70">Complete the governed agreement before confirmation.</p></div><div className="flex gap-2">{contract?.id ? <Link href={`/planner/contracts/${encodeURIComponent(contract.id)}/governance`} className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900">Open contract</Link> : null}<button disabled={busyId === booking.id} onClick={() => void postAction(booking.id, `/api/bookings/${encodeURIComponent(booking.id)}/terms`)} className="rounded-xl bg-[#211a15] px-3 py-2 text-xs font-bold text-white">Check terms</button></div></div></div> : null}

          {booking.status === 'awaiting_deposit' ? <div className="border-t border-[#eadfce] bg-blue-50 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-blue-950">Deposit evidence required</p><p className="mt-1 text-xs leading-5 text-blue-900/70">Wewed confirms only from canonical payment records, never from booking status.</p></div><button disabled={busyId === booking.id} onClick={() => void postAction(booking.id, `/api/bookings/${encodeURIComponent(booking.id)}/deposit`)} className="rounded-xl bg-[#211a15] px-3 py-2 text-xs font-bold text-white">Check recorded deposit</button></div></div> : null}

          <details className="group border-t border-[#eadfce]"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-bold text-[#5d5146] sm:px-5"><span>Commercial & operational details</span><ChevronDown className="size-4 transition group-open:rotate-180" /></summary><div className="grid gap-3 border-t border-[#f0e7dc] bg-[#fcfaf7] p-4 sm:p-5 lg:grid-cols-2">
            <DetailPanel icon={<DollarSign className="size-4" />} title="Budget & payments">{context?.budget ? <div className="grid grid-cols-2 gap-2 text-xs"><KV label="Estimate" value={moneyMajor(context.budget.estimatedCost, context.budget.currency)} /><KV label="Actual" value={context.budget.actualCost == null ? 'Not recorded' : moneyMajor(context.budget.actualCost, context.budget.currency)} /><KV label="Paid field" value={moneyMajor(context.budget.paidAmount, context.budget.currency)} /><KV label="Due" value={context.budget.dueDate ? dateLabel(context.budget.dueDate) : 'Not recorded'} /></div> : <Empty text="No Budget commitment yet." />}{context?.paymentMilestones.length ? <div className="mt-3 border-t border-[#ece1d4] pt-2 text-xs"><strong>Planned obligations</strong>{context.paymentMilestones.map((row) => <p key={row.id} className="mt-1 text-[#75695d]">{row.label} · {moneyMajor(row.amount, row.currency)} · {human(row.status)}</p>)}</div> : null}{context?.paymentFacts.length ? <div className="mt-3 border-t border-[#ece1d4] pt-2 text-xs"><strong>Payment facts</strong>{context.paymentFacts.map((row) => <p key={row.id} className="mt-1 text-[#75695d]">{human(row.entryType)} · {moneyMajor(row.amount, row.currency)} · {dateLabel(row.paidAt)}</p>)}</div> : <p className="mt-2 text-[10px] text-[#8e8174]">No factual payment record. Booking status never proves payment.</p>}<Link href="/planner/budget" className="mt-3 inline-flex text-xs font-semibold text-[#88672d] underline">Open Budget</Link></DetailPanel>
            <DetailPanel icon={<Gift className="size-4" />} title="Contributions & funding">{context?.contributions.length ? context.contributions.map((row) => <div key={row.id} className="mb-2 rounded-lg bg-[#f6f0e8] p-2 text-xs"><strong>{row.title}</strong><p className="mt-1 text-[#74685d]">{human(row.type)} · {human(row.commitmentState)} / {human(row.fulfillmentState)}</p><p className="mt-1">{row.allocationAmount ? `Allocated ${moneyMajor(row.allocationAmount, row.allocationCurrency || row.currency)}` : row.amount ? moneyMajor(row.amount, row.currency) : row.estimatedValue ? `Estimated ${moneyMajor(row.estimatedValue, row.estimatedValueCurrency || row.currency)}` : 'No value recorded'}</p></div>) : <Empty text="No contribution linked to this booking." />}{context?.fundingAllocations.length ? <p className="mt-2 text-[10px] text-[#75695d]">{context.fundingAllocations.length} reconciled/unreconciled funding allocation record(s).</p> : <p className="mt-2 text-[10px] text-[#8e8174]">No reconciled funding allocation.</p>}<Link href="/planner/contributions" className="mt-3 inline-flex text-xs font-semibold text-[#88672d] underline">Open Contributions</Link></DetailPanel>
            <DetailPanel icon={<FileSignature className="size-4" />} title="Agreement">{contract ? <><p className="text-sm font-semibold">{contract.contractNumber}</p><p className="mt-1 text-xs text-[#74685d]">{human(contract.status)} · version {contract.currentVersionNumber}</p><Link href={`/planner/contracts/${encodeURIComponent(contract.id)}/governance`} className="mt-3 inline-flex text-xs font-semibold text-[#88672d] underline">Open agreement</Link></> : <Empty text="No governed contract linked." />}</DetailPanel>
            <DetailPanel icon={<Truck className="size-4" />} title="Operations">{logisticsRows.length ? <div className="grid grid-cols-2 gap-2">{logisticsRows.map(([label,value]) => <KV key={label} label={label} value={dateLabel(value)} />)}</div> : <Empty text="No pickup, delivery, setup, collection or return dates recorded." />}{context?.conversationId ? <Link href={`/messages?conversation=${encodeURIComponent(context.conversationId)}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#88672d] underline"><MessageCircle className="size-3.5" /> Booking conversation</Link> : null}</DetailPanel>
            {cancellable.has(booking.status) ? <div className="lg:col-span-2 border-t border-[#eadfce] pt-3"><button disabled={busyId === booking.id} onClick={() => void postAction(booking.id, `/api/bookings/${encodeURIComponent(booking.id)}/cancel`, { reason: 'Cancelled from wedding order book' })} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 disabled:opacity-50"><XCircle className="size-4" /> Cancel before governed commitment</button></div> : null}
          </div></details>
        </article>
      })}</div>
    </div>
  </main>
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="min-w-20 rounded-xl border border-[#e0d3c2] bg-white px-3 py-2"><div className="text-[9px] font-bold uppercase tracking-[.08em] text-[#8b7d70]">{label}</div><div className="mt-0.5 text-xl font-bold text-[#211a15]">{value}</div></div> }
function StatusPill({ status }: { status: string }) {
  const attention = attentionStatuses.has(status)
  const active = activeStatuses.has(status)
  return <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] ${attention ? 'bg-amber-100 text-amber-900' : active ? 'bg-emerald-100 text-emerald-800' : status === 'completed' ? 'bg-slate-100 text-slate-700' : 'bg-[#eee7dc] text-[#65584c]'}`}>{human(status)}</span>
}
function DetailPanel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <section className="rounded-xl border border-[#e6dacb] bg-white p-3"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.1em] text-[#8d6b30]">{icon}{title}</div><div className="mt-3">{children}</div></section> }
function KV({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-[#f7f2eb] p-2 text-xs"><div className="text-[9px] uppercase tracking-[.06em] text-[#8b7d70]">{label}</div><div className="mt-1 font-semibold text-[#3b3129]">{value}</div></div> }
function Empty({ text }: { text: string }) { return <p className="text-xs leading-5 text-[#85786c]">{text}</p> }
