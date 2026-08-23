'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, CheckCircle2, Loader2, PackageCheck, RefreshCw, XCircle } from 'lucide-react'
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
  if (status === 'quote_requested') return ['approve', 'decline']
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

export default function VendorBookingsPage() {
  const [data, setData] = useState<ApiPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

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
      pending: rows.filter((booking) => ['requested', 'quote_requested', 'awaiting_vendor'].includes(booking.status)).length,
      active: rows.filter((booking) => ['confirmed', 'preparing', 'ready', 'in_progress', 'return_due', 'inspection'].includes(booking.status)).length,
      completed: rows.filter((booking) => booking.status === 'completed').length,
    }
  }, [data])

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
            <p className="mt-4 max-w-3xl text-sm leading-7 text-espresso/65">Review requests, confirm work only when the commercial terms are known, then move each confirmed booking through preparation, delivery/service, return and completion.</p>
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
                  </div>
                </div>
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
