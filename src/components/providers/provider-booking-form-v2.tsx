'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, Loader2, MapPin, ShieldCheck, Sparkles, Truck } from 'lucide-react'
import type { BookingItem } from '@/components/providers/provider-booking-form'

type AddOn = { id?: string; name?: string; priceCents?: number; quantityMode?: string; description?: string }
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

type Step = 1 | 2 | 3

function money(cents: number | null, currency: string) {
  if (cents == null) return 'Vendor quote required'
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100) }
  catch { return `${currency} ${(cents / 100).toFixed(2)}` }
}

function localDateTime(date: string, time: string) {
  if (!date || !time) return null
  const value = new Date(`${date}T${time}`)
  return Number.isNaN(value.getTime()) ? null : value.toISOString()
}

function modeCopy(mode: string) {
  if (mode === 'instant') return { button: 'Reserve and book', helper: 'Wewed checks configured availability before confirming.' }
  if (mode === 'quote') return { button: 'Request quote', helper: 'The vendor confirms scope, availability and final price.' }
  if (mode === 'appointment') return { button: 'Request appointment', helper: 'Choose a preferred time; the vendor confirms the appointment.' }
  return { button: 'Request booking', helper: 'The vendor reviews and confirms this request.' }
}

function policyString(source: Record<string, unknown> | undefined, keys: string[]) {
  if (!source) return null
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function fallbackVisual(item: BookingItem) {
  const category = item.category.toLowerCase()
  const slug = item.slug.toLowerCase()
  if (category.includes('attire') || slug.includes('gown') || slug.includes('bridal')) return '/media/wewed/attire-gown-editorial.svg'
  if (category.includes('tent') || slug.includes('tent') || slug.includes('marquee')) return '/media/wewed/tent-exterior-editorial.svg'
  if (category.includes('decor') || slug.includes('chair') || slug.includes('decor')) return '/media/wewed/decor-ceremony-editorial.svg'
  return '/media/wewed/decor-tablescape-editorial.svg'
}

export function ProviderBookingFormV2({ providerSlug, providerName, item, referralToken }: { providerSlug: string; providerName: string; item: BookingItem; referralToken?: string | null }) {
  const [step, setStep] = useState<Step>(1)
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
  const cancellationPolicy = policyString(item.attributes, ['cancellationPolicy', 'cancellation_policy']) || policyString(item.availabilityPolicy, ['cancellationPolicy', 'cancellation_policy'])
  const refundPolicy = policyString(item.attributes, ['refundPolicy', 'refund_policy']) || policyString(item.availabilityPolicy, ['refundPolicy', 'refund_policy'])
  const hasLogistics = rentalLike || deliveryLike

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

  function validateBasics() {
    if (!eventDate) throw new Error('Choose the wedding or service date to continue.')
  }

  function validateLogistics() {
    if (rentalLike && returnDate && new Date(returnDate) < new Date(pickupDate || eventDate)) throw new Error('Return date must be after pickup.')
    if (deliveryLike && deliveryAt && setupStart && new Date(setupStart) < new Date(deliveryAt)) throw new Error('Setup cannot start before delivery.')
    if (deliveryLike && setupStart && setupEnd && new Date(setupEnd) <= new Date(setupStart)) throw new Error('Setup end must be after setup start.')
    if (deliveryLike && setupEnd && collectionAt && new Date(collectionAt) <= new Date(setupEnd)) throw new Error('Collection must be after setup is complete.')
  }

  function nextStep(next: Step) {
    setError('')
    try {
      if (step === 1) validateBasics()
      if (step === 2) validateLogistics()
      setStep(next)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Check the details before continuing.')
    }
  }

  async function checkLiveAvailability() {
    if (item.bookingMode !== 'instant') return null
    const startsAt = serviceStart || appointmentAt || pickupAt || deliveryAt || (eventDate ? new Date(`${eventDate}T00:00:00`).toISOString() : null)
    const endsAt = serviceEnd || returnDueAt || collectionAt || (appointmentAt ? new Date(new Date(appointmentAt).getTime() + 60 * 60_000).toISOString() : eventDate ? new Date(`${eventDate}T23:59:59`).toISOString() : null)
    if (!startsAt || !endsAt) throw new Error('Choose the date and time needed before checking availability.')
    const params = new URLSearchParams({ item: item.slug, startsAt, endsAt, quantity: String(quantity) })
    if (variantId) params.set('variantId', variantId)
    if (location.trim()) params.set('location', location.trim())
    if (selectedAddOns.length) params.set('addOns', selectedAddOns.join(','))
    const response = await fetch(`/api/providers/${encodeURIComponent(providerSlug)}/availability?${params.toString()}`, { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to check availability.')
    setAvailability(payload.data)
    if (!payload.data.available) throw new Error(`This selection is not currently available for the requested time${payload.data.reason ? ` (${String(payload.data.reason).replaceAll('_', ' ').toLowerCase()})` : ''}.`)
    return payload.data as AvailabilityResult
  }

  async function submit() {
    setBusy(true); setError(''); setSuccess(null); setSignInRequired(false)
    try {
      validateBasics(); validateLogistics()
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
    return <div className="mx-auto max-w-2xl rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8"><CheckCircle2 className="size-9 text-emerald-700" /><h2 className="mt-4 font-serif text-4xl text-[#17251f]">Booking recorded</h2><p className="mt-3 text-sm leading-6 text-emerald-950/75">Reference <strong>{success.reference}</strong>. Current status: <strong>{success.status?.replaceAll('_', ' ')}</strong>.</p><p className="mt-2 text-sm leading-6 text-emerald-950/65">This booking is attached to the active Wewed wedding. Booking status does not imply payment or couple funding.</p><div className="mt-5 flex flex-wrap gap-2"><Link href="/planner/bookings" className="rounded-xl bg-[#211a15] px-4 py-2.5 text-sm font-semibold text-white">Open My Bookings</Link><Link href={`/vendors/${encodeURIComponent(providerSlug)}`} className="rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#23382e]">Vendor profile</Link></div></div>
  }

  const currentMedia = item.media[activeMedia]
  const heroSrc = currentMedia?.type === 'image' ? currentMedia.url : fallbackVisual(item)
  const vendorMedia = Boolean(currentMedia?.type === 'image')

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,.82fr)_minmax(430px,1.18fr)] lg:items-start">
      <section className="overflow-hidden rounded-3xl border border-[#e1d5c6] bg-white lg:sticky lg:top-24">
        <div className="relative aspect-[16/9] overflow-hidden bg-[#eee7dc]"><img src={heroSrc} alt={vendorMedia ? currentMedia?.altText || item.name : `Wewed editorial visual for ${item.name}`} className="h-full w-full object-cover" /><span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] ${vendorMedia ? 'bg-black/70 text-white' : 'bg-[#fbf6ee]/92 text-[#5e4c36]'}`}>{vendorMedia ? 'Vendor photo' : 'Wewed editorial'}</span></div>
        {item.media.length > 1 ? <div className="flex gap-2 overflow-x-auto border-b border-[#ece2d6] p-3">{item.media.map((media, index) => <button key={media.id} type="button" onClick={() => setActiveMedia(index)} className={`h-12 w-16 shrink-0 overflow-hidden rounded-lg border ${index === activeMedia ? 'border-[#9a7938] ring-1 ring-[#9a7938]' : 'border-[#ded1c0]'}`}>{media.type === 'video' ? <span className="flex h-full items-center justify-center bg-[#211a15] text-[10px] text-white">Video</span> : <img src={media.thumbnailUrl || media.url} alt="" className="h-full w-full object-cover" />}</button>)}</div> : null}
        <div className="p-5 sm:p-6"><div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[.09em] text-[#887968]"><span>{item.category.replaceAll('-', ' ')}</span><span>· {item.bookingArchetype.replaceAll('_', ' ')}</span></div><h1 className="mt-2 font-serif text-4xl leading-[1.02] text-[#211a15]">{item.name}</h1>{item.description ? <p className="mt-3 text-sm leading-6 text-[#6e6257]">{item.description}</p> : null}<div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-[#f7f2eb] p-3"><ShieldCheck className="size-4 text-[#876629]" /><div className="mt-1 text-xs font-semibold text-[#312820]">{item.requiresContract ? 'Governed agreement' : 'Provider terms'}</div></div><div className="rounded-xl bg-[#f7f2eb] p-3"><CalendarDays className="size-4 text-[#876629]" /><div className="mt-1 text-xs font-semibold text-[#312820]">{item.bookingMode === 'instant' ? 'Live availability' : 'Vendor confirms'}</div></div></div><p className="mt-4 text-[10px] leading-4 text-[#887b6e]">Wewed editorial visuals are illustrative only and do not represent specific vendor inventory.</p></div>
      </section>

      <section className="rounded-3xl border border-[#e1d5c6] bg-white p-4 shadow-[0_12px_35px_rgba(48,34,21,.06)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#9a7938]">Book with {providerName}</p><h2 className="mt-1 font-serif text-3xl text-[#211a15]">A few details at a time</h2><p className="mt-1 text-xs leading-5 text-[#74685d]">{mode.helper}</p></div><div className="rounded-xl bg-[#f5efe7] px-3 py-2 text-right"><div className="text-[10px] uppercase tracking-[.08em] text-[#8b7b69]">Estimate</div><div className="mt-0.5 text-sm font-bold text-[#2b221c]">{price ? money(price.totalCents, price.currency) : money(item.basePriceCents, item.currency)}</div></div></div>

        <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Booking progress">{([1,2,3] as Step[]).map((value) => <button key={value} type="button" onClick={() => { if (value < step) setStep(value) }} className={`rounded-xl px-2 py-2 text-left ${step === value ? 'bg-[#211a15] text-white' : value < step ? 'bg-[#eee6da] text-[#55483d]' : 'bg-[#f8f4ee] text-[#998c80]'}`}><span className="block text-[9px] font-bold uppercase tracking-[.08em]">Step {value}</span><span className="mt-0.5 block text-xs font-semibold">{value === 1 ? 'Choose' : value === 2 ? 'Logistics' : 'Review'}</span></button>)}</div>

        {step === 1 ? <div className="mt-6 space-y-4">
          <div><h3 className="text-lg font-bold text-[#2e251e]">When and what?</h3><p className="mt-1 text-xs text-[#786c60]">Start with the minimum information needed to shape the request.</p></div>
          {item.variants.length > 0 ? <label className="block text-sm font-semibold text-[#3c3129]">Option<select value={variantId} onChange={(event) => setVariantId(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#ddcfbd] bg-white px-3"><option value="">Choose an option</option>{item.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}{Object.values(variant.optionValues || {}).length ? ` — ${Object.values(variant.optionValues).join(' / ')}` : ''}</option>)}</select></label> : null}
          <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold text-[#3c3129]">Date<input type="date" value={eventDate} onChange={(event) => { const value = event.target.value; setEventDate(value); if (!pickupDate) setPickupDate(value); if (!deliveryDate) setDeliveryDate(value); if (!collectionDate) setCollectionDate(value) }} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#ddcfbd] px-3" /></label><label className="text-sm font-semibold text-[#3c3129]">Quantity<input type="number" min={item.minQuantity || 1} max={item.maxQuantity || undefined} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#ddcfbd] px-3" /></label></div>
          {eventTimed ? <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold text-[#3c3129]">Start time<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#ddcfbd] px-3" /></label><label className="text-sm font-semibold text-[#3c3129]">Duration<input type="number" min={1} max={72} value={durationHours} onChange={(event) => setDurationHours(Math.max(1, Number(event.target.value) || 1))} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#ddcfbd] px-3" /></label></div> : null}
          {appointmentLike ? <label className="block text-sm font-semibold text-[#3c3129]">Preferred fitting / appointment time<input type="time" value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#ddcfbd] px-3" /></label> : null}
          {error ? <ErrorBox message={error} /> : null}
          <button type="button" onClick={() => nextStep(hasLogistics ? 2 : 3)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#211a15] px-4 text-sm font-bold text-white">Continue <ArrowRight className="size-4" /></button>
        </div> : null}

        {step === 2 ? <div className="mt-6 space-y-4">
          <div><h3 className="text-lg font-bold text-[#2e251e]">Pickup, delivery & return</h3><p className="mt-1 text-xs leading-5 text-[#786c60]">These fields appear only because this service has rental or delivery logistics.</p></div>
          {rentalLike ? <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold text-[#3c3129]">Pickup<input type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#ddcfbd] px-3" /><input aria-label="Pickup time" type="time" value={pickupTime} onChange={(event) => setPickupTime(event.target.value)} className="mt-2 min-h-10 w-full rounded-xl border border-[#ddcfbd] px-3" /></label><label className="text-sm font-semibold text-[#3c3129]">Return<input type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#ddcfbd] px-3" /><input aria-label="Return time" type="time" value={returnTime} onChange={(event) => setReturnTime(event.target.value)} className="mt-2 min-h-10 w-full rounded-xl border border-[#ddcfbd] px-3" /></label></div> : null}
          {deliveryLike ? <details className="rounded-2xl border border-[#e2d5c4] bg-[#faf7f2] p-4" open><summary className="cursor-pointer text-sm font-bold text-[#332921]"><Truck className="mr-1 inline size-4 text-[#8d6a2e]" /> Delivery & setup</summary><div className="mt-3 grid grid-cols-2 gap-3"><SmallTime label="Delivery date" type="date" value={deliveryDate} set={setDeliveryDate} /><SmallTime label="Delivery time" type="time" value={deliveryTime} set={setDeliveryTime} /><SmallTime label="Setup starts" type="time" value={setupStartTime} set={setSetupStartTime} /><SmallTime label="Setup ends" type="time" value={setupEndTime} set={setSetupEndTime} /><SmallTime label="Collection date" type="date" value={collectionDate} set={setCollectionDate} /><SmallTime label="Collection time" type="time" value={collectionTime} set={setCollectionTime} /></div></details> : null}
          <label className="block text-sm font-semibold text-[#3c3129]"><MapPin className="mr-1 inline size-4 text-[#8d6a2e]" /> Service / delivery location<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Venue or address" className="mt-1.5 min-h-11 w-full rounded-xl border border-[#ddcfbd] px-3" /></label>
          {error ? <ErrorBox message={error} /> : null}
          <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setStep(1)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#dacdbb] bg-white text-sm font-semibold text-[#4e4238]"><ArrowLeft className="size-4" /> Back</button><button type="button" onClick={() => nextStep(3)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#211a15] text-sm font-bold text-white">Review <ArrowRight className="size-4" /></button></div>
        </div> : null}

        {step === 3 ? <div className="mt-6 space-y-4">
          <div><h3 className="text-lg font-bold text-[#2e251e]">Review and send</h3><p className="mt-1 text-xs leading-5 text-[#786c60]">Add only what helps the vendor respond. Nothing here records a payment.</p></div>
          {!hasLogistics ? <label className="block text-sm font-semibold text-[#3c3129]"><MapPin className="mr-1 inline size-4 text-[#8d6a2e]" /> Service location<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Venue or address" className="mt-1.5 min-h-11 w-full rounded-xl border border-[#ddcfbd] px-3" /></label> : null}
          <label className="block text-sm font-semibold text-[#3c3129]">Guest count <span className="font-normal text-[#8b7f73]">(if relevant)</span><input type="number" min={0} value={guestCount} onChange={(event) => setGuestCount(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#ddcfbd] px-3" /></label>
          {addOns.length > 0 ? <fieldset><legend className="text-sm font-bold text-[#332921]">Optional extras</legend><div className="mt-2 grid gap-2">{addOns.map((addOn, index) => { const id = addOn.id || `addon-${index}`; return <label key={id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e2d5c4] p-3 text-sm"><input type="checkbox" className="mt-1 accent-[#9a7938]" checked={selectedAddOns.includes(id)} onChange={(event) => setSelectedAddOns((current) => event.target.checked ? [...current, id] : current.filter((value) => value !== id))} /><span><strong>{addOn.name || 'Extra'}</strong>{Number.isInteger(addOn.priceCents) ? <span className="ml-1 text-[#75685c]">+ {money(addOn.priceCents || 0, item.currency)}</span> : null}{addOn.description ? <span className="mt-1 block text-xs text-[#827568]">{addOn.description}</span> : null}</span></label> })}</div></fieldset> : null}
          <label className="block text-sm font-semibold text-[#3c3129]">Notes <span className="font-normal text-[#8b7f73]">(optional)</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Sizes, colours, setup details, special requests…" className="mt-1.5 w-full rounded-xl border border-[#ddcfbd] px-3 py-2" /></label>

          <div className="rounded-2xl bg-[#f7f2eb] p-4"><div className="flex items-center justify-between gap-4"><span className="text-sm text-[#716559]">Estimated total</span><strong className="text-base text-[#211a15]">{price ? money(price.totalCents, price.currency) : money(item.basePriceCents, item.currency)}</strong></div>{price?.depositCents != null ? <div className="mt-1 flex justify-between text-xs text-[#766a5e]"><span>Quoted/configured deposit</span><span>{money(price.depositCents, price.currency)}</span></div> : null}{price?.state === 'quote_required' ? <p className="mt-2 text-xs leading-5 text-[#7c7064]">Wewed does not invent a price. {providerName} will quote the selected scope.</p> : null}</div>

          {(cancellationPolicy || refundPolicy) ? <details className="rounded-xl border border-[#e4d7c5] bg-white p-3"><summary className="cursor-pointer text-xs font-bold text-[#4a3b2f]">Commercial policy</summary><div className="mt-2 text-xs leading-5 text-[#75695d]">{cancellationPolicy ? <p><strong>Cancellation:</strong> {cancellationPolicy}</p> : null}{refundPolicy ? <p className="mt-1"><strong>Refund:</strong> {refundPolicy}</p> : null}</div></details> : null}
          {availability ? <div className={`rounded-xl p-3 text-sm ${availability.available ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}><Clock3 className="mr-1 inline size-4" /> {availability.available ? `${availability.availableQuantity} available for this exact selection.` : 'This exact selection is not currently available.'}</div> : null}
          {error ? <ErrorBox message={error} signInRequired={signInRequired} /> : null}

          <div className="grid grid-cols-[.7fr_1.3fr] gap-2"><button type="button" onClick={() => setStep(hasLogistics ? 2 : 1)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#dacdbb] bg-white text-sm font-semibold text-[#4e4238]"><ArrowLeft className="size-4" /> Back</button><button type="button" disabled={busy} onClick={submit} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#211a15] px-4 text-sm font-bold text-white disabled:opacity-60">{busy ? <><Loader2 className="size-4 animate-spin" /> Processing…</> : <>{mode.button} <ArrowRight className="size-4" /></>}</button></div>
          <p className="text-center text-[10px] leading-5 text-[#877a6d]"><Sparkles className="mr-1 inline size-3" />A request, hold or booking is not a payment. Funding and contributions stay separate in Wewed.</p>
        </div> : null}
      </section>
    </div>
  )
}

function SmallTime({ label, type, value, set }: { label: string; type: 'date' | 'time'; value: string; set: (value: string) => void }) {
  return <label className="text-xs font-semibold text-[#51453b]">{label}<input type={type} value={value} onChange={(event) => set(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-[#ddcfbd] bg-white px-2" /></label>
}

function ErrorBox({ message, signInRequired = false }: { message: string; signInRequired?: boolean }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{message}{signInRequired ? <div className="mt-2"><Link href="/sign-in" className="font-semibold underline">Sign in to continue</Link></div> : null}</div>
}
