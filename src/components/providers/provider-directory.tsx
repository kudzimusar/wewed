'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, ArrowRight, BadgeCheck, BriefcaseBusiness, Clock3, Loader2, MapPin, Search, Users } from 'lucide-react'
import { PublicPlatformShell } from '@/components/public/public-platform-shell'
import { PROVIDER_CATEGORIES, providerCategoryLabel } from '@/lib/provider-catalog'

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
  listingStatus: string
  isClaimable: boolean
  acceptingEnquiries: boolean
  sourceSummary: string | null
  lastSourceCheckAt: string | null
  claimNotice: string | null
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

type ServiceArea = {
  name: string
  province: string
  district: string | null
  placeType: string
}

type DirectoryPayload = {
  providers?: ProviderProfile[]
  error?: string
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

function price(cents: number | null, currency: string): string | null {
  if (cents == null) return null
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100)
}

function isProvisional(provider: ProviderProfile): boolean {
  return provider.listingStatus === 'unclaimed' || provider.listingStatus === 'claim_pending'
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export function ProviderDirectory() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const category = searchParams.get('category') || ''
  const query = searchParams.get('q') || ''
  const area = searchParams.get('area') || ''
  const [providers, setProviders] = useState<ProviderProfile[]>([])
  const [areas, setAreas] = useState<ServiceArea[]>([])
  const [broaderAreas, setBroaderAreas] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const requestControllers = useRef<Set<AbortController>>(new Set())

  useEffect(() => {
    let cancelled = false
    void fetch('/api/providers/areas', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as { areas?: ServiceArea[]; broaderAreas?: string[] }
        if (!cancelled) {
          setAreas(payload.areas ?? [])
          setBroaderAreas(payload.broaderAreas ?? [])
        }
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  const abortActiveRequests = useCallback(() => {
    for (const controller of requestControllers.current) controller.abort()
    requestControllers.current.clear()
  }, [])

  const fetchPage = useCallback(async (nextPage: number, append: boolean) => {
    const controller = new AbortController()
    requestControllers.current.add(controller)
    const parameters = new URLSearchParams()
    if (category) parameters.set('category', category)
    if (query) parameters.set('q', query)
    if (area) parameters.set('area', area)
    parameters.set('page', String(nextPage))
    parameters.set('pageSize', '24')

    try {
      const response = await fetch(`/api/providers?${parameters.toString()}`, { cache: 'no-store', signal: controller.signal })
      const payload = await response.json() as DirectoryPayload
      if (!response.ok) throw new Error(payload.error || 'Unable to load providers.')
      if (controller.signal.aborted) return
      const nextProviders = payload.providers ?? []
      setProviders((current) => append ? [...current, ...nextProviders] : nextProviders)
      setPage(nextPage)
      setTotal(payload.pagination?.total ?? nextProviders.length)
      setHasMore(payload.pagination?.hasMore ?? false)
    } finally {
      requestControllers.current.delete(controller)
    }
  }, [category, query, area])

  useEffect(() => {
    let cancelled = false
    abortActiveRequests()
    setLoading(true)
    setError(null)
    setProviders([])
    void fetchPage(1, false)
      .catch((caught) => {
        if (!cancelled && !isAbortError(caught)) {
          setError(caught instanceof Error ? caught.message : 'Unable to load providers.')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => {
      cancelled = true
      abortActiveRequests()
    }
  }, [fetchPage, abortActiveRequests])

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

  async function loadMore() {
    setLoadingMore(true)
    setError(null)
    try {
      await fetchPage(page + 1, true)
    } catch (caught) {
      if (!isAbortError(caught)) {
        setError(caught instanceof Error ? caught.message : 'Unable to load more providers.')
      }
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <PublicPlatformShell>
      <section className="relative isolate overflow-hidden bg-espresso px-4 py-16 text-champagne sm:px-6 sm:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(191,155,95,0.24),transparent_35%)]" />
        <div className="relative mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Wedding vendors & venues</p>
          <h1 className="mt-4 max-w-4xl font-serif text-5xl leading-tight sm:text-7xl">Find the people and places that bring your celebration to life.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-champagne/72">Explore owner-managed profiles and clearly labelled provisional business listings gathered from public sources. Private wedding-scoped vendor records never appear here.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <form onSubmit={search} className="grid gap-4 rounded-3xl border border-gold/20 bg-white p-5 shadow-sm md:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="text-xs font-semibold text-espresso/70">Service category<select name="category" defaultValue={category} className="mt-1.5 h-11 w-full rounded-xl border border-gold/25 bg-ivory px-3 text-sm"><option value="">All services</option>{PROVIDER_CATEGORIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label className="text-xs font-semibold text-espresso/70">Search business or service<span className="relative mt-1.5 block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gold-muted" /><input name="q" defaultValue={query} placeholder="Cake, venue, photographer…" className="h-11 w-full rounded-xl border border-gold/25 bg-ivory pl-10 pr-3 text-sm" /></span></label>
          <label className="text-xs font-semibold text-espresso/70">Service area<select name="area" defaultValue={area} className="mt-1.5 h-11 w-full rounded-xl border border-gold/25 bg-ivory px-3 text-sm"><option value="">All areas</option>{broaderAreas.map((option) => <option key={option} value={option}>{option}</option>)}{areas.map((option) => <option key={`${option.province}-${option.name}`} value={option.name}>{option.name} · {option.province}</option>)}</select></label>
          <button type="submit" className="self-end rounded-xl bg-espresso px-5 py-3 text-sm font-semibold text-champagne">Search</button>
        </form>

        <div className="mt-5 flex flex-wrap justify-end gap-3"><Link href={`/register?accountType=${registrationType}${category ? `&service=${encodeURIComponent(category)}` : ''}`} className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-espresso">List your business</Link><Link href="/vendors/manage" className="rounded-full border border-gold/30 px-5 py-2.5 text-sm font-semibold text-gold-muted">Manage profile</Link></div>

        <div className="mt-9 flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-muted">Current directory</p><h2 className="mt-2 font-serif text-4xl">{categoryLabel}</h2></div><span className="text-sm text-espresso/55">{loading ? 'Loading…' : `${total} result${total === 1 ? '' : 's'}`}</span></div>

        {loading && <div className="flex min-h-56 items-center justify-center"><Loader2 className="size-7 animate-spin text-gold-muted" /></div>}
        {error && <div role="alert" className="mt-8 rounded-3xl border border-clay/30 bg-clay/10 p-8 text-center"><p className="font-semibold">Provider directory unavailable</p><p className="mt-2 text-sm text-espresso/60">{error}</p></div>}
        {!loading && !error && providers.length === 0 && (
          <div role="status" className="mt-8 rounded-3xl border border-gold/20 bg-champagne/60 p-10 text-center">
            <BriefcaseBusiness className="mx-auto size-8 text-gold-muted" />
            <h3 className="mt-4 font-serif text-3xl">No published {category ? categoryLabel.toLowerCase() : 'provider profiles'} yet.</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-espresso/60">Wewed publishes only real businesses supported by source evidence. Owner-managed profiles and provisional listings are labelled separately; missing details are never invented.</p>
            <Link href={`/register?accountType=${registrationType}${category ? `&service=${encodeURIComponent(category)}` : ''}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-espresso px-5 py-3 text-sm font-semibold text-champagne">Register a company <ArrowRight className="size-4" /></Link>
          </div>
        )}

        {!loading && providers.length > 0 && (
          <>
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="provider-directory-results">
              {providers.map((provider) => {
                const provisional = isProvisional(provider)
                const startingPrice = price(provider.offering.startingPriceCents, provider.offering.currency)
                return (
                  <article key={`${provider.id}-${provider.offering.id}`} className="overflow-hidden rounded-3xl border border-gold/20 bg-white shadow-sm">
                    <div className="relative h-52 bg-espresso">{provider.coverImageUrl ? <img src={provider.coverImageUrl} alt="" className="size-full object-cover opacity-90" /> : <div className="size-full bg-[radial-gradient(circle_at_75%_20%,rgba(191,155,95,0.45),transparent_35%),linear-gradient(135deg,#1a1410,#5b3428)]" />}<span className="absolute left-4 top-4 rounded-full bg-espresso/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold backdrop-blur">{providerCategoryLabel(provider.offering.category)}</span>{provisional ? <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-amber-50/95 px-3 py-1 text-[10px] font-semibold text-amber-800"><AlertTriangle className="size-3" />{provider.listingStatus === 'claim_pending' ? 'Claim pending' : 'Unclaimed'}</span> : provider.verificationBadges.length > 0 && <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold text-sage"><BadgeCheck className="size-3" />Verified</span>}</div>
                    <div className="p-6"><h3 className="font-serif text-3xl">{provider.displayName}</h3><p className="mt-1 text-xs font-semibold text-gold-muted">{provider.offering.displayName}</p>{provider.headline && <p className="mt-3 text-sm font-semibold text-espresso/75">{provider.headline}</p>}{provider.offering.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-espresso/58">{provider.offering.description}</p>}
                      <div className="mt-4 space-y-2 text-xs text-espresso/58">{(provider.city || provider.country || provider.serviceAreas.length > 0) && <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-gold-muted" />{[provider.city, provider.country].filter(Boolean).join(', ') || provider.serviceAreas.join(', ')}</p>}{provider.responseTime && !provisional && <p className="flex items-start gap-2"><Clock3 className="mt-0.5 size-3.5 shrink-0 text-gold-muted" />Responds {provider.responseTime.toLowerCase()}</p>}{(provider.offering.minimumCapacity != null || provider.offering.maximumCapacity != null) && <p className="flex items-start gap-2"><Users className="mt-0.5 size-3.5 shrink-0 text-gold-muted" />Capacity {provider.offering.minimumCapacity ?? 'any'}–{provider.offering.maximumCapacity ?? 'any'}</p>}</div>
                      {provisional && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Public business information; not yet owner-verified.</p>}
                      <div className="mt-5 flex items-end justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.12em] text-espresso/45">{startingPrice ? 'Starting from' : 'Pricing'}</p><p className="font-semibold">{startingPrice || 'Contact for quotation'}</p></div><Link href={`/vendors/${provider.slug}`} className="inline-flex items-center gap-2 rounded-full bg-espresso px-4 py-2 text-xs font-semibold text-champagne">View profile <ArrowRight className="size-3.5" /></Link></div>
                      {provisional && provider.isClaimable && <Link href={`/vendors/${provider.slug}#claim-business`} className="mt-3 flex w-full items-center justify-center rounded-full border border-gold/35 px-4 py-2.5 text-xs font-semibold text-gold-muted">Claim this business</Link>}
                    </div>
                  </article>
                )
              })}
            </div>
            {hasMore && <div className="mt-8 flex justify-center"><button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-white px-6 py-3 text-sm font-semibold text-gold-muted disabled:opacity-60">{loadingMore && <Loader2 className="size-4 animate-spin" />}Load more businesses</button></div>}
          </>
        )}
      </section>
    </PublicPlatformShell>
  )
}
