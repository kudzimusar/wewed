'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BadgeCheck, BriefcaseBusiness, CalendarDays, Check, Clock3, Globe2, Loader2, Mail, MapPin, Phone, Send, ShieldCheck, Users } from 'lucide-react'
import { PublicPlatformShell } from '@/components/public/public-platform-shell'
import { providerCategoryLabel, providerServiceFields, type ProviderFieldDefinition } from '@/lib/provider-catalog'

type Package = { id: string; name: string; description: string | null; priceCents: number | null; currency: string; pricingUnit: string | null; inclusions: string[] }
type Portfolio = { id: string; type: string; url: string; thumbnailUrl: string | null; altText: string; caption: string | null }
type Offering = {
  id: string
  category: string
  displayName: string
  description: string | null
  startingPriceCents: number | null
  maximumPriceCents: number | null
  currency: string
  pricingModel: string | null
  minimumCapacity: number | null
  maximumCapacity: number | null
  bookingLeadTime: string | null
  serviceAreas: string[]
  inclusions: string[]
  details: Record<string, unknown>
  packages: Package[]
  portfolio: Portfolio[]
}
type Provider = {
  id: string
  slug: string
  displayName: string
  headline: string | null
  description: string | null
  country: string | null
  city: string | null
  serviceAreas: string[]
  languages: string[]
  publicEmail: string | null
  phone: string | null
  website: string | null
  socialLinks: Record<string, unknown>
  yearsOperating: number | null
  teamSize: number | null
  responseTime: string | null
  minimumBookingNotice: string | null
  travelRadiusKm: number | null
  paymentMethods: string[]
  depositPolicy: string | null
  cancellationPolicy: string | null
  refundPolicy: string | null
  travelPolicy: string | null
  accessibilitySupport: string | null
  culturalExperience: string | null
  coverImageUrl: string | null
  faq: Array<{ question?: string; answer?: string }>
  verificationBadges: string[]
  lastProfileUpdate: string | null
  offerings: Offering[]
}

const inputClass = 'h-11 w-full rounded-xl border border-gold/25 bg-white px-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20'
const textareaClass = 'min-h-24 w-full rounded-xl border border-gold/25 bg-white px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20'

function valueList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function money(cents: number | null, currency: string): string | null {
  if (cents == null) return null
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100)
}

function detailLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ').replace(/^./, (character) => character.toUpperCase())
}

export function PublicProviderProfile({ slug }: { slug: string }) {
  const [provider, setProvider] = useState<Provider | null>(null)
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetch(`/api/providers/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as { provider?: Provider; error?: string }
        if (!response.ok || !payload.provider) throw new Error(payload.error || 'Provider profile unavailable.')
        if (!cancelled) setProvider(payload.provider)
      })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Provider profile unavailable.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug])

  const offering = provider?.offerings[active] ?? null
  const fields = useMemo(() => offering ? providerServiceFields(offering.category) : [], [offering])

  async function submitEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!offering) return
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/providers/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offeringId: offering.id,
          eventDate: form.get('eventDate'),
          location: form.get('location'),
          guestCount: form.get('guestCount'),
          budgetBand: form.get('budgetBand'),
          contactPreference: form.get('contactPreference'),
          message: form.get('message'),
          structuredAnswers: answers,
          sharedSummary: {
            weddingTitle: form.get('shareWeddingTitle') === 'on',
            weddingDate: form.get('shareWeddingDate') === 'on',
            location: form.get('shareLocation') === 'on',
            guestCount: form.get('shareGuestCount') === 'on',
            budgetBand: form.get('shareBudget') === 'on',
          },
        }),
      })
      const payload = await response.json() as { success?: boolean; error?: string }
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to send the enquiry.')
      setNotice('Your structured enquiry was sent. No wedding access or provider authority was created.')
      setAnswers({})
      event.currentTarget.reset()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to send the enquiry.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PublicPlatformShell>
      {loading && <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-gold-muted" /></div>}
      {!loading && error && !provider && <div className="mx-auto max-w-3xl px-4 py-24 text-center"><h1 className="font-serif text-5xl">Provider profile unavailable</h1><p role="alert" className="mt-4 text-espresso/60">{error}</p><Link href="/vendors" className="mt-8 inline-flex rounded-full bg-espresso px-6 py-3 text-sm font-semibold text-champagne">Return to providers</Link></div>}
      {provider && offering && (
        <>
          <section className="relative isolate overflow-hidden bg-espresso text-champagne">
            {provider.coverImageUrl && <img src={provider.coverImageUrl} alt="" className="absolute inset-0 size-full object-cover opacity-45" />}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,14,10,0.98),rgba(20,14,10,0.78),rgba(20,14,10,0.45))]" />
            <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.15em] text-gold"><span>{providerCategoryLabel(offering.category)}</span>{provider.verificationBadges.map((badge) => <span key={badge} className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-black/20 px-3 py-1"><BadgeCheck className="size-3.5" />{badge}</span>)}</div>
              <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-tight sm:text-7xl">{provider.displayName}</h1>
              {provider.headline && <p className="mt-4 max-w-3xl text-lg text-champagne/75">{provider.headline}</p>}
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-champagne/65">
                {(provider.city || provider.country) && <span className="inline-flex items-center gap-2"><MapPin className="size-4 text-gold" />{[provider.city, provider.country].filter(Boolean).join(', ')}</span>}
                {provider.responseTime && <span className="inline-flex items-center gap-2"><Clock3 className="size-4 text-gold" />Responds {provider.responseTime.toLowerCase()}</span>}
                {provider.minimumBookingNotice && <span className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-gold" />Book {provider.minimumBookingNotice.toLowerCase()} ahead</span>}
              </div>
            </div>
          </section>

          <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <div className="grid gap-8 lg:grid-cols-[1fr_23rem]">
              <div className="space-y-8">
                {provider.description && <section className="rounded-3xl border border-gold/20 bg-white p-7"><h2 className="font-serif text-3xl">About the business</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-espresso/68">{provider.description}</p><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{provider.yearsOperating != null && <Fact icon={<BriefcaseBusiness className="size-4" />} label="Years operating" value={String(provider.yearsOperating)} />}{provider.teamSize != null && <Fact icon={<Users className="size-4" />} label="Team size" value={String(provider.teamSize)} />}{provider.languages.length > 0 && <Fact icon={<Globe2 className="size-4" />} label="Languages" value={provider.languages.join(', ')} />}</div></section>}

                <section className="rounded-3xl border border-gold/20 bg-white p-7">
                  <h2 className="font-serif text-3xl">Services</h2>
                  <div className="mt-4 flex flex-wrap gap-2">{provider.offerings.map((entry, index) => <button key={entry.id} type="button" onClick={() => { setActive(index); setAnswers({}) }} className={`rounded-full px-4 py-2 text-xs font-semibold ${active === index ? 'bg-espresso text-champagne' : 'border border-gold/25 text-gold-muted'}`}>{providerCategoryLabel(entry.category)}</button>)}</div>
                  <div className="mt-7 rounded-2xl bg-champagne/55 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-muted">{providerCategoryLabel(offering.category)}</p><h3 className="mt-2 font-serif text-3xl">{offering.displayName}</h3></div><div className="text-right">{money(offering.startingPriceCents, offering.currency) && <><p className="text-xs text-espresso/50">Starting from</p><p className="mt-1 text-2xl font-semibold">{money(offering.startingPriceCents, offering.currency)}</p></>}</div></div>
                    {offering.description && <p className="mt-4 text-sm leading-7 text-espresso/65">{offering.description}</p>}
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">{offering.bookingLeadTime && <Fact icon={<CalendarDays className="size-4" />} label="Booking lead time" value={offering.bookingLeadTime} />}{(offering.minimumCapacity != null || offering.maximumCapacity != null) && <Fact icon={<Users className="size-4" />} label="Capacity" value={`${offering.minimumCapacity ?? 'Any'}–${offering.maximumCapacity ?? 'Any'}`} />}</div>
                    {offering.inclusions.length > 0 && <div className="mt-6"><h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-gold-muted">Included</h4><div className="mt-3 grid gap-2 sm:grid-cols-2">{offering.inclusions.map((item) => <span key={item} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-sage" />{item}</span>)}</div></div>}
                    {Object.keys(offering.details).length > 0 && <div className="mt-6 grid gap-3 sm:grid-cols-2">{Object.entries(offering.details).filter(([, value]) => value != null && value !== '' && (!Array.isArray(value) || value.length > 0)).map(([key, value]) => <div key={key} className="rounded-xl border border-gold/15 bg-white/75 p-4"><p className="text-[10px] uppercase tracking-[0.12em] text-gold-muted">{detailLabel(key)}</p><p className="mt-2 text-sm">{Array.isArray(value) ? value.join(', ') : String(value)}</p></div>)}</div>}
                  </div>
                </section>

                {offering.packages.length > 0 && <section className="rounded-3xl border border-gold/20 bg-white p-7"><h2 className="font-serif text-3xl">Packages</h2><div className="mt-5 grid gap-4 md:grid-cols-2">{offering.packages.map((item) => <article key={item.id} className="rounded-2xl border border-gold/20 bg-ivory p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-serif text-2xl">{item.name}</h3>{money(item.priceCents, item.currency) && <span className="font-semibold">{money(item.priceCents, item.currency)}</span>}</div>{item.description && <p className="mt-3 text-sm leading-6 text-espresso/60">{item.description}</p>}{item.inclusions.length > 0 && <ul className="mt-4 space-y-2 text-xs">{item.inclusions.map((inclusion) => <li key={inclusion} className="flex gap-2"><Check className="size-3.5 shrink-0 text-sage" />{inclusion}</li>)}</ul>}</article>)}</div></section>}

                {offering.portfolio.length > 0 && <section className="rounded-3xl border border-gold/20 bg-white p-7"><h2 className="font-serif text-3xl">Portfolio</h2><div className="mt-5 grid gap-4 sm:grid-cols-2">{offering.portfolio.map((item) => item.type === 'image' ? <figure key={item.id} className="overflow-hidden rounded-2xl border border-gold/15"><img src={item.url} alt={item.altText} className="aspect-[4/3] w-full object-cover" />{item.caption && <figcaption className="p-3 text-xs text-espresso/55">{item.caption}</figcaption>}</figure> : <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="rounded-2xl border border-gold/20 bg-champagne p-5 font-semibold text-gold-muted">Open {item.type === 'video' ? 'video' : 'portfolio item'}</a>)}</div></section>}

                {(provider.depositPolicy || provider.cancellationPolicy || provider.refundPolicy || provider.travelPolicy) && <section className="rounded-3xl border border-gold/20 bg-white p-7"><h2 className="font-serif text-3xl">Booking policies</h2><div className="mt-5 space-y-4">{provider.depositPolicy && <Policy title="Deposit" value={provider.depositPolicy} />}{provider.cancellationPolicy && <Policy title="Cancellation" value={provider.cancellationPolicy} />}{provider.refundPolicy && <Policy title="Refunds" value={provider.refundPolicy} />}{provider.travelPolicy && <Policy title="Travel" value={provider.travelPolicy} />}</div></section>}

                {provider.faq.length > 0 && <section className="rounded-3xl border border-gold/20 bg-white p-7"><h2 className="font-serif text-3xl">Frequently asked questions</h2><div className="mt-5 space-y-3">{provider.faq.map((item, index) => item.question && item.answer ? <details key={`${item.question}-${index}`} className="rounded-xl border border-gold/15 bg-ivory p-4"><summary className="cursor-pointer font-semibold">{item.question}</summary><p className="mt-3 text-sm leading-6 text-espresso/60">{item.answer}</p></details> : null)}</div></section>}
              </div>

              <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
                <section className="rounded-3xl bg-espresso p-6 text-champagne">
                  <ShieldCheck className="size-6 text-gold" />
                  <h2 className="mt-4 font-serif text-3xl">Send a secure enquiry</h2>
                  <p className="mt-3 text-sm leading-6 text-champagne/65">Questions adapt to {providerCategoryLabel(offering.category).toLowerCase()}. Sending an enquiry never grants wedding access.</p>
                  <form onSubmit={submitEnquiry} className="mt-5 space-y-4">
                    <label className="block text-xs text-champagne/65">Wedding date<input name="eventDate" type="date" className={`${inputClass} mt-1.5`} /></label>
                    <label className="block text-xs text-champagne/65">Location<input name="location" className={`${inputClass} mt-1.5`} /></label>
                    <label className="block text-xs text-champagne/65">Guest count<input name="guestCount" type="number" min="0" max="100000" className={`${inputClass} mt-1.5`} /></label>
                    <label className="block text-xs text-champagne/65">Budget range<select name="budgetBand" className={`${inputClass} mt-1.5`}><option value="">Select…</option><option>Under USD 5,000</option><option>USD 5,000–15,000</option><option>USD 15,000–30,000</option><option>USD 30,000–75,000</option><option>USD 75,000+</option><option>By consultation</option></select></label>
                    {fields.map((field) => <EnquiryField key={field.key} field={field} value={answers[field.key]} onChange={(value) => setAnswers((current) => ({ ...current, [field.key]: value }))} />)}
                    <label className="block text-xs text-champagne/65">Preferred reply<select name="contactPreference" className={`${inputClass} mt-1.5`}><option value="wewed">Wewed message</option><option value="email">Email</option><option value="phone">Phone</option></select></label>
                    <label className="block text-xs text-champagne/65">Message<textarea name="message" className={`${textareaClass} mt-1.5`} /></label>
                    <fieldset className="rounded-xl border border-gold/20 p-3"><legend className="px-2 text-[10px] uppercase tracking-[0.12em] text-gold">Details you authorise</legend>{[['shareWeddingTitle', 'Wedding title'], ['shareWeddingDate', 'Wedding date'], ['shareLocation', 'Location'], ['shareGuestCount', 'Guest count'], ['shareBudget', 'Budget band']].map(([name, label]) => <label key={name} className="mt-2 flex items-center gap-2 text-xs text-champagne/65"><input name={name} type="checkbox" className="accent-[#BF9B5F]" />{label}</label>)}</fieldset>
                    {(error || notice) && <p role={error ? 'alert' : 'status'} className={`rounded-xl border p-3 text-xs ${error ? 'border-clay/40 bg-clay/10' : 'border-sage/40 bg-sage/10'}`}>{error || notice}</p>}
                    <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-espresso disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Send enquiry</button>
                  </form>
                  <p className="mt-3 text-xs text-champagne/45">A signed-in couple-owner account is required. <Link href="/sign-in" className="font-semibold text-gold">Sign in</Link></p>
                </section>

                <section className="rounded-3xl border border-gold/20 bg-white p-6"><h2 className="font-serif text-2xl">Contact and location</h2><div className="mt-4 space-y-3 text-sm">{provider.serviceAreas.length > 0 && <p className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-gold-muted" />{provider.serviceAreas.join(', ')}</p>}{provider.website && <a href={provider.website} target="_blank" rel="noreferrer" className="flex gap-2 text-gold-muted"><Globe2 className="mt-0.5 size-4 shrink-0" />Visit website</a>}{provider.phone && <a href={`tel:${provider.phone}`} className="flex gap-2 text-gold-muted"><Phone className="mt-0.5 size-4 shrink-0" />{provider.phone}</a>}{provider.publicEmail && <a href={`mailto:${provider.publicEmail}`} className="flex gap-2 break-all text-gold-muted"><Mail className="mt-0.5 size-4 shrink-0" />{provider.publicEmail}</a>}</div></section>
                {provider.lastProfileUpdate && <p className="text-center text-xs text-espresso/45">Information updated {new Date(provider.lastProfileUpdate).toLocaleDateString()}</p>}
              </aside>
            </div>
          </main>
        </>
      )}
    </PublicPlatformShell>
  )
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-xl border border-gold/15 bg-champagne/50 p-4"><p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-gold-muted">{icon}{label}</p><p className="mt-2 text-sm font-semibold">{value}</p></div>
}

function Policy({ title, value }: { title: string; value: string }) {
  return <div><h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-gold-muted">{title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-espresso/62">{value}</p></div>
}

function EnquiryField({ field, value, onChange }: { field: ProviderFieldDefinition; value: unknown; onChange: (value: unknown) => void }) {
  if (field.type === 'checkboxes' || field.type === 'multiselect') {
    const selected = valueList(value)
    return <fieldset className="rounded-xl border border-gold/20 p-3"><legend className="px-2 text-[10px] uppercase tracking-[0.12em] text-gold">{field.label}</legend>{(field.options ?? []).map((option) => <label key={option} className="mt-2 flex items-center gap-2 text-xs text-champagne/65"><input type="checkbox" checked={selected.includes(option)} onChange={() => onChange(selected.includes(option) ? selected.filter((entry) => entry !== option) : [...selected, option])} className="accent-[#BF9B5F]" />{option}</label>)}</fieldset>
  }
  if (field.type === 'select') return <label className="block text-xs text-champagne/65">{field.label}<select value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} className={`${inputClass} mt-1.5`}><option value="">Select…</option>{(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
  if (field.type === 'textarea') return <label className="block text-xs text-champagne/65">{field.label}<textarea value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} className={`${textareaClass} mt-1.5`} /></label>
  if (field.type === 'number') return <label className="block text-xs text-champagne/65">{field.label}<input type="number" min={field.min} max={field.max} value={value == null ? '' : String(value)} onChange={(event) => onChange(event.target.value)} className={`${inputClass} mt-1.5`} /></label>
  return <label className="block text-xs text-champagne/65">{field.label}<input value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value)} className={`${inputClass} mt-1.5`} /></label>
}
