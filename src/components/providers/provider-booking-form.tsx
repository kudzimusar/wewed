'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock3, Loader2, MapPin, ShieldCheck, Truck } from 'lucide-react'

type Media = { id: string; type: 'image' | 'video'; url: string; thumbnailUrl?: string | null; altText?: string; caption?: string | null; variantId?: string | null }
type Variant = { id: string; name: string; sku: string; optionValues: Record<string, unknown>; priceOverrideCents: number | null; inventoryMode: string }
type AddOn = { id?: string; name?: string; priceCents?: number; quantityMode?: string; description?: string }
export type BookingItem = {
  id: string
  slug: string
  name: string
  description: string | null
  category: string
  bookingArchetype: string
  bookingMode: string
  basePriceCents: number | null
  currency: string
  pricingUnit: string | null
  minQuantity: number | null
  maxQuantity: number | null
  requiresFitting: boolean
  requiresContract: boolean
  variants: Variant[]
  media: Media[]
  addOns: unknown[]
  attributes?: Record<string, unknown>
  availabilityPolicy?: Record<string, unknown>
}

type PriceResult = {
  state: 'calculated' | 'quote_required'
  currency: string
  quantity: number
  unitPriceCents: number | null
  subtotalCents: number | null
  feesCents: number | null
  depositCents: number | null
  totalCents: number | null
  lines: Array<{ id: string; name: string; priceCents: number; quantity: number }>
}

type AvailabilityResult = { state: string; available: boolean; availableQuantity: number; requestedQuantity: number; reason: string }

function money(cents: number | null, currency: string) {
  if (cents == null) return 'Vendor quote required'
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100) } catch { return `${currency} ${(cents / 100).toFixed(2)}` }
}

function localDateTime(date: string, time: string) {
  if (!date || !time) return null
  const value = new Date(`${date}T${time}`)
  return Number.isNaN(value.getTime()) ? null : value.toISOString()
}

function modeCopy(mode: string) {
  if (mode === 'instant') return { button: 'Reserve and book', helper: 'Wewed checks live configured inventory before confirming.' }
  if (mode === 'quote') return { button: 'Request quote', helper: 'The vendor will confirm scope, availability and final price.' }
  if (mode === 'appointment') return { button: 'Request appointment', helper: 'The vendor will confirm the appointment slot unless Instant Book is enabled.' }
  return { button: 'Request booking', helper: 'The vendor will review and confirm this request.' }
}

function policyString(source: Record<string, unknown> | undefined, keys: string[]) {
  if (!source) return null
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

export function ProviderBookingForm({ providerSlug, providerName, item, referralToken }: { providerSlug: string; providerName: string; item: BookingItem; referralToken?: string | null }) {
  const [variantId, setVariantId] = useState(item.variants[0]?.id || '')
  const [quantity, setQuantity] = useState(Math.max(1, item.minQuantity || 1))
  const [eventDate, setEventDate] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [durationHours, setDurationHours] = useState(8)
  const [appointmentTime, setAppointmentTime] = useState('10:00')
  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('10:00')
  const [returnDate, setReturnDate] = useState('')
  const [returnTime, setReturnTime] = useState('10:00')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('08:00')
  const [setupStartTime, setSetupStartTime] = useState('09:00')
  const [setupEndTime, setSetupEndTime] = useState('10:00')
  const [collectionDate, setCollectionDate] = useState('')
  const [collectionTime, setCollectionTime] = useState('22:00')
  const [location, setLocation] = useState('')
  const [guestCount, setGuestCount] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([])
  const [price, setPrice] = useState<PriceResult | null>(null)
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ reference?: string; status?: string; id?: string } | null>(null)
  const [signInRequired, setSignInRequired] = useState(false)
  const [activeMedia, setActiveMedia] = useState(0)

  const addOns = useMemo(() => (item.addOns || []).filter((raw): raw is AddOn => Boolean(raw && typeof raw === 'object')), [item.addOns])
  const mode = modeCopy(item.bookingMode)
  const rentalLike = ['individual_rental', 'quantity_rental', 'hybrid'].includes(item.bookingArchetype)
  const deliveryLike = ['quantity_rental', 'capacity', 'transport', 'package', 'hybrid'].includes(item.bookingArchetype)
  const appointmentLike = item.bookingArchetype === 'appointment' || item.requiresFitting
  const eventTimed = ['timed_service', 'event_day_service', 'capacity', 'transport'].includes(item.bookingArchetype)
  const cancellationPolicy = policyString(item.attributes, ['cancellationPolicy','cancellation_policy']) || policyString(item.availabilityPolicy, ['cancellationPolicy','cancellation_policy'])
  const refundPolicy = policyString(item.attributes, ['refundPolicy','refund_policy']) || policyString(item.availabilityPolicy, ['refundPolicy','refund_policy'])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/providers/${encodeURIComponent(providerSlug)}/price`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ itemSlug: item.slug, variantId: variantId || null, quantity, selectedAddOns }),
        })
        const payload = await response.json()
        if (response.ok && payload.success) setPrice(payload.data)
      } catch (reason) {
        if ((reason as Error)?.name !== 'AbortError') setPrice(null)
      }
    }, 180)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [providerSlug, item.slug, variantId, quantity, selectedAddOns])

  const serviceStart = eventTimed ? localDateTime(eventDate, startTime) : null
  const serviceEnd = serviceStart ? new Date(new Date(serviceStart).getTime() + Math.max(1, durationHours) * 60 * 60_000).toISOString() : null
  const appointmentAt = appointmentLike ? localDateTime(eventDate, appointmentTime) : null
  const pickupAt = rentalLike ? localDateTime(pickupDate || eventDate, pickupTime) : null
  const returnDueAt = rentalLike && returnDate ? localDateTime(returnDate, returnTime) : null
  const deliveryAt = deliveryLike ? localDateTime(deliveryDate || eventDate, deliveryTime) : null
  const setupStart = deliveryLike ? localDateTime(deliveryDate || eventDate, setupStartTime) : null
  const setupEnd = deliveryLike ? localDateTime(deliveryDate || eventDate, setupEndTime) : null
  const collectionAt = deliveryLike ? localDateTime(collectionDate || eventDate, collectionTime) : null

  async function checkLiveAvailability() {
    if (item.bookingMode !== 'instant') return null
    const startsAt = serviceStart || appointmentAt || pickupAt || deliveryAt || (eventDate ? new Date(`${eventDate}T00:00:00`).toISOString() : null)
    const endsAt = serviceEnd || returnDueAt || collectionAt || (appointmentAt ? new Date(new Date(appointmentAt).getTime() + 60 * 60_000).toISOString() : eventDate ? new Date(`${eventDate}T23:59:59`).toISOString() : null)
    if (!startsAt || !endsAt) throw new Error('Choose the date and time needed before checking availability.')
    const params = new URLSearchParams({ item: item.slug, startsAt, endsAt, quantity: String(quantity) })
    if (variantId) params.set('variantId', variantId)
    const response = await fetch(`/api/providers/${encodeURIComponent(providerSlug)}/availability?${params.toString()}`, { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to check availability.')
    setAvailability(payload.data)
    if (!payload.data.available) throw new Error('This selection is not currently available for the requested time.')
    return payload.data as AvailabilityResult
  }

  async function submit() {
    setBusy(true); setError(''); setSuccess(null); setSignInRequired(false)
    try {
      if (!eventDate) throw new Error('Choose the wedding or service date.')
      if (rentalLike && returnDate && new Date(returnDate) < new Date(pickupDate || eventDate)) throw new Error('Return date must be after pickup.')
      if (deliveryLike && deliveryAt && setupStart && new Date(setupStart) < new Date(deliveryAt)) throw new Error('Setup cannot start before delivery.')
      if (deliveryLike && setupStart && setupEnd && new Date(setupEnd) <= new Date(setupStart)) throw new Error('Setup end must be after setup start.')
      if (deliveryLike && setupEnd && collectionAt && new Date(collectionAt) <= new Date(setupEnd)) throw new Error('Collection must be after setup is complete.')
      if (item.bookingMode === 'instant') await checkLiveAvailability()

      const draftResponse = await fetch('/api/bookings', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id, variantId: variantId || null, quantity, selectedAddOns, eventDate,
          serviceStart, serviceEnd, appointmentAt, pickupAt, deliveryAt, setupStart, setupEnd, collectionAt, returnDueAt,
          serviceLocation: location || null, guestCount: guestCount ? Number(guestCount) : null,
          notes: notes || null, referralToken: referralToken || null,
        }),
      })
      const draftPayload = await draftResponse.json()
      if (draftResponse.status === 401 || draftResponse.status === 403) { setSignInRequired(true); throw new Error('Sign in to Wewed with access to your wedding before booking.') }
      if (!draftResponse.ok || !draftPayload.success) throw new Error(draftPayload.error || 'Unable to start booking.')
      let booking = draftPayload.data as Record<string, unknown>

      if (item.bookingMode === 'instant') {
        const holdResponse = await fetch(`/api/bookings/${encodeURIComponent(String(booking.id))}/hold`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
        })
        const holdPayload = await holdResponse.json()
        if (!holdResponse.ok || !holdPayload.success) throw new Error(holdPayload.error || 'Availability could not be reserved.')
        booking = holdPayload.data
      }

      const submitResponse = await fetch(`/api/bookings/${encodeURIComponent(String(booking.id))}/submit`, { method: 'POST' })
      const submitPayload = await submitResponse.json()
      if (!submitResponse.ok || !submitPayload.success) throw new Error(submitPayload.error || 'Unable to submit booking.')
      const completed = submitPayload.data as Record<string, unknown>
      setSuccess({ reference: String(completed.publicReference || ''), status: String(completed.status || ''), id: String(completed.id || '') })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to submit booking.')
    } finally { setBusy(false) }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <CheckCircle2 className="h-8 w-8 text-emerald-700" />
        <h2 className="mt-3 text-xl font-semibold text-slate-950">Booking recorded</h2>
        <p className="mt-2 text-sm text-slate-700">Reference <strong>{success.reference}</strong>. Current status: <strong>{success.status?.replaceAll('_', ' ')}</strong>.</p>
        <p className="mt-2 text-sm text-slate-600">This booking is now attached to the active Wewed wedding. Booking status does not imply payment or couple funding; My Bookings shows contract, payment, contribution and operational truth separately.</p>
        <div className="mt-4 flex flex-wrap gap-2"><Link href="/planner/bookings" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Open My Bookings</Link><Link href={`/vendors/${encodeURIComponent(providerSlug)}`} className="rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold">Vendor profile</Link></div>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(330px,.9fr)]">
      <div>
        <div className="overflow-hidden rounded-2xl border bg-white">
          {item.media.length > 0 ? (
            <>
              <div className="aspect-[4/3] bg-slate-100">
                {item.media[activeMedia]?.type === 'video' ? <video className="h-full w-full object-cover" controls preload="metadata" src={item.media[activeMedia].url} /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={item.media[activeMedia].url} alt={item.media[activeMedia].altText || item.name} className="h-full w-full object-cover" />}
              </div>
              {item.media.length > 1 && <div className="flex gap-2 overflow-x-auto p-3">{item.media.map((media, index) => <button key={media.id} type="button" onClick={() => setActiveMedia(index)} className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border ${index === activeMedia ? 'ring-2 ring-slate-900' : ''}`}>{media.type === 'video' ? <span className="flex h-full items-center justify-center bg-slate-900 text-xs text-white">Video</span> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={media.thumbnailUrl || media.url} alt="" className="h-full w-full object-cover" />}</button>)}</div>}
            </>
          ) : <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 text-sm text-slate-500">{providerName} has not published product media yet.</div>}
        </div>
        <div className="mt-5 rounded-2xl border bg-white p-5">
          <div className="flex flex-wrap gap-2 text-xs text-slate-600"><span className="rounded-full bg-slate-100 px-2.5 py-1">{item.category.replaceAll('-', ' ')}</span><span className="rounded-full bg-slate-100 px-2.5 py-1">{item.bookingArchetype.replaceAll('_', ' ')}</span></div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">{item.name}</h1>
          {item.description && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{item.description}</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3 text-sm"><ShieldCheck className="mb-1 h-4 w-4 text-slate-700" /><strong>Terms</strong><div className="mt-1 text-slate-600">{item.requiresContract ? 'Agreement required before the commercial commitment becomes effective.' : 'Provider booking terms apply.'}</div></div>
            <div className="rounded-xl bg-slate-50 p-3 text-sm"><CalendarDays className="mb-1 h-4 w-4 text-slate-700" /><strong>Availability</strong><div className="mt-1 text-slate-600">{item.bookingMode === 'instant' ? 'Checked against configured live resources.' : 'Confirmed by the vendor after your request.'}</div></div>
          </div>
          {(cancellationPolicy || refundPolicy) ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-slate-700"><strong>Commercial policy</strong>{cancellationPolicy ? <p className="mt-1"><span className="font-medium">Cancellation:</span> {cancellationPolicy}</p> : null}{refundPolicy ? <p className="mt-1"><span className="font-medium">Refund:</span> {refundPolicy}</p> : null}</div> : null}
        </div>
      </div>

      <aside className="h-fit rounded-2xl border bg-white p-5 shadow-sm lg:sticky lg:top-4">
        <h2 className="text-lg font-semibold text-slate-950">Book with {providerName}</h2>
        <p className="mt-1 text-sm text-slate-600">{mode.helper}</p>

        {item.variants.length > 0 && <label className="mt-5 block text-sm font-medium text-slate-800">Option<select value={variantId} onChange={(event) => setVariantId(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border bg-white px-3"><option value="">Choose an option</option>{item.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}{Object.values(variant.optionValues || {}).length ? ` — ${Object.values(variant.optionValues).join(' / ')}` : ''}</option>)}</select></label>}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-sm font-medium text-slate-800">Date<input type="date" value={eventDate} onChange={(event) => { const value = event.target.value; setEventDate(value); if (!pickupDate) setPickupDate(value); if (!deliveryDate) setDeliveryDate(value); if (!collectionDate) setCollectionDate(value) }} className="mt-1.5 min-h-11 w-full rounded-xl border px-3" /></label>
          <label className="text-sm font-medium text-slate-800">Quantity<input type="number" min={item.minQuantity || 1} max={item.maxQuantity || undefined} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} className="mt-1.5 min-h-11 w-full rounded-xl border px-3" /></label>
        </div>

        {eventTimed && <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm font-medium text-slate-800">Start time<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border px-3" /></label><label className="text-sm font-medium text-slate-800">Duration (hours)<input type="number" min={1} max={72} value={durationHours} onChange={(event) => setDurationHours(Math.max(1, Number(event.target.value) || 1))} className="mt-1.5 min-h-11 w-full rounded-xl border px-3" /></label></div>}
        {appointmentLike && <label className="mt-4 block text-sm font-medium text-slate-800">Preferred fitting / appointment time<input type="time" value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border px-3" /></label>}
        {rentalLike && <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm font-medium text-slate-800">Pickup<input type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border px-3" /><input aria-label="Pickup time" type="time" value={pickupTime} onChange={(event) => setPickupTime(event.target.value)} className="mt-2 min-h-10 w-full rounded-xl border px-3" /></label><label className="text-sm font-medium text-slate-800">Return<input type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border px-3" /><input aria-label="Return time" type="time" value={returnTime} onChange={(event) => setReturnTime(event.target.value)} className="mt-2 min-h-10 w-full rounded-xl border px-3" /></label></div>}

        {deliveryLike && <fieldset className="mt-5 rounded-xl border bg-slate-50 p-3"><legend className="px-1 text-sm font-semibold text-slate-900"><Truck className="mr-1 inline h-4 w-4" /> Delivery & setup</legend><div className="mt-2 grid grid-cols-2 gap-3"><label className="text-xs font-medium text-slate-700">Delivery date<input type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2" /></label><label className="text-xs font-medium text-slate-700">Delivery time<input type="time" value={deliveryTime} onChange={(event) => setDeliveryTime(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2" /></label><label className="text-xs font-medium text-slate-700">Setup starts<input type="time" value={setupStartTime} onChange={(event) => setSetupStartTime(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2" /></label><label className="text-xs font-medium text-slate-700">Setup ends<input type="time" value={setupEndTime} onChange={(event) => setSetupEndTime(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2" /></label><label className="text-xs font-medium text-slate-700">Collection date<input type="date" value={collectionDate} onChange={(event) => setCollectionDate(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2" /></label><label className="text-xs font-medium text-slate-700">Collection time<input type="time" value={collectionTime} onChange={(event) => setCollectionTime(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border bg-white px-2" /></label></div><p className="mt-2 text-[11px] leading-4 text-slate-500">Only record times actually agreed or requested. Vendor confirmation may still be required depending on booking mode.</p></fieldset>}

        <label className="mt-4 block text-sm font-medium text-slate-800"><MapPin className="mr-1 inline h-4 w-4" /> Service / delivery location<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Venue or address" className="mt-1.5 min-h-11 w-full rounded-xl border px-3" /></label>
        <label className="mt-4 block text-sm font-medium text-slate-800">Guest count (if relevant)<input type="number" min={0} value={guestCount} onChange={(event) => setGuestCount(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border px-3" /></label>

        {addOns.length > 0 && <fieldset className="mt-5"><legend className="text-sm font-semibold text-slate-900">Extras</legend><div className="mt-2 space-y-2">{addOns.map((addOn, index) => { const id = addOn.id || `addon-${index}`; return <label key={id} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" className="mt-1" checked={selectedAddOns.includes(id)} onChange={(event) => setSelectedAddOns((current) => event.target.checked ? [...current, id] : current.filter((value) => value !== id))} /><span><strong>{addOn.name || 'Extra'}</strong>{Number.isInteger(addOn.priceCents) && <span className="ml-1 text-slate-600">+ {money(addOn.priceCents || 0, item.currency)}</span>}{addOn.description && <span className="mt-1 block text-xs text-slate-500">{addOn.description}</span>}</span></label> })}</div></fieldset>}

        <label className="mt-4 block text-sm font-medium text-slate-800">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Sizes, colours, setup details, special requests…" className="mt-1.5 w-full rounded-xl border px-3 py-2" /></label>

        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4"><span className="text-sm text-slate-600">Estimated total</span><strong className="text-base text-slate-950">{price ? money(price.totalCents, price.currency) : money(item.basePriceCents, item.currency)}</strong></div>
          {price?.depositCents != null && <div className="mt-1 flex justify-between text-xs text-slate-600"><span>Quoted/configured deposit</span><span>{money(price.depositCents, price.currency)}</span></div>}
          {price?.state === 'quote_required' && <p className="mt-2 text-xs text-slate-500">Wewed has not invented a price. {providerName} will provide a quote for the selected scope.</p>}
        </div>

        {availability && <div className={`mt-3 rounded-xl p-3 text-sm ${availability.available ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}><Clock3 className="mr-1 inline h-4 w-4" /> {availability.available ? `${availability.availableQuantity} available for this window.` : 'This exact selection is not currently available.'}</div>}
        {error && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}{signInRequired && <div className="mt-2"><Link href="/sign-in" className="font-semibold underline">Sign in to continue</Link></div>}</div>}

        <button type="button" disabled={busy} onClick={submit} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</> : mode.button}</button>
        <p className="mt-3 text-xs leading-5 text-slate-500">A request, hold or booking is not a payment. Funding and contributions remain separately recorded in Wewed.</p>
      </aside>
    </div>
  )
}
