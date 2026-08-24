'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import { BookingLifecyclePanel } from '@/components/booking/booking-lifecycle-panel'

type Booking = {
  id: string
  publicReference: string
  providerName: string
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

function money(cents: number | null, currency: string) {
  if (cents == null) return 'Quote pending'
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100) }
  catch { return `${currency} ${(cents / 100).toFixed(2)}` }
}

export default function BookingLifecycleManagementPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/bookings', { credentials: 'include', cache: 'no-store' })
      const payload = await response.json() as { success?: boolean; data?: Booking[]; error?: string }
      if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error || 'Unable to load bookings.')
      setBookings(payload.data)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load bookings.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  return <main className="min-h-dvh bg-espresso px-4 py-8 text-champagne sm:px-6 sm:py-12">
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/planner/bookings" className="inline-flex items-center gap-2 text-sm font-semibold text-gold"><ArrowLeft className="size-4" /> My Bookings</Link>
        <button onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/30 px-4 text-sm font-semibold disabled:opacity-50"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>
      <section className="mt-5 rounded-3xl border border-gold/20 bg-champagne/5 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Governed lifecycle</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl">Deposits & amendments</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-champagne/60">Recheck deposit evidence and request changes without rewriting the original commercial record. Effective contracts, factual payments and resource availability remain independent gates.</p>
      </section>
      {error ? <div className="mt-5 rounded-2xl bg-red-950/30 p-4 text-sm text-red-100">{error}</div> : null}
      {loading && !bookings.length ? <div className="mt-6 flex items-center gap-2 rounded-2xl border border-gold/15 bg-champagne/5 p-6 text-sm text-champagne/60"><Loader2 className="size-5 animate-spin" /> Loading booking lifecycle…</div> : null}
      <div className="mt-6 space-y-5">
        {bookings.map((booking) => <article key={booking.id} className="rounded-3xl border border-gold/20 bg-champagne/5 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><div className="text-xs uppercase tracking-[0.15em] text-gold">{booking.publicReference}</div><h2 className="mt-2 font-serif text-3xl">{booking.providerName}</h2><div className="mt-1 text-sm text-champagne/55">{booking.status.replaceAll('_', ' ')}</div></div>
            <div className="rounded-2xl bg-black/10 px-4 py-3 text-sm"><div className="text-champagne/45">Booking value</div><div className="mt-1 font-semibold">{money(booking.totalCents, booking.currency)}</div>{booking.depositCents != null ? <div className="mt-1 text-xs text-champagne/45">Deposit {money(booking.depositCents, booking.currency)}</div> : null}</div>
          </div>
          <BookingLifecyclePanel booking={booking} onChanged={load} />
        </article>)}
      </div>
    </div>
  </main>
}
