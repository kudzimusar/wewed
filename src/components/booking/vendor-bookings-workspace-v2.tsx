'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronDown, FileSignature, Loader2, MessageCircle, PackageCheck, RefreshCw, Send, XCircle } from 'lucide-react'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

type BookingLine = { name?: string; quantity?: number }
type VendorBooking = {
  id: string; publicReference: string; weddingId: string; status: string; bookingMode: string; currency: string; totalCents: number | null; depositCents: number | null; eventDate: string | null; serviceStart: string | null; serviceEnd: string | null; appointmentAt: string | null; serviceLocation: string | null; guestCount: number | null; customerNotes: string | null; serviceEngagementId: string | null; createdAt: string; updatedAt: string; weddingTitle: string; category: string; lines: BookingLine[]
}
type ApiPayload = { business: { businessAccountId: string; businessName: string }; bookings: VendorBooking[] }
type QuoteDraft = { subtotal: string; fees: string; deposit: string; currency: string; notes: string }
type Filter = 'all' | 'attention' | 'active' | 'completed'

const actionLabels: Record<string, string> = { approve: 'Approve', decline: 'Decline', preparing: 'Preparing', ready: 'Ready', in_progress: 'Start service', return_due: 'Return due', inspection: 'Inspection', completed: 'Complete' }
const attentionStatuses = new Set(['requested','quote_requested','quote_proposed','awaiting_vendor','awaiting_terms','awaiting_deposit'])
const activeStatuses = new Set(['confirmed','preparing','ready','in_progress','return_due','inspection'])

function actionsFor(status: string) {
  if (['requested', 'awaiting_vendor'].includes(status)) return ['approve', 'decline']
  if (['quote_requested', 'quote_proposed', 'awaiting_terms', 'awaiting_deposit'].includes(status)) return ['decline']
  if (status === 'confirmed') return ['preparing', 'in_progress']
  if (status === 'preparing') return ['ready', 'in_progress']
  if (status === 'ready') return ['in_progress']
  if (status === 'in_progress') return ['return_due', 'inspection', 'completed']
  if (status === 'return_due') return ['inspection', 'completed']
  if (status === 'inspection') return ['completed']
  return []
}

function money(value: number | null, currency: string) {
  if (value == null) return 'Quote required'
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value / 100) }
  catch { return `${currency} ${(value / 100).toFixed(2)}` }
}
function dateLabel(value: string | null) {
  if (!value) return 'Date to be confirmed'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined }).format(date)
}
function human(value: string) { return value.replaceAll('_', ' ').replaceAll('-', ' ') }
function toCents(value: string, optional = false) {
  const trimmed = value.trim()
  if (optional && !trimmed) return null
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) throw new Error('Enter money as a positive amount with at most two decimal places.')
  const [whole, decimal = ''] = trimmed.split('.')
  return Number(whole) * 100 + Number(decimal.padEnd(2, '0'))
}

export function VendorBookingsWorkspaceV2() {
  const [data, setData] = useState<ApiPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [quoteDrafts, setQuoteDrafts] = useState<Record<string, QuoteDraft>>({})

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/vendor/bookings', { credentials: 'include', cache: 'no-store' })
      const payload = await response.json() as { success?: boolean; data?: ApiPayload; error?: string }
      if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error || 'Unable to load bookings.')
      setData(payload.data)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load bookings.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const counts = useMemo(() => {
    const rows = data?.bookings ?? []
    return { attention: rows.filter((row) => attentionStatuses.has(row.status)).length, active: rows.filter((row) => activeStatuses.has(row.status)).length, completed: rows.filter((row) => row.status === 'completed').length }
  }, [data])

  const visible = useMemo(() => (data?.bookings ?? []).filter((booking) => {
    if (filter === 'attention') return attentionStatuses.has(booking.status)
    if (filter === 'active') return activeStatuses.has(booking.status)
    if (filter === 'completed') return booking.status === 'completed'
    return true
  }), [data, filter])

  function quoteDraft(booking: VendorBooking): QuoteDraft {
    return quoteDrafts[booking.id] ?? { subtotal: booking.totalCents == null ? '' : (booking.totalCents / 100).toFixed(2), fees: '0.00', deposit: booking.depositCents == null ? '' : (booking.depositCents / 100).toFixed(2), currency: booking.currency || 'USD', notes: '' }
  }
  function changeQuote(booking: VendorBooking, patch: Partial<QuoteDraft>) { setQuoteDrafts((current) => ({ ...current, [booking.id]: { ...quoteDraft(booking), ...patch } })) }

  async function act(bookingId: string, action: string) {
    if (busyId) return
    setBusyId(bookingId); setError('')
    try {
      const response = await fetch(`/api/vendor/bookings/${encodeURIComponent(bookingId)}/action`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) })
      const payload = await response.json() as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to update booking.')
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update booking.') }
    finally { setBusyId('') }
  }

  async function proposeQuote(booking: VendorBooking) {
    if (busyId) return
    setBusyId(booking.id); setError('')
    try {
      const draft = quoteDraft(booking)
      const response = await fetch(`/api/vendor/bookings/${encodeURIComponent(booking.id)}/quote`, {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subtotalCents: toCents(draft.subtotal), feesCents: toCents(draft.fees || '0'), depositCents: toCents(draft.deposit, true), currency: draft.currency.trim().toUpperCase(), notes: draft.notes }),
      })
      const payload = await response.json() as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to propose quote.')
      setQuoteDrafts((current) => { const next = { ...current }; delete next[booking.id]; return next })
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to propose quote.') }
    finally { setBusyId('') }
  }

  return <DashboardAuthGate allowedRoles={['vendor']} wrongRoleMessage="This workspace is available to approved Wewed Vendor accounts." title="Vendor bookings" description="Sign in as an approved Vendor owner to manage booking requests and fulfilment." onClose={() => window.location.assign('/vendor')}>
    <main className="min-h-dvh bg-[#f7f2ea] px-3 py-4 text-[#211a15] sm:px-6 sm:py-7">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-3"><Link href="/vendor" className="inline-flex items-center gap-2 text-sm font-semibold text-[#8b6b31]"><ArrowLeft className="size-4" /> Vendor workspace</Link><button onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#ddcfbd] bg-white px-3 text-sm font-semibold disabled:opacity-60"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button></div>

        <header className="mt-4 flex flex-col gap-4 border-b border-[#e5d9ca] pb-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#9a7938]">Booking operations</p><h1 className="mt-1 font-serif text-4xl sm:text-5xl">{data?.business.businessName || 'Vendor'} inbox</h1><p className="mt-2 max-w-2xl text-xs leading-5 text-[#75695d]">See the decision or fulfilment action first. Quotes and operational detail stay one tap away instead of filling the screen.</p></div><div className="grid grid-cols-3 gap-2"><Stat label="Needs action" value={counts.attention} /><Stat label="Active" value={counts.active} /><Stat label="Done" value={counts.completed} /></div></header>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{([['all','All'],['attention','Needs action'],['active','Active'],['completed','Completed']] as Array<[Filter,string]>).map(([value,label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold ${filter === value ? 'bg-[#211a15] text-white' : 'border border-[#ded1bf] bg-white text-[#66594e]'}`}>{label}</button>)}<Link href="/messages" className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#ded1bf] bg-white px-3 py-2 text-xs font-semibold text-[#66594e]"><MessageCircle className="size-3.5" /> Open Messages</Link></div>

        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        {loading && !data ? <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-[#e5d9ca] bg-white p-8 text-sm text-[#74685d]"><Loader2 className="size-5 animate-spin" /> Loading bookings…</div> : null}
        {!loading && data && data.bookings.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-[#d9cbb7] bg-white p-8 text-center"><CalendarDays className="mx-auto size-7 text-[#9a7938]" /><h2 className="mt-3 font-serif text-3xl">No booking requests yet</h2><p className="mt-2 text-sm text-[#75695d]">Published catalogue items will appear here when a couple or planner sends a request.</p></div> : null}

        <div className="mt-4 space-y-3">{visible.map((booking) => {
          const actions = actionsFor(booking.status)
          const date = booking.serviceStart || booking.appointmentAt || booking.eventDate
          const draft = quoteDraft(booking)
          const primary = actions.find((action) => action !== 'decline')
          return <article key={booking.id} className="overflow-hidden rounded-2xl border border-[#e2d5c4] bg-white shadow-[0_8px_24px_rgba(44,31,18,.04)]">
            <div className="p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusPill status={booking.status} /><span className="text-[10px] font-medium text-[#988b7d]">{booking.publicReference}</span></div><h2 className="mt-2 truncate font-serif text-2xl sm:text-3xl">{booking.weddingTitle || 'Wedding booking'}</h2><p className="mt-0.5 text-xs text-[#75695d]">{human(booking.category)} · {human(booking.bookingMode)}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#5f554b]">{booking.lines?.[0] ? <span className="font-semibold">{booking.lines[0].name || 'Service'}{booking.lines[0].quantity ? ` × ${booking.lines[0].quantity}` : ''}</span> : null}<span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5 text-[#9a7938]" />{dateLabel(date)}</span>{booking.serviceLocation ? <span className="truncate">{booking.serviceLocation}</span> : null}{booking.guestCount != null ? <span>{booking.guestCount} guests</span> : null}</div></div><div className="flex shrink-0 items-center justify-between gap-3 rounded-xl bg-[#f7f2eb] px-3 py-2 sm:block sm:min-w-40 sm:text-right"><span className="text-[10px] uppercase tracking-[.08em] text-[#897b6d]">Commercial value</span><div className="text-sm font-bold text-[#211a15] sm:mt-1">{money(booking.totalCents, booking.currency)}</div></div></div>
              {booking.customerNotes ? <div className="mt-3 rounded-xl bg-[#faf6f0] px-3 py-2 text-xs leading-5 text-[#65594e]"><strong>Customer note:</strong> {booking.customerNotes}</div> : null}
              <div className="mt-3 flex flex-wrap gap-2"><Link href="/messages" className="inline-flex items-center gap-1.5 rounded-lg border border-[#ded1bf] px-3 py-2 text-xs font-semibold text-[#65574b]"><MessageCircle className="size-3.5" /> Open Messages</Link>{booking.status === 'awaiting_terms' ? <Link href="/vendor/documents" className="inline-flex items-center gap-1.5 rounded-lg border border-[#ded1bf] px-3 py-2 text-xs font-semibold text-[#65574b]"><FileSignature className="size-3.5" /> Contract</Link> : null}{booking.serviceEngagementId ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"><CheckCircle2 className="size-3.5" /> Engagement linked</span> : null}</div>
            </div>

            {booking.status === 'quote_requested' ? <details className="group border-t border-[#eadfce] bg-[#fff8e9]"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4"><span><span className="block text-[10px] font-bold uppercase tracking-[.12em] text-[#9a7938]">Decision needed</span><span className="mt-1 block text-sm font-bold text-[#3a2e24]">Create commercial quote</span><span className="mt-1 block text-xs text-[#786b5f]">Open only when you are ready to enter price and deposit terms.</span></span><ChevronDown className="size-4 transition group-open:rotate-180" /></summary><div className="border-t border-[#ead8b6] p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><QuoteInput label="Subtotal" value={draft.subtotal} set={(value) => changeQuote(booking, { subtotal: value })} /><QuoteInput label="Fees" value={draft.fees} set={(value) => changeQuote(booking, { fees: value })} /><QuoteInput label="Deposit (optional)" value={draft.deposit} set={(value) => changeQuote(booking, { deposit: value })} /><label className="text-xs font-semibold text-[#4a3c31]">Currency<input value={draft.currency} onChange={(event) => changeQuote(booking, { currency: event.target.value.toUpperCase().slice(0, 3) })} maxLength={3} className="mt-1 min-h-10 w-full rounded-lg border border-[#ddcfbd] bg-white px-3 text-sm font-normal uppercase" /></label></div><label className="mt-3 block text-xs font-semibold text-[#4a3c31]">Quote notes<textarea value={draft.notes} onChange={(event) => changeQuote(booking, { notes: event.target.value })} rows={2} placeholder="Scope, assumptions or expiry notes…" className="mt-1 w-full rounded-lg border border-[#ddcfbd] bg-white px-3 py-2 text-sm font-normal" /></label><p className="mt-2 text-[10px] leading-4 text-[#85776b]">The customer must accept the quote separately. A quote is not a contract and is not payment evidence.</p><button disabled={busyId === booking.id} onClick={() => void proposeQuote(booking)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#211a15] px-4 text-xs font-bold text-white disabled:opacity-50">{busyId === booking.id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send quote</button></div></details> : null}

            {booking.status === 'awaiting_terms' ? <div className="border-t border-[#eadfce] bg-amber-50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-amber-950">Waiting for governed agreement</p><p className="mt-1 text-xs text-amber-900/70">Do not confirm work until the required contract becomes effective.</p></div><Link href="/vendor/documents" className="shrink-0 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900">Open contract</Link></div></div> : null}

            {booking.status === 'awaiting_deposit' ? <div className="border-t border-[#eadfce] bg-blue-50 p-4"><p className="text-xs font-bold text-blue-950">Waiting for deposit evidence</p><p className="mt-1 text-xs leading-5 text-blue-900/70">Wewed confirms from factual payment records. The vendor cannot mark a deposit paid from this inbox.</p></div> : null}

            {primary ? <div className="flex flex-wrap items-center gap-2 border-t border-[#eadfce] bg-[#fcfaf7] p-3 sm:px-4"><span className="mr-auto text-[10px] font-bold uppercase tracking-[.1em] text-[#8b7d70]">Next action</span><button disabled={busyId === booking.id} onClick={() => void act(booking.id, primary)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#211a15] px-3 text-xs font-bold text-white disabled:opacity-50">{busyId === booking.id ? <Loader2 className="size-3.5 animate-spin" /> : <PackageCheck className="size-3.5" />}{actionLabels[primary] || human(primary)}</button>{actions.includes('decline') ? <button disabled={busyId === booking.id} onClick={() => void act(booking.id, 'decline')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 disabled:opacity-50"><XCircle className="size-3.5" /> Decline</button> : null}</div> : actions.includes('decline') ? <div className="flex justify-end border-t border-[#eadfce] bg-[#fcfaf7] p-3"><button disabled={busyId === booking.id} onClick={() => void act(booking.id, 'decline')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 disabled:opacity-50"><XCircle className="size-3.5" /> Decline</button></div> : null}

            <details className="group border-t border-[#eadfce]"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-bold text-[#5d5146]"><span>Booking details</span><ChevronDown className="size-4 transition group-open:rotate-180" /></summary><div className="grid gap-2 border-t border-[#f0e7dc] bg-[#fcfaf7] p-4 text-xs sm:grid-cols-2 lg:grid-cols-4"><KV label="Created" value={dateLabel(booking.createdAt)} /><KV label="Updated" value={dateLabel(booking.updatedAt)} /><KV label="Deposit" value={booking.depositCents == null ? 'Not stated' : money(booking.depositCents, booking.currency)} /><KV label="Status" value={human(booking.status)} />{booking.lines.slice(1).map((line, index) => <KV key={`${booking.id}-line-${index}`} label="Additional service" value={`${line.name || 'Service'}${line.quantity ? ` × ${line.quantity}` : ''}`} />)}</div></details>
          </article>
        })}</div>
      </div>
    </main>
  </DashboardAuthGate>
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="min-w-20 rounded-xl border border-[#e0d3c2] bg-white px-3 py-2"><div className="text-[9px] font-bold uppercase tracking-[.08em] text-[#8b7d70]">{label}</div><div className="mt-0.5 text-xl font-bold text-[#211a15]">{value}</div></div> }
function StatusPill({ status }: { status: string }) { const attention = attentionStatuses.has(status); const active = activeStatuses.has(status); return <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] ${attention ? 'bg-amber-100 text-amber-900' : active ? 'bg-emerald-100 text-emerald-800' : status === 'completed' ? 'bg-slate-100 text-slate-700' : 'bg-[#eee7dc] text-[#65584c]'}`}>{human(status)}</span> }
function QuoteInput({ label, value, set }: { label: string; value: string; set: (value: string) => void }) { return <label className="text-xs font-semibold text-[#4a3c31]">{label}<input value={value} onChange={(event) => set(event.target.value)} inputMode="decimal" placeholder="0.00" className="mt-1 min-h-10 w-full rounded-lg border border-[#ddcfbd] bg-white px-3 text-sm font-normal" /></label> }
function KV({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-white p-2"><div className="text-[9px] uppercase tracking-[.06em] text-[#8b7d70]">{label}</div><div className="mt-1 font-semibold text-[#3b3129]">{value}</div></div> }
