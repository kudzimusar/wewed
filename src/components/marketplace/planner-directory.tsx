'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck, MapPin, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MarketplaceFrame, StatusPill } from '@/components/marketplace/marketplace-frame'
import { marketplaceFetch, type PublicPlannerProfile } from '@/components/marketplace/marketplace-types'

type PlannerFacets = {
  serviceAreas: string[]
  services: string[]
  weddingStyles: string[]
}

const EMPTY_FACETS: PlannerFacets = { serviceAreas: [], services: [], weddingStyles: [] }

export function PlannerDirectory() {
  const [planners, setPlanners] = useState<PublicPlannerProfile[]>([])
  const [facets, setFacets] = useState<PlannerFacets>(EMPTY_FACETS)
  const [search, setSearch] = useState('')
  const [area, setArea] = useState('')
  const [service, setService] = useState('')
  const [style, setStyle] = useState('')
  const [priceBand, setPriceBand] = useState('')
  const [availability, setAvailability] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({ search, area, service, style, priceBand, availability })
      const payload = await marketplaceFetch<{ planners: PublicPlannerProfile[]; facets: PlannerFacets }>(`/api/marketplace/planners?${query}`)
      setPlanners(payload.planners)
      setFacets(payload.facets ?? EMPTY_FACETS)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load planners.')
    } finally {
      setLoading(false)
    }
  }, [search, area, service, style, priceBand, availability])

  useEffect(() => { void load() }, [load])

  function clearFilters() {
    setSearch('')
    setArea('')
    setService('')
    setStyle('')
    setPriceBand('')
    setAvailability('')
  }

  return (
    <MarketplaceFrame
      title="Find a wedding planner"
      description="Explore verified, published planner profiles. A profile view or enquiry never grants access to your wedding; authority begins only after the planner accepts and you explicitly authorize them."
      actions={<Link href="/couple/planners" className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-gold hover:text-gold-light sm:block">Couple centre</Link>}
    >
      <form onSubmit={(event) => { event.preventDefault(); void load() }} className="mb-8 grid gap-3 rounded-2xl border border-gold/20 bg-champagne p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <label className="relative">
          <span className="sr-only">Search planners</span>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gold-muted" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or speciality" className="bg-white pl-10" />
        </label>
        <label className="relative">
          <span className="sr-only">Service area</span>
          <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gold-muted" />
          <Input value={area} onChange={(event) => setArea(event.target.value)} placeholder="City or service area" className="bg-white pl-10" list="planner-service-areas" />
          <datalist id="planner-service-areas">{facets.serviceAreas.map((value) => <option key={value} value={value} />)}</datalist>
        </label>
        <select aria-label="Filter planners by service" value={service} onChange={(event) => setService(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">
          <option value="">Any service</option>
          {facets.services.map((value) => <option key={value} value={value.toLowerCase()}>{value}</option>)}
        </select>
        <select aria-label="Filter planners by wedding style" value={style} onChange={(event) => setStyle(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">
          <option value="">Any wedding style</option>
          {facets.weddingStyles.map((value) => <option key={value} value={value.toLowerCase()}>{value}</option>)}
        </select>
        <select aria-label="Filter planners by price band" value={priceBand} onChange={(event) => setPriceBand(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">
          <option value="">Any price band</option>
          <option value="contact">Contact for pricing</option>
          <option value="budget">Budget</option>
          <option value="standard">Standard</option>
          <option value="premium">Premium</option>
          <option value="luxury">Luxury</option>
        </select>
        <select aria-label="Filter planners by availability" value={availability} onChange={(event) => setAvailability(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">
          <option value="">Any availability</option>
          <option value="accepting">Accepting enquiries</option>
          <option value="limited">Limited availability</option>
          <option value="unavailable">Unavailable</option>
        </select>
        <Button type="submit" className="bg-espresso text-champagne hover:bg-espresso/90">Search</Button>
        <Button type="button" variant="outline" onClick={clearFilters}>Clear filters</Button>
      </form>

      {error && <p role="alert" className="mb-6 rounded-lg border border-clay/30 bg-clay/10 p-3 text-sm">{error}</p>}
      {loading ? (
        <p className="py-20 text-center text-sm text-espresso/55">Loading planner profiles…</p>
      ) : planners.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/35 p-12 text-center">
          <h2 className="wewed-heading text-2xl">No published planner matches yet</h2>
          <p className="mt-2 text-sm text-espresso/60">Clear one or more filters to broaden the search.</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="planner-directory-results">
          {planners.map((planner) => (
            <Card key={planner.id} className="border-gold/20 bg-champagne shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <CardContent className="flex h-full flex-col p-6">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="wewed-heading text-2xl">{planner.displayName}</h2>
                    <p className="mt-1 text-sm text-espresso/65">{planner.headline || 'Wedding planning professional'}</p>
                  </div>
                  <StatusPill value={planner.availabilityStatus} />
                </div>
                <p className="line-clamp-3 text-sm leading-6 text-espresso/65">{planner.bio || 'Profile details are available on the planner page.'}</p>
                <div className="mt-5 space-y-2 text-xs text-espresso/70">
                  <p className="flex items-center gap-2"><MapPin className="size-4 text-gold-muted" />{planner.serviceAreas.join(', ') || 'Service area by consultation'}</p>
                  <p className="flex items-center gap-2"><CalendarCheck className="size-4 text-gold-muted" />{planner.yearsExperience == null ? 'Experience details available' : `${planner.yearsExperience} years experience`}</p>
                  <p className="flex items-center gap-2"><Users className="size-4 text-gold-muted" />{planner.minimumGuestCount ?? 0}–{planner.maximumGuestCount ?? 'any'} guests</p>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {planner.services.slice(0, 4).map((plannerService) => <span key={plannerService} className="rounded-full bg-white/70 px-2.5 py-1 text-[11px]">{plannerService}</span>)}
                </div>
                <Button asChild className="mt-6 w-full bg-espresso text-champagne hover:bg-espresso/90">
                  <Link href={`/planners/${planner.slug}`}>View planner profile</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </MarketplaceFrame>
  )
}
