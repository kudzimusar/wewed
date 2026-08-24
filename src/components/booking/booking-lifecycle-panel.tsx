'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, CircleDollarSign, FileClock, Loader2, RefreshCw, Undo2 } from 'lucide-react'

type BookingSummary = {
  id: string
  status: string
  currency: string
  totalCents: number | null
  depositCents: number | null
  eventDate?: string | null
  serviceStart?: string | null
  serviceEnd?: string | null
  serviceLocation?: string | null
  lines?: Array<{ quantity?: number; variantId?: string | null; name?: string }>
}

type Amendment = {
  id: string
  status: string
  summary: string
  priceDeltaCents: number | null
  beforeSnapshot: Record<string, unknown>
  afterSnapshot: Record<string, unknown>
  impactSnapshot?: Record<string, unknown>
  contractAmendmentId?: string | null
  createdAt: string
  decidedAt?: string | null
  effectiveAt?: string | null
}

function money(cents: number | null | undefined, currency: string) {
  if (cents == null) return '—'
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100) }
  catch { return `${currency} ${(cents / 100).toFixed(2)}` }
}

function dateValue(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function dateTimeValue(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function human(value: string) { return value.replaceAll('_', ' ') }

export function BookingLifecyclePanel({ booking, onChanged }: { booking: BookingSummary; onChanged?: () => void | Promise<void> }) {
  const [amendments, setAmendments] = useState<Amendment[]>([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [summary, setSummary] = useState('')
  const [quantity, setQuantity] = useState(String(booking.lines?.[0]?.quantity || 1))
  const [eventDate, setEventDate] = useState(dateValue(booking.eventDate))
  const [serviceStart, setServiceStart] = useState(dateTimeValue(booking.serviceStart))
  const [serviceEnd, setServiceEnd] = useState(dateTimeValue(booking.serviceEnd))
  const [serviceLocation, setServiceLocation] = useState(booking.serviceLocation || '')

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}/amendments`, { credentials: 'include', cache: 'no-store' })
      const payload = await response.json() as { success?: boolean; data?: Amendment[]; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load amendment history.')
      setAmendments(payload.data || [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load amendment history.')
    }
  }, [booking.id])

  useEffect(() => { void load() }, [load])

  const canAmend = ['confirmed', 'preparing', 'ready'].includes(booking.status)
  const pending = useMemo(() => amendments.find((item) => item.status === 'proposed') || null, [amendments])

  async function post(endpoint: string, body: Record<string, unknown> = {}) {
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await response.json() as { success?: boolean; error?: string }
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to update booking.')
  }

  async function syncDeposit() {
    setBusy('deposit'); setError(''); setMessage('')
    try {
      await post(`/api/bookings/${encodeURIComponent(booking.id)}/deposit`)
      setMessage('Deposit evidence verified. Booking status refreshed from canonical payment records.')
      await load(); await onChanged?.()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to verify deposit.') }
    finally { setBusy('') }
  }

  async function propose() {
    setBusy('propose'); setError(''); setMessage('')
    try {
      const patch: Record<string, unknown> = {}
      const currentQuantity = booking.lines?.[0]?.quantity || 1
      const parsedQuantity = Number(quantity)
      if (Number.isInteger(parsedQuantity) && parsedQuantity > 0 && parsedQuantity !== currentQuantity) patch.quantity = parsedQuantity
      if (eventDate && eventDate !== dateValue(booking.eventDate)) patch.eventDate = `${eventDate}T00:00:00.000Z`
      if (serviceStart && serviceStart !== dateTimeValue(booking.serviceStart)) patch.serviceStart = new Date(serviceStart).toISOString()
      if (serviceEnd && serviceEnd !== dateTimeValue(booking.serviceEnd)) patch.serviceEnd = new Date(serviceEnd).toISOString()
      if (serviceLocation.trim() !== (booking.serviceLocation || '')) patch.serviceLocation = serviceLocation.trim() || null
      if (!summary.trim()) throw new Error('Explain the requested change.')
      if (!Object.keys(patch).length) throw new Error('Change at least one booking field before proposing an amendment.')
      await post(`/api/bookings/${encodeURIComponent(booking.id)}/amendments`, { summary: summary.trim(), patch })
      setMessage('Amendment proposed. The current booking remains unchanged until the governed decision/effectivity path completes.')
      setSummary(''); setShowForm(false); await load(); await onChanged?.()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to propose amendment.') }
    finally { setBusy('') }
  }

  async function withdraw(amendmentId: string) {
    setBusy(amendmentId); setError(''); setMessage('')
    try {
      await post(`/api/bookings/${encodeURIComponent(booking.id)}/amendments/${encodeURIComponent(amendmentId)}/withdraw`)
      setMessage('Pending amendment withdrawn without rewriting the booking history.')
      await load(); await onChanged?.()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to withdraw amendment.') }
    finally { setBusy('') }
  }

  return <section className="mt-5 rounded-2xl border border-gold/15 bg-black/10 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-gold"><FileClock className="size-4" /> Booking lifecycle</div><p className="mt-1 text-xs leading-5 text-champagne/50">Deposits, amendments and booking status remain separate governed evidence.</p></div>
      {canAmend && !pending ? <button type="button" onClick={() => setShowForm((value) => !value)} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-gold/30 px-3 text-xs font-semibold"><CalendarClock className="size-4" /> Request change</button> : null}
    </div>

    {booking.status === 'awaiting_deposit' ? <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-950/20 p-3 text-sm text-amber-100">
      <div className="flex items-center gap-2 font-semibold"><CircleDollarSign className="size-4" /> Deposit evidence required</div>
      <p className="mt-1 text-xs leading-5">Required deposit: {money(booking.depositCents, booking.currency)}. Wewed does not treat the booking as confirmed until canonical payment evidence satisfies the milestone.</p>
      <button disabled={busy === 'deposit'} onClick={() => void syncDeposit()} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full bg-champagne px-3 text-xs font-bold text-espresso disabled:opacity-50">{busy === 'deposit' ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Recheck recorded deposit</button>
    </div> : null}

    {showForm ? <div className="mt-4 rounded-xl border border-gold/20 bg-champagne/5 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold">Quantity<input type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-gold/20 bg-black/10 px-3 text-champagne" /></label>
        <label className="text-xs font-semibold">Event date<input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-gold/20 bg-black/10 px-3 text-champagne" /></label>
        <label className="text-xs font-semibold">Service starts<input type="datetime-local" value={serviceStart} onChange={(event) => setServiceStart(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-gold/20 bg-black/10 px-3 text-champagne" /></label>
        <label className="text-xs font-semibold">Service ends<input type="datetime-local" value={serviceEnd} onChange={(event) => setServiceEnd(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-gold/20 bg-black/10 px-3 text-champagne" /></label>
      </div>
      <label className="mt-3 block text-xs font-semibold">Service / delivery location<input value={serviceLocation} onChange={(event) => setServiceLocation(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-gold/20 bg-black/10 px-3 text-champagne" /></label>
      <label className="mt-3 block text-xs font-semibold">Why this change is needed<textarea rows={2} value={summary} onChange={(event) => setSummary(event.target.value)} className="mt-1 w-full rounded-lg border border-gold/20 bg-black/10 p-3 text-champagne" /></label>
      <button disabled={busy === 'propose'} onClick={() => void propose()} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full bg-champagne px-3 text-xs font-bold text-espresso disabled:opacity-50">{busy === 'propose' ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />} Propose governed amendment</button>
    </div> : null}

    {pending ? <div className="mt-4 rounded-xl border border-gold/25 bg-champagne/5 p-3 text-xs">
      <div className="font-semibold text-champagne">Pending amendment: {pending.summary}</div>
      <div className="mt-1 text-champagne/55">Commercial delta {pending.priceDeltaCents == null ? 'requires governed pricing review' : money(pending.priceDeltaCents, booking.currency)}. The existing booking remains authoritative until accepted/effective.</div>
      <button disabled={busy === pending.id} onClick={() => void withdraw(pending.id)} className="mt-2 inline-flex min-h-8 items-center gap-2 rounded-full border border-red-300/30 px-3 font-semibold text-red-200 disabled:opacity-50">{busy === pending.id ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />} Withdraw proposal</button>
    </div> : null}

    {amendments.length ? <div className="mt-4 border-t border-gold/10 pt-3"><div className="text-xs font-semibold text-champagne/55">Amendment history</div><div className="mt-2 space-y-2">{amendments.map((item) => <div key={item.id} className="rounded-xl bg-champagne/5 p-2 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.summary}</strong><span className="rounded-full bg-black/10 px-2 py-1 uppercase tracking-wide text-champagne/50">{human(item.status)}</span></div><div className="mt-1 text-champagne/45">Proposed {new Date(item.createdAt).toLocaleString()}{item.effectiveAt ? ` · effective ${new Date(item.effectiveAt).toLocaleString()}` : ''}{item.contractAmendmentId ? ' · governed contract amendment linked' : ''}</div></div>)}</div></div> : <p className="mt-4 text-xs text-champagne/40">No booking amendments recorded.</p>}

    {error ? <div className="mt-3 rounded-xl bg-red-950/30 p-3 text-xs text-red-100">{error}</div> : null}
    {message ? <div className="mt-3 rounded-xl bg-emerald-950/20 p-3 text-xs text-emerald-100">{message}</div> : null}
  </section>
}
