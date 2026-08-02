'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BriefcaseBusiness, Languages, MapPin, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MarketplaceFrame, StatusPill } from '@/components/marketplace/marketplace-frame'
import { marketplaceFetch, type PublicPlannerProfile } from '@/components/marketplace/marketplace-types'

export function PublicPlannerProfile({ slug }: { slug: string }) {
  const [planner, setPlanner] = useState<PublicPlannerProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void marketplaceFetch<{ planner: PublicPlannerProfile }>(`/api/marketplace/planners/${encodeURIComponent(slug)}`)
      .then((payload) => setPlanner(payload.planner))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Planner profile unavailable.'))
  }, [slug])

  return (
    <MarketplaceFrame title={planner?.displayName || 'Planner profile'} description="Published professional information only. Client lists, private schedules, enquiries, business records, and wedding data are never shown on this page." backHref="/planners">
      {error ? <p role="alert" className="rounded-lg border border-clay/30 bg-clay/10 p-4">{error}</p> : !planner ? <p className="py-20 text-center">Loading planner profile…</p> : (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_0.8fr]">
          <Card className="border-gold/20 bg-champagne"><CardContent className="p-7 sm:p-9">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs uppercase tracking-[0.16em] text-gold-muted">Professional planner</p><h2 className="wewed-heading mt-2 text-4xl">{planner.displayName}</h2><p className="mt-2 text-lg text-espresso/65">{planner.headline}</p></div>
              <StatusPill value={planner.availabilityStatus} />
            </div>
            <p className="mt-8 whitespace-pre-wrap text-sm leading-7 text-espresso/70">{planner.bio}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Info icon={<MapPin className="size-4" />} label="Service areas" value={planner.serviceAreas.join(', ') || 'By consultation'} />
              <Info icon={<BriefcaseBusiness className="size-4" />} label="Experience" value={planner.yearsExperience == null ? 'Not listed' : `${planner.yearsExperience} years`} />
              <Info icon={<Users className="size-4" />} label="Wedding size" value={`${planner.minimumGuestCount ?? 0}–${planner.maximumGuestCount ?? 'any'} guests`} />
              <Info icon={<Languages className="size-4" />} label="Languages" value={planner.languages.join(', ') || 'Not listed'} />
            </div>
            <TagSection title="Services" values={planner.services} /><TagSection title="Wedding styles" values={planner.weddingStyles} />
          </CardContent></Card>
          <aside className="space-y-5">
            <Card className="border-gold/25 bg-espresso text-champagne"><CardContent className="p-6">
              <h3 className="wewed-heading text-2xl">Start a secure enquiry</h3>
              <p className="mt-3 text-sm leading-6 text-champagne/65">Sign in as the couple who owns the wedding. You will choose what details to share, and no planner access is created by sending an enquiry.</p>
              <Button asChild className="mt-5 w-full bg-gold text-espresso hover:bg-gold-light"><Link href={`/couple/planners?planner=${encodeURIComponent(planner.id)}`}>Open couple planner centre</Link></Button>
            </CardContent></Card>
            {planner.portfolio.length > 0 && <Card className="border-gold/20 bg-champagne"><CardContent className="p-6"><h3 className="font-semibold">Portfolio links</h3><ul className="mt-3 space-y-2 text-sm">{planner.portfolio.map((url) => <li key={url}><a className="break-all text-gold-muted underline" href={url} target="_blank" rel="noreferrer">{url}</a></li>)}</ul></CardContent></Card>}
          </aside>
        </div>
      )}
    </MarketplaceFrame>
  )
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-xl border border-gold/15 bg-white/50 p-4"><p className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-gold-muted">{icon}{label}</p><p className="mt-2 text-sm">{value}</p></div> }
function TagSection({ title, values }: { title: string; values: string[] }) { return <section className="mt-7"><h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-muted">{title}</h3><div className="mt-3 flex flex-wrap gap-2">{values.map((value) => <span key={value} className="rounded-full border border-gold/20 bg-white/60 px-3 py-1.5 text-xs">{value}</span>)}</div></section> }
