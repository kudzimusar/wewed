'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Clock3, Loader2, MapPin, Search, Users } from 'lucide-react'
import { PublicPlatformShell } from '@/components/public/public-platform-shell'
import { PROVIDER_CATEGORIES, SERVICE_AREA_OPTIONS, providerCategoryLabel } from '@/lib/provider-catalog'

type ProviderProfile = {
  id: string
  slug: string
  accountType: string
  displayName: string
  headline: string | null
  description: string | null
  country: string | null
  city: string | null
  serviceAreas: string[]
  languages: string[]
  phone: string | null
  website: string | null
  coverImageUrl: string | null
  yearsOperating: number | null
  teamSize: number | null
  responseTime: string | null
  minimumBookingNotice: string | null
  verificationBadges: string[]
  offering: {
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
  }
}

function price(cents: number | null, currency: string): string | null {
  if (cents == null) return null
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100)
}

export function ProviderDirectory() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const category = searchParams.get('category') || ''
  const query = searchParams.get('q') || ''
  const area = searchParams.get('area') || ''
  const [providers, setProviders] = useState<ProviderProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const parameters = new URLSearchParams()
    if (category) parameters.set('category', category)
    if (query) parameters.set('q', query)
    if (area) parameters.set('area', area)
    void fetch(`/api/providers?${parameters.toString()}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as { providers?: ProviderProfile[]; error?: string }
        if (!response.ok) throw new Error(payload.error || 'Unable to load providers.')
        if (!cancelled) setProviders(payload.providers ?? [])
      })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load providers.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [category, query, area])

  const categoryLabel = useMemo(() => category ? providerCategoryLabel(category) : 'All wedding services', [category])
  const registrationType = category === 'venue' ? 'venue' : 'vendor'

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const next = new URLSearchParams()
    const nextCategory = String(form.get('category') || '')
    const nextQuery = String(form.get('q') || '').trim()
    const nextArea = String(form.get('area') || '')
    if (nextCategory) next.set('category', nextCategory)
    if (nextQuery) next.set('q', nextQuery)
    if (nextArea) next.set('area', nextArea)
    router.push(next.toString() ? `/vendors?${next.toString()}` : '/vendors')
  }

  return (
    <PublicPlatformShell>
      <section className="relative isolate overflow-hidden bg-espresso px-4 py-16 text-champagne sm:px-6 sm:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(191,155,95,0.24),transparent_35%)]" />
        <div className="relative mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Wedding vendors & venues</p>
          <h1 className="mt-4 max-w-4xl font-serif text-5xl leading-tight sm:text-7xl">Find the people and places that bring your celebration to life.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-champagne/72">Compare approved public company profiles, category-specific services, pricing context, capacity and booking information. Private wedding vendor records never appear here.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <form onSubmit={search} className="grid gap-4 rounded-3xl border border-gold/20 bg-white p-5 shadow-sm md:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="text-xs font-semibold text-espresso/70">Service category<select name="category" defaultValue={category} className="mt-1.5 h-11 w-full rounded-xl border border-gold/25 bg-ivory px-3 text-sm"><option value="">All services</option>{PROVIDER_CATEGORIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="text-xs font-semibold text-espresso/70">Search business or service<span className="relative mt-1.5 block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gold-muted" /><input name="q" defaultValue={query} placeholder="Cake, venue, photographer…" className="h-11 w-full rounded-xl border border-gold/25 bg-ivory pl-10 pr-3 text-sm" /></span></label>
          <label className="text-xs font-semibold text-espresso/70">Service area<select name="area" defaultValue={area} className="mt-1.5 h-11 w-full rounded-xl border border-gold/25 bg-ivory px-3 text-sm"><option value="">All areas</option>{SERVICE_AREA_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <button type="submit" className="self-end rounded-xl bg-espresso px-5 py-3 text-sm font-semibold text-champagne">Search</button>
        </form>

        <div className="mt-5 flex flex-wrap justify-end gap-3"><Link href={`/register?accountType=${registrationType}${category ? `&service=${encodeURIComponent(category)}` : ''}`} className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-espresso">List your business</Link><Link href="/vendors/manage" className="rounded-full border border-gold/30 px-5 py-2.5 text-sm font-semibold text-gold-muted">Manage profile</Link></div>

        <div className="mt-9 flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-muted">Current directory</p><h2 className="mt-2 font-serif text-4xl">{categoryLabel}</h2></div><span className="text-sm text-espresso/55">{loading ? 'Loading…' : `${providers.length} result${providers.length === 1 ? '' : 's'}`}</span></div>

        {loading && <div className="flex min-h-56 items-center justify-center"><Loader2 className="size-7 animate-spin text-gold-muted" /></div>}
        {error && <div role="alert" className="mt-8 rounded-3xl border border-clay/30 bg-clay/10 p-8 text-center"><p className="font-semibold">Provider directory unavailable</p><p className="mt-2 text-sm text-espresso/60">{error}</p></div>}
        {!loading && !error && providers.length === 0 && (
          <div role="status" className="mt-8 rounded-3xl border border-gold/20 bg-champagne/60 p-10 text-center">
            <BriefcaseBusiness className="mx-auto size-8 text-gold-muted" />
            <h3 className="mt-4 font-serif text-3xl">No published {category ? categoryLabel.toLowerCase() : 'provider profiles'} yet.</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-espresso/60">Wewed shows only approved companies with a published company profile and a published category-specific service. No fabricated business or wedding-scoped vendor is substituted.</p>
            <Link href={`/register?accountType=${registrationType}${category ? `&service=${encodeURIComponent(category)}` : ''}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-espresso px-5 py-3 text-sm font-semibold text-champagne">Register a company <ArrowRight className="size-4" /></Link>
          </div>
        )}

        {!loading && !error && providers.length > 0 && (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="provider-directory-results">
            {providers.map((provider) => (
              <article key={`${provider.id}-${provider.offering.id}`} className="overflow-hidden rounded-3xl border border-gold/20 bg-white shadow-sm">
                <div className="relative h-52 bg-espresso">{provider.coverImageUrl ? <img src={provider.coverImageUrl} alt="" className="size-full object-cover opacity-90" /> : <div className="size-full bg-[radial-gradient(circle_at_75%_20%,rgba(191,155,95,0.45),transparent_35%),linear-gradient(135deg,#1a1410,#5b3428)]" />}<span className="absolute left-4 top-4 rounded-full bg-espresso/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold backdrop-blur">{providerCategoryLabel(provider.offering.category)}</span>{provider.verificationBadges.length > 0 && <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold text-sage"><BadgeCheck className="size-3" />Verified</span>}</div>
                <div className="p-6"><h3 className="font-serif text-3xl">{provider.displayName}</h3><p className="mt-1 text-xs font-semibold text-gold-muted">{provider.offering.displayName}</p>{provider.headline && <p className="mt-3 text-sm font-semibold text-espresso/75">{provider.headline}</p>}{provider.offering.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-espresso/58">{provider.offering.description}</p>}
                  <div className="mt-4 space-y-2 text-xs text-espresso/58">{(provider.city || provider.country || provider.serviceAreas.length > 0) && <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-gold-muted" />{[provider.city, provider.country].filter(Boolean).join(', ') || provider.serviceAreas.join(', ')}</p>}{provider.responseTime && <p className="flex items-start gap-2"><Clock3 className="mt-0.5 size-3.5 shrink-0 text-gold-muted" />Responds {provider.responseTime.toLowerCase()}</p>}{(provider.offering.minimumCapacity != null || provider.offering.maximumCapacity != null) && <p className="flex items-start gap-2"><Users className="mt-0.5 size-3.5 shrink-0 text-gold-muted" />Capacity {provider.offering.minimumCapacity ?? 'any'}–{provider.offering.maximumCapacity ?? 'any'}</p>}</div>
                  <div className="mt-5 flex items-end justify-between gap-3"><div>{provider.offering.startingPriceCents != null && <><p className="text-[10px] uppercase tracking-[0.12em] text-espresso/45">Starting from</p><p className="font-semibold">{price(provider.offering.startingPriceCents, provider.offering.currency)}</p></>}</div><Link href={`/vendors/${provider.slug}`} className="inline-flex items-center gap-2 rounded-full bg-espresso px-4 py-2 text-xs font-semibold text-champagne">View full profile <ArrowRight className="size-3.5" /></Link></div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </PublicPlatformShell>
  )
}
