'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Loader2, RefreshCw, Store } from 'lucide-react'

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

function money(value: number | null, currency: string) {
  if (value == null) return 'Quote pending'
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value / 100) }
  catch { return `${currency} ${(value / 100).toFixed(2)}` }
}

function dateLabel(value: string | null) {
  if (!value) return 'Date to be confirmed'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined }).format(date)
}

export default function PlannerBookingsPage() {
  const [bookings, setBookings] = useState<WeddingBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/bookings', { credentials: 'include', cache: 'no-store' })
      const payload = await response.json() as { success?: boolean; data?: WeddingBooking[]; error?: string }
      if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error || 'Unable to load bookings.')
      setBookings(payload.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load bookings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const counts = useMemo(() => ({
    pending: bookings.filter((booking) => ['draft', 'held', 'requested', 'quote_requested', 'awaiting_vendor', 'awaiting_terms', 'awaiting_deposit'].includes(booking.status)).length,
    active: bookings.filter((booking) => ['confirmed', 'preparing', 'ready', 'in_progress', 'return_due', 'inspection'].includes(booking.status)).length,
    completed: bookings.filter((booking) => booking.status === 'completed').length,
  }), [bookings])

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
          <p className="mt-4 max-w-3xl text-sm leading-7 text-champagne/65">Every marketplace booking for the active wedding lives here, whether it was made directly by the couple or managed through the planner workspace. Commercial commitments remain linked to the canonical vendor, Budget and Service Engagement records.</p>
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
                    {booking.serviceEngagementId ? <Link href="/planner/contracts" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/30 px-4 text-sm font-semibold text-gold"><CheckCircle2 className="size-4" /> Commercial records</Link> : null}
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
            </article>
          })}
        </div>
      </div>
    </main>
  )
}
