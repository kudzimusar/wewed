'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, BriefcaseBusiness, Building2, Loader2, MapPin, Search } from 'lucide-react'
import { PublicPlatformShell } from '@/components/public/public-platform-shell'

const CATEGORIES = [
  { value: '', label: 'All services' },
  { value: 'venue', label: 'Venues' },
  { value: 'photography', label: 'Photographers' },
  { value: 'florals', label: 'Florists' },
  { value: 'catering', label: 'Caterers' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'decor-rentals', label: 'Décor & rentals' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'transport', label: 'Transport' },
  { value: 'stationery', label: 'Stationery' },
  { value: 'other', label: 'Other services' },
] as const

type ProviderProfile = {
  id: string
  slug: string
  accountType: string
  displayName: string
  headline: string | null
  description: string | null
  category: string
  serviceAreas: string[]
  services: string[]
  website: string | null
  phone: string | null
  imageUrl: string | null
}

export function ProviderDirectory() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const category = searchParams.get('category') || ''
  const [providers, setProviders] = useState<ProviderProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const query = category ? `?category=${encodeURIComponent(category)}` : ''
    void fetch(`/api/providers${query}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as { providers?: ProviderProfile[]; error?: string }
        if (!response.ok) throw new Error(payload.error || 'Unable to load providers.')
        if (!cancelled) setProviders(payload.providers ?? [])
      })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load providers.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [category])

  const categoryLabel = CATEGORIES.find((option) => option.value === category)?.label ?? 'Wedding services'
  const registrationType = category === 'venue' ? 'venue' : 'vendor'

  return (
    <PublicPlatformShell>
      <section className="relative isolate overflow-hidden bg-espresso px-4 py-16 text-champagne sm:px-6 sm:py-20">
        <img src="/media/wewed-couple-reception.svg" alt="" className="absolute inset-0 size-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(26,20,16,0.98),rgba(26,20,16,0.82),rgba(26,20,16,0.62))]" />
        <div className="relative mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Wedding vendors & venues</p>
          <h1 className="mt-4 max-w-4xl font-serif text-5xl leading-tight sm:text-7xl">Find the people and places that bring your celebration to life.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-champagne/72">Browse public profiles from approved and completely onboarded Wewed businesses. Private vendors attached to individual weddings never appear here.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-5 rounded-3xl border border-gold/20 bg-white p-5 shadow-sm">
          <label className="min-w-64 flex-1 text-xs font-semibold text-espresso/70">
            Service category
            <span className="relative mt-1.5 block"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gold-muted" /><select value={category} onChange={(event) => router.push(event.target.value ? `/vendors?category=${encodeURIComponent(event.target.value)}` : '/vendors')} className="h-11 w-full rounded-xl border border-gold/25 bg-ivory pl-10 pr-3 text-sm">{CATEGORIES.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}</select></span>
          </label>
          <div className="flex flex-wrap gap-3"><Link href={`/register?accountType=${registrationType}${category ? `&service=${encodeURIComponent(category)}` : ''}`} className="rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-espresso">List your business</Link><Link href="/vendors/manage" className="rounded-full border border-gold/30 px-5 py-2.5 text-sm font-semibold text-gold-muted">Manage profile</Link></div>
        </div>

        <div className="mt-9 flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-muted">Current directory</p><h2 className="mt-2 font-serif text-4xl">{categoryLabel}</h2></div><span className="text-sm text-espresso/55">{loading ? 'Loading…' : `${providers.length} profile${providers.length === 1 ? '' : 's'}`}</span></div>

        {loading && <div className="flex min-h-56 items-center justify-center"><Loader2 className="size-7 animate-spin text-gold-muted" /></div>}
        {error && <div role="alert" className="mt-8 rounded-3xl border border-clay/30 bg-clay/10 p-8 text-center"><p className="font-semibold">Provider directory unavailable</p><p className="mt-2 text-sm text-espresso/60">{error}</p></div>}
        {!loading && !error && providers.length === 0 && (
          <div role="status" className="mt-8 rounded-3xl border border-gold/20 bg-champagne/60 p-10 text-center">
            <BriefcaseBusiness className="mx-auto size-8 text-gold-muted" />
            <h3 className="mt-4 font-serif text-3xl">No published {category ? categoryLabel.toLowerCase() : 'provider profiles'} yet.</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-espresso/60">Wewed only shows approved companies that have chosen to publish their profile. No test business or wedding-scoped vendor is substituted.</p>
            <Link href={`/register?accountType=${registrationType}${category ? `&service=${encodeURIComponent(category)}` : ''}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-espresso px-5 py-3 text-sm font-semibold text-champagne">Register a company <ArrowRight className="size-4" /></Link>
          </div>
        )}

        {!loading && !error && providers.length > 0 && (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="provider-directory-results">
            {providers.map((provider) => (
              <article key={provider.id} className="overflow-hidden rounded-3xl border border-gold/20 bg-white shadow-sm">
                <div className="relative h-48 bg-espresso"><img src={provider.imageUrl || '/media/wewed-couple-reception.svg'} alt="" className="size-full object-cover opacity-90" /><span className="absolute left-4 top-4 rounded-full bg-espresso/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold backdrop-blur">{CATEGORIES.find((option) => option.value === provider.category)?.label || provider.category}</span></div>
                <div className="p-6"><h3 className="font-serif text-3xl">{provider.displayName}</h3>{provider.headline && <p className="mt-2 text-sm font-semibold text-espresso/75">{provider.headline}</p>}{provider.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-espresso/58">{provider.description}</p>}{provider.serviceAreas.length > 0 && <p className="mt-4 flex items-start gap-2 text-xs text-espresso/58"><MapPin className="mt-0.5 size-3.5 shrink-0 text-gold-muted" />{provider.serviceAreas.join(', ')}</p>}<div className="mt-4 flex flex-wrap gap-1.5">{provider.services.slice(0, 4).map((service) => <span key={service} className="rounded-full bg-champagne px-2.5 py-1 text-[10px]">{service}</span>)}</div><div className="mt-6 flex flex-wrap gap-2">{provider.website && <a href={provider.website} target="_blank" rel="noreferrer" className="rounded-full bg-espresso px-4 py-2 text-xs font-semibold text-champagne">Visit website</a>}{provider.phone && <a href={`tel:${provider.phone}`} className="rounded-full border border-gold/30 px-4 py-2 text-xs font-semibold text-gold-muted">Call provider</a>}</div></div>
              </article>
            ))}
          </div>
        )}
      </section>
    </PublicPlatformShell>
  )
}
