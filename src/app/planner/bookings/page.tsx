'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, FileSignature, Loader2, RefreshCw, Store, XCircle } from 'lucide-react'

type BookingLine = { name?: string; quantity?: number; catalogItemId?: string; variantId?: string | null }
type WeddingBooking = {
  id: string
  publicReference: string
  businessAccountId: string
  offeringId: string
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
  serviceEngagementId: string | null
  confirmedAt: string | null
  createdAt: string
  updatedAt: string
  providerSlug: string
  providerName: string
  category: string
  lines: BookingLine[]
}

type Governance = {
  acceptedQuoteId?: string | null
  quoteId?: string | null
  quoteStatus?: string | null
  quoteCurrency?: string | null
  quoteSubtotalCents?: number | null
  quoteFeesCents?: number | null
  quoteDepositCents?: number | null
  quoteTotalCents?: number | null
  quoteNotes?: string | null
  quoteProposedAt?: string | null
  contractId?: string | null
  contractNumber?: string | null
  contractStatus?: string | null
  currentVersionNumber?: number | null
}

function money(value: number | null | undefined, currency: string) {
  if (value == null) return 'Quote pending'
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value / 100) }
  catch { return `${currency} ${(value / 100).toFixed(2)}` }
}

function dateLabel(value: string | null | undefined) {
  if (!value) return 'Date to be confirmed'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined }).format(date)
}

const cancellable = new Set(['draft','held','requested','quote_requested','quote_proposed','awaiting_vendor','awaiting_terms'])

export default function PlannerBookingsPage() {
  const [bookings, setBookings] = useState<WeddingBooking[]>([])
  const [governance, setGovernance] = useState<Record<string, Governance>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/bookings', { credentials: 'include', cache: 'no-store' })
      const payload = await response.json() as { success?: boolean; data?: WeddingBooking[]; error?: string }
      if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error || 'Unable to load bookings.')
      setBookings(payload.data)
      const governed = payload.data.filter((booking) => ['quote_proposed','awaiting_terms','confirmed'].includes(booking.status) || booking.serviceEngagementId)
      const results = await Promise.all(governed.map(async (booking) => {
        const detail = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}/terms`, { credentials: 'include', cache: 'no-store' })
        const detailPayload = await detail.json().catch(() => ({})) as { success?: boolean; data?: Governance }
        return [booking.id, detail.ok && detailPayload.success ? detailPayload.data ?? {} : {}] as const
      }))
      setGovernance(Object.fromEntries(results))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load bookings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const counts = useMemo(() => ({
    pending: bookings.filter((booking) => ['draft', 'held', 'requested', 'quote_requested', 'quote_proposed', 'awaiting_vendor', 'awaiting_terms', 'awaiting_deposit'].includes(booking.status)).length,
    active: bookings.filter((booking) => ['confirmed', 'preparing', 'ready', 'in_progress', 'return_due', 'inspection'].includes(booking.status)).length,
    completed: bookings.filter((booking) => booking.status === 'completed').length,
  }), [bookings])

  async function postAction(bookingId: string, endpoint: string, body: Record<string, unknown> = {}) {
    if (busyId) return
    setBusyId(bookingId)
    setError('')
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
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

  return (
    <main className="min-h-dvh bg-espresso px-4 py-8 text-champagne sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/planner/marketplace" className="inline-flex items-center gap-2 text-sm font-semibold text-gold"><ArrowLeft className="size-4" /> Marketplace</Link>
          <button onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/30 bg-champagne/5 px-4 text-sm font-semibold disabled:opacity-60"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
        </div>

        <section className="mt-5 rounded-3xl border border-gold/20 bg-champagne/5 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Wedding order book</p>
          <h1 className="mt-2 font-serif text-4xl sm:text-6xl">My bookings</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-champagne/65">Every marketplace booking for the active wedding lives here, whether it was made directly by the couple or managed through the planner workspace. Vendor quotes require explicit acceptance; contract-required services remain pending until the canonical Wewed contract becomes effective; Budget records never imply payment or couple funding.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-gold/15 bg-black/10 p-4"><div className="text-xs uppercase tracking-[0.16em] text-champagne/45">Pending</div><div className="mt-2 text-3xl font-semibold">{counts.pending}</div></div>
            <div className="rounded-2xl border border-gold/15 bg-black/10 p-4"><div className="text-xs uppercase tracking-[0.16em] text-champagne/45">Active</div><div className="mt-2 text-3xl font-semibold">{counts.active}</div></div>
            <div className="rounded-2xl border border-gold/15 bg-black/10 p-4"><div className="text-xs uppercase tracking-[0.16em] text-champagne/45">Completed</div><div className="mt-2 text-3xl font-semibold">{counts.completed}</div></div>
          </div>
        </section>

        {error ? <div className="mt-5 rounded-2xl border border-red-400/40 bg-red-950/30 p-4 text-sm text-red-100">{error}</div> : null}
        {loading && bookings.length === 0 ? <div className="mt-8 flex items-center justify-center gap-3 rounded-3xl border border-gold/15 bg-champagne/5 p-12 text-sm text-champagne/60"><Loader2 className="size-5 animate-spin" /> Loading bookings…</div> : null}
        {!loading && bookings.length === 0 ? <div className="mt-8 rounded-3xl border border-dashed border-gold/30 bg-champagne/5 p-10 text-center"><CalendarDays className="mx-auto size-8 text-gold" /><h2 className="mt-4 font-serif text-3xl">No marketplace bookings yet</h2><p className="mt-2 text-sm text-champagne/60">Browse a vendor catalogue and start a booking request. Once submitted, it will remain attached to this wedding here.</p><Link href="/vendors" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-champagne px-5 text-sm font-bold text-espresso"><Store className="size-4" /> Browse vendors</Link></div> : null}

        <div className="mt-6 space-y-4">
          {bookings.map((booking) => {
            const date = booking.serviceStart || booking.appointmentAt || booking.eventDate
            const terms = governance[booking.id] ?? {}
            const quoteCurrency = terms.quoteCurrency || booking.currency
            return <article key={booking.id} className="rounded-3xl border border-gold/20 bg-champagne/5 p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-champagne/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-gold">{booking.status.replaceAll('_', ' ')}</span>
                    <span className="text-xs text-champagne/40">{booking.publicReference}</span>
                  </div>
                  <h2 className="mt-3 font-serif text-3xl">{booking.providerName}</h2>
                  <p className="mt-1 text-sm text-champagne/55">{booking.category.replaceAll('-', ' ')} · {booking.bookingMode.replaceAll('_', ' ')}</p>
                  <div className="mt-4 space-y-2 text-sm text-champagne/70">
                    {(booking.lines || []).map((line, index) => <div key={`${booking.id}-${index}`} className="font-medium">{line.name || 'Service'}{line.quantity ? ` × ${line.quantity}` : ''}</div>)}
                    <div className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-gold" /> {dateLabel(date)}</div>
                    {booking.serviceLocation ? <div><strong>Location:</strong> {booking.serviceLocation}</div> : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/vendors/${encodeURIComponent(booking.providerSlug)}`} className="inline-flex min-h-10 items-center rounded-full border border-gold/30 px-4 text-sm font-semibold text-gold">Vendor profile</Link>
                    {terms.contractId ? <Link href={`/planner/contracts/${encodeURIComponent(terms.contractId)}/governance`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/30 px-4 text-sm font-semibold text-gold"><FileSignature className="size-4" /> {terms.contractNumber || 'Governed contract'}</Link> : null}
                  </div>
                </div>
                <div className="w-full shrink-0 rounded-2xl border border-gold/15 bg-black/10 p-4 lg:w-64">
                  <div className="text-xs uppercase tracking-[0.14em] text-champagne/45">Commercial value</div>
                  <div className="mt-2 text-xl font-semibold">{money(booking.totalCents, booking.currency)}</div>
                  {booking.depositCents != null ? <div className="mt-1 text-xs text-champagne/55">Deposit {money(booking.depositCents, booking.currency)}</div> : null}
                  <div className="mt-3 inline-flex items-center gap-2 text-xs text-champagne/55"><Clock3 className="size-4" /> Updated {dateLabel(booking.updatedAt)}</div>
                  {booking.serviceEngagementId ? <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-emerald-300"><CheckCircle2 className="size-4" /> Service Engagement linked</div> : null}
                </div>
              </div>

              {booking.status === 'quote_proposed' ? <div className="mt-5 rounded-2xl border border-gold/30 bg-champagne/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Vendor quote awaiting your decision</p>
                <div className="mt-3 grid gap-2 text-sm text-champagne/75 sm:grid-cols-2 lg:grid-cols-4">
                  <div><span className="text-champagne/45">Subtotal</span><div className="font-semibold text-champagne">{money(terms.quoteSubtotalCents, quoteCurrency)}</div></div>
                  <div><span className="text-champagne/45">Fees</span><div className="font-semibold text-champagne">{money(terms.quoteFeesCents ?? 0, quoteCurrency)}</div></div>
                  <div><span className="text-champagne/45">Deposit</span><div className="font-semibold text-champagne">{terms.quoteDepositCents == null ? 'None stated' : money(terms.quoteDepositCents, quoteCurrency)}</div></div>
                  <div><span className="text-champagne/45">Total</span><div className="font-semibold text-champagne">{money(terms.quoteTotalCents, quoteCurrency)}</div></div>
                </div>
                {terms.quoteNotes ? <div className="mt-3 rounded-xl bg-black/10 p-3 text-sm text-champagne/70">{terms.quoteNotes}</div> : null}
                <p className="mt-3 text-xs leading-5 text-champagne/55">Accepting the quote records your commercial acceptance. It does not accept a service contract. If this service requires a contract, Wewed will create the governed draft and the booking will remain unconfirmed until the required parties complete the separate acceptance workflow.</p>
                <button disabled={busyId === booking.id || !terms.quoteId} onClick={() => void postAction(booking.id, `/api/bookings/${encodeURIComponent(booking.id)}/quote/accept`, { quoteId: terms.quoteId })} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-champagne px-4 text-sm font-bold text-espresso disabled:opacity-50">{busyId === booking.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Accept vendor quote</button>
              </div> : null}

              {booking.status === 'awaiting_terms' ? <div className="mt-5 rounded-2xl border border-amber-300/40 bg-amber-950/20 p-4 text-sm text-amber-100">
                <div className="flex items-center gap-2 font-semibold"><FileSignature className="size-4" /> Contract effectivity required</div>
                <p className="mt-2 leading-6">The commercial booking is intentionally not confirmed yet. Complete the governed Wewed contract review/acceptance workflow, then use the check below. Wewed verifies append-only contract effectivity evidence rather than trusting a checkbox.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {terms.contractId ? <Link href={`/planner/contracts/${encodeURIComponent(terms.contractId)}/governance`} className="inline-flex min-h-10 items-center rounded-full border border-amber-200/40 px-4 font-semibold">Open contract</Link> : null}
                  <button disabled={busyId === booking.id} onClick={() => void postAction(booking.id, `/api/bookings/${encodeURIComponent(booking.id)}/terms`)} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-champagne px-4 font-bold text-espresso disabled:opacity-50">{busyId === booking.id ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Check signed terms</button>
                </div>
              </div> : null}

              {cancellable.has(booking.status) ? <div className="mt-5 border-t border-gold/15 pt-4">
                <button disabled={busyId === booking.id} onClick={() => void postAction(booking.id, `/api/bookings/${encodeURIComponent(booking.id)}/cancel`, { reason: 'Cancelled from wedding order book' })} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-red-300/30 px-3 text-xs font-semibold text-red-200 disabled:opacity-50"><XCircle className="size-4" /> Cancel before governed commitment</button>
              </div> : null}
            </article>
          })}
        </div>
      </div>
    </main>
  )
}
