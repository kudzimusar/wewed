'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, CheckCircle2, FileSignature, Loader2, PackageCheck, RefreshCw, Send, XCircle } from 'lucide-react'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

type BookingLine = { name?: string; quantity?: number }
type VendorBooking = {
  id: string
  publicReference: string
  weddingId: string
  status: string
  bookingMode: string
  currency: string
  totalCents: number | null
  depositCents: number | null
  eventDate: string | null
  serviceStart: string | null
  serviceEnd: string | null
  appointmentAt: string | null
  serviceLocation: string | null
  guestCount: number | null
  customerNotes: string | null
  serviceEngagementId: string | null
  createdAt: string
  updatedAt: string
  weddingTitle: string
  category: string
  lines: BookingLine[]
}

type ApiPayload = { business: { businessAccountId: string; businessName: string }; bookings: VendorBooking[] }
type QuoteDraft = { subtotal: string; fees: string; deposit: string; currency: string; notes: string }

const actionLabels: Record<string, string> = {
  approve: 'Approve',
  decline: 'Decline',
  preparing: 'Preparing',
  ready: 'Ready',
  in_progress: 'Start service',
  return_due: 'Return due',
  inspection: 'Inspection',
  completed: 'Complete',
}

function actionsFor(status: string) {
  if (['requested', 'awaiting_vendor'].includes(status)) return ['approve', 'decline']
  if (['quote_requested', 'quote_proposed', 'awaiting_terms'].includes(status)) return ['decline']
  if (status === 'confirmed') return ['preparing', 'in_progress']
  if (status === 'preparing') return ['ready', 'in_progress']
  if (status === 'ready') return ['in_progress']
  if (status === 'in_progress') return ['return_due', 'inspection', 'completed']
  if (status === 'return_due') return ['inspection', 'completed']
  if (status === 'inspection') return ['completed']
  return []
}

function money(value: number | null, currency: string) {
  if (value == null) return 'Vendor quote required'
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value / 100) }
  catch { return `${currency} ${(value / 100).toFixed(2)}` }
}

function dateLabel(value: string | null) {
  if (!value) return 'Date to be confirmed'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined }).format(date)
}

function toCents(value: string, optional = false) {
  const trimmed = value.trim()
  if (optional && !trimmed) return null
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) throw new Error('Enter money as a positive amount with at most two decimal places.')
  const [whole, decimal = ''] = trimmed.split('.')
  return Number(whole) * 100 + Number(decimal.padEnd(2, '0'))
}

export default function VendorBookingsPage() {
  const [data, setData] = useState<ApiPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [quoteDrafts, setQuoteDrafts] = useState<Record<string, QuoteDraft>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/vendor/bookings', { credentials: 'include', cache: 'no-store' })
      const payload = await response.json() as { success?: boolean; data?: ApiPayload; error?: string }
      if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error || 'Unable to load bookings.')
      setData(payload.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load bookings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const counts = useMemo(() => {
    const rows = data?.bookings ?? []
    return {
      pending: rows.filter((booking) => ['requested', 'quote_requested', 'quote_proposed', 'awaiting_vendor', 'awaiting_terms'].includes(booking.status)).length,
      active: rows.filter((booking) => ['confirmed', 'preparing', 'ready', 'in_progress', 'return_due', 'inspection'].includes(booking.status)).length,
      completed: rows.filter((booking) => booking.status === 'completed').length,
    }
  }, [data])

  function quoteDraft(booking: VendorBooking) {
    return quoteDrafts[booking.id] ?? {
      subtotal: booking.totalCents == null ? '' : (booking.totalCents / 100).toFixed(2),
      fees: '0.00',
      deposit: booking.depositCents == null ? '' : (booking.depositCents / 100).toFixed(2),
      currency: booking.currency || 'USD',
      notes: '',
    }
  }

  function changeQuote(booking: VendorBooking, patch: Partial<QuoteDraft>) {
    setQuoteDrafts((current) => ({ ...current, [booking.id]: { ...quoteDraft(booking), ...patch } }))
  }

  async function act(bookingId: string, action: string) {
    if (busyId) return
    setBusyId(bookingId)
    setError('')
    try {
      const response = await fetch(`/api/vendor/bookings/${encodeURIComponent(bookingId)}/action`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const payload = await response.json() as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to update booking.')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update booking.')
    } finally {
      setBusyId('')
    }
  }

  async function proposeQuote(booking: VendorBooking) {
    if (busyId) return
    setBusyId(booking.id)
    setError('')
    try {
      const draft = quoteDraft(booking)
      const response = await fetch(`/api/vendor/bookings/${encodeURIComponent(booking.id)}/quote`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subtotalCents: toCents(draft.subtotal),
          feesCents: toCents(draft.fees || '0'),
          depositCents: toCents(draft.deposit, true),
          currency: draft.currency.trim().toUpperCase(),
          notes: draft.notes,
        }),
      })
      const payload = await response.json() as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to propose quote.')
      setQuoteDrafts((current) => { const next = { ...current }; delete next[booking.id]; return next })
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to propose quote.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <DashboardAuthGate allowedRoles={['vendor']} wrongRoleMessage="This workspace is available to approved Wewed Vendor accounts." title="Vendor bookings" description="Sign in as an approved Vendor owner to manage booking requests and fulfilment." onClose={() => window.location.assign('/vendor')}>
      <main className="min-h-dvh bg-ivory px-4 py-8 text-espresso sm:px-6 sm:py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/vendor" className="inline-flex items-center gap-2 text-sm font-semibold text-gold-muted"><ArrowLeft className="size-4" /> Vendor workspace</Link>
            <button onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/25 bg-white px-4 text-sm font-semibold disabled:opacity-60"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
          </div>

          <section className="mt-5 rounded-3xl border border-gold/20 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-muted">Booking operations</p>
            <h1 className="mt-2 font-serif text-4xl sm:text-6xl">{data?.business.businessName || 'Vendor'} booking inbox</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-espresso/65">Review requests, issue explicit quotes when pricing is not deterministic, and confirm work only after the required Wewed contract becomes effective. Then move the booking through preparation, delivery/service, return and completion.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-champagne/60 p-4"><div className="text-xs uppercase tracking-[0.16em] text-espresso/50">Pending decision</div><div className="mt-2 text-3xl font-semibold">{counts.pending}</div></div>
              <div className="rounded-2xl bg-champagne/60 p-4"><div className="text-xs uppercase tracking-[0.16em] text-espresso/50">Active</div><div className="mt-2 text-3xl font-semibold">{counts.active}</div></div>
              <div className="rounded-2xl bg-champagne/60 p-4"><div className="text-xs uppercase tracking-[0.16em] text-espresso/50">Completed</div><div className="mt-2 text-3xl font-semibold">{counts.completed}</div></div>
            </div>
          </section>

          {error ? <div className="mt-5 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
          {loading && !data ? <div className="mt-8 flex items-center justify-center gap-3 rounded-3xl border border-gold/15 bg-white p-12 text-sm text-espresso/60"><Loader2 className="size-5 animate-spin" /> Loading bookings…</div> : null}
          {!loading && data && data.bookings.length === 0 ? <div className="mt-8 rounded-3xl border border-dashed border-gold/30 bg-white p-10 text-center"><CalendarDays className="mx-auto size-8 text-gold-muted" /><h2 className="mt-4 font-serif text-3xl">No booking requests yet</h2><p className="mt-2 text-sm text-espresso/60">Published catalogue items will appear here when couples or planners submit a booking or quote request.</p></div> : null}

          <div className="mt-6 space-y-4">
            {data?.bookings.map((booking) => {
              const actions = actionsFor(booking.status)
              const date = booking.serviceStart || booking.appointmentAt || booking.eventDate
              const draft = quoteDraft(booking)
              return <article key={booking.id} className="rounded-3xl border border-gold/20 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-champagne px-3 py-1 text-xs font-bold uppercase tracking-[0.12em]">{booking.status.replaceAll('_', ' ')}</span>
                      <span className="text-xs text-espresso/45">{booking.publicReference}</span>
                    </div>
                    <h2 className="mt-3 font-serif text-3xl">{booking.weddingTitle || 'Wedding booking'}</h2>
                    <p className="mt-1 text-sm text-espresso/55">{booking.category.replaceAll('-', ' ')} · {booking.bookingMode.replaceAll('_', ' ')}</p>
                    <div className="mt-4 space-y-2 text-sm text-espresso/70">
                      {(booking.lines || []).map((line, index) => <div key={`${booking.id}-${index}`} className="font-medium">{line.name || 'Service'}{line.quantity ? ` × ${line.quantity}` : ''}</div>)}
                      <div><strong>Date:</strong> {dateLabel(date)}</div>
                      {booking.serviceLocation ? <div><strong>Location:</strong> {booking.serviceLocation}</div> : null}
                      {booking.guestCount != null ? <div><strong>Guests:</strong> {booking.guestCount}</div> : null}
                      {booking.customerNotes ? <div className="rounded-xl bg-ivory p-3"><strong>Customer notes:</strong> {booking.customerNotes}</div> : null}
                    </div>
                  </div>
                  <div className="w-full shrink-0 rounded-2xl bg-ivory p-4 lg:w-64">
                    <div className="text-xs uppercase tracking-[0.14em] text-espresso/45">Commercial value</div>
                    <div className="mt-2 text-xl font-semibold">{money(booking.totalCents, booking.currency)}</div>
                    {booking.depositCents != null ? <div className="mt-1 text-xs text-espresso/55">Deposit {money(booking.depositCents, booking.currency)}</div> : null}
                    {booking.serviceEngagementId ? <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700"><CheckCircle2 className="size-4" /> Service Engagement linked</div> : null}
                    {booking.status === 'awaiting_terms' ? <Link href="/vendor/documents" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-gold-muted"><FileSignature className="size-4" /> Open governed contract</Link> : null}
                  </div>
                </div>

                {booking.status === 'quote_requested' ? <div className="mt-5 rounded-2xl border border-gold/25 bg-champagne/30 p-4">
                  <div className="flex items-center gap-2 font-semibold"><Send className="size-4 text-gold-muted" /> Propose a commercial quote</div>
                  <p className="mt-1 text-xs leading-5 text-espresso/55">The customer must explicitly accept this quote. If this catalogue item requires a contract, acceptance will then create the governed Wewed agreement workflow rather than confirming the booking immediately.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="text-xs font-semibold">Subtotal<input value={draft.subtotal} onChange={(event) => changeQuote(booking, { subtotal: event.target.value })} inputMode="decimal" placeholder="0.00" className="mt-1 min-h-10 w-full rounded-xl border border-gold/25 bg-white px-3 text-sm font-normal" /></label>
                    <label className="text-xs font-semibold">Fees<input value={draft.fees} onChange={(event) => changeQuote(booking, { fees: event.target.value })} inputMode="decimal" placeholder="0.00" className="mt-1 min-h-10 w-full rounded-xl border border-gold/25 bg-white px-3 text-sm font-normal" /></label>
                    <label className="text-xs font-semibold">Deposit (optional)<input value={draft.deposit} onChange={(event) => changeQuote(booking, { deposit: event.target.value })} inputMode="decimal" placeholder="0.00" className="mt-1 min-h-10 w-full rounded-xl border border-gold/25 bg-white px-3 text-sm font-normal" /></label>
                    <label className="text-xs font-semibold">Currency<input value={draft.currency} onChange={(event) => changeQuote(booking, { currency: event.target.value.toUpperCase().slice(0, 3) })} maxLength={3} className="mt-1 min-h-10 w-full rounded-xl border border-gold/25 bg-white px-3 text-sm font-normal uppercase" /></label>
                  </div>
                  <label className="mt-3 block text-xs font-semibold">Quote notes<textarea value={draft.notes} onChange={(event) => changeQuote(booking, { notes: event.target.value })} rows={3} placeholder="Delivery, fitting, setup or other commercial details…" className="mt-1 w-full rounded-xl border border-gold/25 bg-white px-3 py-2 text-sm font-normal" /></label>
                  <button disabled={busyId === booking.id} onClick={() => void proposeQuote(booking)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-espresso px-4 text-sm font-semibold text-champagne disabled:opacity-60">{busyId === booking.id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send quote for acceptance</button>
                </div> : null}

                {booking.status === 'quote_proposed' ? <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">Quote sent. Wewed is waiting for the wedding customer to explicitly accept it before any contract-required booking can advance.</div> : null}
                {booking.status === 'awaiting_terms' ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Commercial terms are agreed, but this booking is not yet confirmed. The canonical Wewed contract must become effective through the governed acceptance workflow first.</div> : null}

                {actions.length ? <div className="mt-5 flex flex-wrap gap-2 border-t border-gold/15 pt-5">
                  {actions.map((action) => <button key={action} disabled={busyId === booking.id} onClick={() => void act(booking.id, action)} className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-60 ${action === 'decline' ? 'border border-red-200 bg-red-50 text-red-700' : 'bg-espresso text-champagne'}`}>
                    {busyId === booking.id ? <Loader2 className="size-4 animate-spin" /> : action === 'decline' ? <XCircle className="size-4" /> : action === 'completed' ? <PackageCheck className="size-4" /> : <CheckCircle2 className="size-4" />}
                    {actionLabels[action] || action}
                  </button>)}
                </div> : null}
              </article>
            })}
          </div>
        </div>
      </main>
    </DashboardAuthGate>
  )
}
