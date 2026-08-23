'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileSignature,
  Gift,
  Loader2,
  MessageCircle,
  RefreshCw,
  Store,
  Truck,
  XCircle,
} from 'lucide-react'

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

type CommercialContext = {
  bookingId: string
  serviceEngagementId: string | null
  logistics: {
    pickupAt: string | null
    deliveryAt: string | null
    setupStart: string | null
    setupEnd: string | null
    collectionAt: string | null
    returnDueAt: string | null
  }
  budget: null | {
    id: string
    estimatedCost: number
    actualCost: number | null
    paidAmount: number
    currency: string
    dueDate: string | null
  }
  contract: null | { id: string; contractNumber: string; status: string; currentVersionNumber: number }
  paymentMilestones: Array<{
    id: string
    milestoneType: string
    label: string
    amount: string
    currency: string
    dueAt: string | null
    status: string
    sequence: number
  }>
  paymentFacts: Array<{
    id: string
    entryType: string
    amount: string
    currency: string
    paidAt: string
    method: string | null
    reference: string | null
    source: string
  }>
  contributions: Array<{
    id: string
    type: string
    title: string
    amount: string | null
    currency: string
    estimatedValue: string | null
    estimatedValueCurrency: string | null
    commitmentState: string
    fulfillmentState: string
    verificationState: string
    route: string
    allocationAmount: string | null
    allocationCurrency: string | null
    allocationKind: string | null
  }>
  fundingAllocations: Array<{
    id: string
    sourceKind: string
    amount: string
    currency: string
    contributionId: string | null
    paymentId: string | null
    reconciledAt: string | null
  }>
  conversationId: string | null
}

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

function human(value: string | null | undefined) {
  return value ? value.replaceAll('_', ' ').replaceAll('-', ' ') : 'Not recorded'
}

const cancellable = new Set(['draft','held','requested','quote_requested','quote_proposed','awaiting_vendor','awaiting_terms'])

export default function PlannerBookingsPage() {
  const [bookings, setBookings] = useState<WeddingBooking[]>([])
  const [governance, setGovernance] = useState<Record<string, Governance>>({})
  const [commercial, setCommercial] = useState<Record<string, CommercialContext>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
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

      const governed = bookingPayload.data.filter((booking) => ['quote_proposed','awaiting_terms','confirmed'].includes(booking.status) || booking.serviceEngagementId)
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
          <p className="mt-4 max-w-4xl text-sm leading-7 text-champagne/65">Booking, contract, payment and funding are deliberately separate facts. A confirmed booking means the service commitment passed Wewed’s booking gates; it does <strong>not</strong> mean the couple paid it. Planned payment milestones, factual payment records and third-party contributions are shown independently from their canonical records.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-gold/15 bg-black/10 p-4"><div className="text-xs uppercase tracking-[0.16em] text-champagne/45">Pending</div><div className="mt-2 text-3xl font-semibold">{counts.pending}</div></div>
            <div className="rounded-2xl border border-gold/15 bg-black/10 p-4"><div className="text-xs uppercase tracking-[0.16em] text-champagne/45">Active</div><div className="mt-2 text-3xl font-semibold">{counts.active}</div></div>
            <div className="rounded-2xl border border-gold/15 bg-black/10 p-4"><div className="text-xs uppercase tracking-[0.16em] text-champagne/45">Completed</div><div className="mt-2 text-3xl font-semibold">{counts.completed}</div></div>
          </div>
        </section>

        {error ? <div className="mt-5 rounded-2xl border border-red-400/40 bg-red-950/30 p-4 text-sm text-red-100">{error}</div> : null}
        {loading && bookings.length === 0 ? <div className="mt-8 flex items-center justify-center gap-3 rounded-3xl border border-gold/15 bg-champagne/5 p-12 text-sm text-champagne/60"><Loader2 className="size-5 animate-spin" /> Loading bookings and commercial context…</div> : null}
        {!loading && bookings.length === 0 ? <div className="mt-8 rounded-3xl border border-dashed border-gold/30 bg-champagne/5 p-10 text-center"><CalendarDays className="mx-auto size-8 text-gold" /><h2 className="mt-4 font-serif text-3xl">No marketplace bookings yet</h2><p className="mt-2 text-sm text-champagne/60">Browse a vendor catalogue and start a booking request. Once submitted, it will remain attached to this wedding here.</p><Link href="/vendors" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-champagne px-5 text-sm font-bold text-espresso"><Store className="size-4" /> Browse vendors</Link></div> : null}

        <div className="mt-6 space-y-5">
          {bookings.map((booking) => {
            const date = booking.serviceStart || booking.appointmentAt || booking.eventDate
            const terms = governance[booking.id] ?? {}
            const context = commercial[booking.id]
            const quoteCurrency = terms.quoteCurrency || booking.currency
            const contract = context?.contract ?? (terms.contractId ? { id: terms.contractId, contractNumber: terms.contractNumber || 'Governed contract', status: terms.contractStatus || 'DRAFT', currentVersionNumber: terms.currentVersionNumber || 1 } : null)
            const logistics = context?.logistics
            const logisticsRows = logistics ? [
              ['Pickup', logistics.pickupAt],
              ['Delivery', logistics.deliveryAt],
              ['Setup starts', logistics.setupStart],
              ['Setup ends', logistics.setupEnd],
              ['Collection', logistics.collectionAt],
              ['Return due', logistics.returnDueAt],
            ].filter((entry): entry is [string, string] => Boolean(entry[1])) : []

            return <article key={booking.id} className="rounded-3xl border border-gold/20 bg-champagne/5 p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-champagne/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-gold">{human(booking.status)}</span>
                    <span className="text-xs text-champagne/40">{booking.publicReference}</span>
                  </div>
                  <h2 className="mt-3 font-serif text-3xl">{booking.providerName}</h2>
                  <p className="mt-1 text-sm text-champagne/55">{human(booking.category)} · {human(booking.bookingMode)}</p>
                  <div className="mt-4 space-y-2 text-sm text-champagne/70">
                    {(booking.lines || []).map((line, index) => <div key={`${booking.id}-${index}`} className="font-medium">{line.name || 'Service'}{line.quantity ? ` × ${line.quantity}` : ''}</div>)}
                    <div className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-gold" /> {dateLabel(date)}</div>
                    {booking.serviceLocation ? <div><strong>Location:</strong> {booking.serviceLocation}</div> : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/vendors/${encodeURIComponent(booking.providerSlug)}`} className="inline-flex min-h-10 items-center rounded-full border border-gold/30 px-4 text-sm font-semibold text-gold">Vendor profile</Link>
                    {contract?.id ? <Link href={`/planner/contracts/${encodeURIComponent(contract.id)}/governance`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/30 px-4 text-sm font-semibold text-gold"><FileSignature className="size-4" /> {contract.contractNumber}</Link> : null}
                    {context?.conversationId ? <Link href="/messages" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/30 px-4 text-sm font-semibold text-gold"><MessageCircle className="size-4" /> Booking messages</Link> : null}
                  </div>
                </div>
                <div className="w-full shrink-0 rounded-2xl border border-gold/15 bg-black/10 p-4 lg:w-64">
                  <div className="text-xs uppercase tracking-[0.14em] text-champagne/45">Booking value</div>
                  <div className="mt-2 text-xl font-semibold">{money(booking.totalCents, booking.currency)}</div>
                  {booking.depositCents != null ? <div className="mt-1 text-xs text-champagne/55">Quoted deposit {money(booking.depositCents, booking.currency)}</div> : null}
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
                <p className="mt-3 text-xs leading-5 text-champagne/55">Accepting the quote records commercial acceptance only. It does not accept a service contract and does not record a payment.</p>
                <button disabled={busyId === booking.id || !terms.quoteId} onClick={() => void postAction(booking.id, `/api/bookings/${encodeURIComponent(booking.id)}/quote/accept`, { quoteId: terms.quoteId })} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-champagne px-4 text-sm font-bold text-espresso disabled:opacity-50">{busyId === booking.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Accept vendor quote</button>
              </div> : null}

              {booking.status === 'awaiting_terms' ? <div className="mt-5 rounded-2xl border border-amber-300/40 bg-amber-950/20 p-4 text-sm text-amber-100">
                <div className="flex items-center gap-2 font-semibold"><FileSignature className="size-4" /> Contract effectivity required</div>
                <p className="mt-2 leading-6">The booking is intentionally not confirmed yet. Complete the governed Wewed contract workflow; Wewed verifies append-only effectivity evidence rather than trusting a checkbox.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {contract?.id ? <Link href={`/planner/contracts/${encodeURIComponent(contract.id)}/governance`} className="inline-flex min-h-10 items-center rounded-full border border-amber-200/40 px-4 font-semibold">Open contract</Link> : null}
                  <button disabled={busyId === booking.id} onClick={() => void postAction(booking.id, `/api/bookings/${encodeURIComponent(booking.id)}/terms`)} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-champagne px-4 font-bold text-espresso disabled:opacity-50">{busyId === booking.id ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Check governed terms</button>
                </div>
              </div> : null}

              {context ? <div className="mt-5 grid gap-4 border-t border-gold/15 pt-5 lg:grid-cols-2">
                <section className="rounded-2xl border border-gold/15 bg-black/10 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-gold"><DollarSign className="size-4" /> Budget & payment truth</div>
                  {context.budget ? <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div><span className="text-champagne/45">Committed estimate</span><div className="font-semibold">{moneyMajor(context.budget.estimatedCost, context.budget.currency)}</div></div>
                    <div><span className="text-champagne/45">Actual final cost</span><div className="font-semibold">{context.budget.actualCost == null ? 'Not recorded yet' : moneyMajor(context.budget.actualCost, context.budget.currency)}</div></div>
                    <div><span className="text-champagne/45">Budget paid field</span><div className="font-semibold">{moneyMajor(context.budget.paidAmount, context.budget.currency)}</div></div>
                    <div><span className="text-champagne/45">Budget due date</span><div className="font-semibold">{context.budget.dueDate ? dateLabel(context.budget.dueDate) : 'Not recorded'}</div></div>
                  </div> : <p className="mt-3 text-sm text-champagne/55">No Budget commitment exists until this booking reaches the governed confirmation boundary.</p>}

                  <div className="mt-4 border-t border-gold/10 pt-3">
                    <div className="text-xs font-semibold text-champagne/55">Planned payment obligations</div>
                    {context.paymentMilestones.length ? <div className="mt-2 space-y-2">{context.paymentMilestones.map((row) => <div key={row.id} className="rounded-xl bg-champagne/5 p-2 text-xs"><strong>{row.label}</strong> · {moneyMajor(row.amount, row.currency)} · {human(row.status)}{row.dueAt ? ` · due ${dateLabel(row.dueAt)}` : ''}</div>)}</div> : <p className="mt-2 text-xs leading-5 text-champagne/45">No canonical payment milestone is recorded. A quoted deposit amount alone is not evidence that payment is due, paid, or funded.</p>}
                  </div>

                  <div className="mt-4 border-t border-gold/10 pt-3">
                    <div className="text-xs font-semibold text-champagne/55">Factual payment records</div>
                    {context.paymentFacts.length ? <div className="mt-2 space-y-2">{context.paymentFacts.map((row) => <div key={row.id} className="rounded-xl bg-emerald-950/20 p-2 text-xs"><strong>{human(row.entryType)}</strong> · {moneyMajor(row.amount, row.currency)} · {dateLabel(row.paidAt)}{row.method ? ` · ${row.method}` : ''}{row.reference ? ` · ${row.reference}` : ''}</div>)}</div> : <p className="mt-2 text-xs leading-5 text-champagne/45">No managed payment fact is recorded in Wewed for this booking. Booking status alone never proves payment.</p>}
                  </div>
                  <Link href="/planner/budget" className="mt-4 inline-flex text-xs font-semibold text-gold underline underline-offset-4">Open Budget & payment records</Link>
                </section>

                <section className="rounded-2xl border border-gold/15 bg-black/10 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-gold"><Gift className="size-4" /> Contributions & funding source</div>
                  {context.contributions.length ? <div className="mt-3 space-y-2">{context.contributions.map((row) => <div key={row.id} className="rounded-xl bg-champagne/5 p-3 text-xs leading-5"><strong className="text-champagne">{row.title}</strong><div className="text-champagne/55">{human(row.type)} · route {human(row.route)} · {human(row.commitmentState)} / {human(row.fulfillmentState)} · verification {human(row.verificationState)}</div><div className="mt-1 text-champagne/70">{row.allocationAmount ? `Allocated ${moneyMajor(row.allocationAmount, row.allocationCurrency || row.currency)}` : row.amount ? moneyMajor(row.amount, row.currency) : row.estimatedValue ? `Estimated value ${moneyMajor(row.estimatedValue, row.estimatedValueCurrency || row.currency)}` : 'No monetary value recorded'}</div></div>)}</div> : <p className="mt-3 text-xs leading-5 text-champagne/45">No contribution is linked to this booking. Wewed therefore does not attribute any part of this cost to a third party.</p>}

                  <div className="mt-4 border-t border-gold/10 pt-3">
                    <div className="text-xs font-semibold text-champagne/55">Reconciled funding allocations</div>
                    {context.fundingAllocations.length ? <div className="mt-2 space-y-2">{context.fundingAllocations.map((row) => <div key={row.id} className="rounded-xl bg-champagne/5 p-2 text-xs"><strong>{human(row.sourceKind)}</strong> · {moneyMajor(row.amount, row.currency)}{row.reconciledAt ? ` · reconciled ${dateLabel(row.reconciledAt)}` : ' · not yet reconciled'}</div>)}</div> : <p className="mt-2 text-xs leading-5 text-champagne/45">No funding allocation has been reconciled. Do not interpret the booking or Budget amount as couple-funded.</p>}
                  </div>
                  <Link href="/planner/contributions" className="mt-4 inline-flex text-xs font-semibold text-gold underline underline-offset-4">Open Contributions</Link>
                </section>

                <section className="rounded-2xl border border-gold/15 bg-black/10 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-gold"><FileSignature className="size-4" /> Governed agreement</div>
                  {contract ? <div className="mt-3 text-sm"><div className="font-semibold">{contract.contractNumber}</div><div className="mt-1 text-champagne/55">Status {human(contract.status)} · version {contract.currentVersionNumber}</div><Link href={`/planner/contracts/${encodeURIComponent(contract.id)}/governance`} className="mt-3 inline-flex text-xs font-semibold text-gold underline underline-offset-4">Open governed contract</Link></div> : <p className="mt-3 text-xs leading-5 text-champagne/45">No governed contract is linked. This is valid only when the catalogue item does not require one.</p>}
                </section>

                <section className="rounded-2xl border border-gold/15 bg-black/10 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-gold"><Truck className="size-4" /> Operational timeline</div>
                  {logisticsRows.length ? <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">{logisticsRows.map(([label, value]) => <div key={label} className="rounded-xl bg-champagne/5 p-2"><span className="text-champagne/45">{label}</span><div className="mt-1 font-semibold">{dateLabel(value)}</div></div>)}</div> : <p className="mt-3 text-xs leading-5 text-champagne/45">No pickup, delivery, setup, collection or return dates are recorded for this booking.</p>}
                  {context.conversationId ? <Link href="/messages" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-gold underline underline-offset-4"><MessageCircle className="size-3.5" /> Open contextual booking conversation</Link> : <p className="mt-3 text-xs text-champagne/40">A booking conversation is created only when the booking enters a commercial coordination state.</p>}
                </section>
              </div> : <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-950/10 p-3 text-xs text-amber-100">Commercial context is not available for this record. Refresh before making a payment or funding decision.</div>}

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
