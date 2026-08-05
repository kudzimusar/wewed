'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { BadgeCheck, BriefcaseBusiness, CalendarDays, Clock3, Languages, MapPin, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MarketplaceFrame, StatusPill } from '@/components/marketplace/marketplace-frame'
import { marketplaceFetch, type PublicPlannerProfile } from '@/components/marketplace/marketplace-types'

function value(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

export function PublicPlannerProfile({ slug }: { slug: string }) {
  const [planner, setPlanner] = useState<PublicPlannerProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void marketplaceFetch<{ planner: PublicPlannerProfile }>(`/api/marketplace/planners/${encodeURIComponent(slug)}`)
      .then((payload) => setPlanner(payload.planner))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Planner profile unavailable.'))
  }, [slug])

  const details = planner?.profileDetails ?? {}
  const responseTime = value(details.responseTime)
  const bookingNotice = value(details.bookingNotice)
  const feeModel = value(details.feeModel)
  const consultationProcess = value(details.consultationProcess)
  const teamStructure = value(details.teamStructure)
  const supportedBudgets = list(details.supportedBudgets)
  const accessibilitySupport = value(details.accessibilitySupport)
  const culturalExperience = value(details.culturalExperience)
  const depositPolicy = value(details.depositPolicy)
  const cancellationPolicy = value(details.cancellationPolicy)
  const travelPolicy = value(details.travelPolicy)

  return (
    <MarketplaceFrame title={planner?.displayName || 'Planner profile'} description="Published professional information only. Client lists, schedules, enquiries, business records and wedding data are never shown on this page." backHref="/planners">
      {error ? <p role="alert" className="rounded-lg border border-clay/30 bg-clay/10 p-4">{error}</p> : !planner ? <p className="py-20 text-center">Loading planner profile…</p> : (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_0.8fr]">
          <div className="space-y-6">
            <Card className="border-gold/20 bg-champagne"><CardContent className="p-7 sm:p-9">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><p className="text-xs uppercase tracking-[0.16em] text-gold-muted">Professional planner</p>{planner.verificationBadges.map((badge) => <span key={badge} className="inline-flex items-center gap-1 rounded-full border border-sage/25 bg-sage/10 px-2.5 py-1 text-[10px] font-semibold text-sage"><BadgeCheck className="size-3" />{badge}</span>)}</div>
                  <h2 className="wewed-heading mt-2 text-4xl">{planner.displayName}</h2>
                  {planner.headline && <p className="mt-2 text-lg text-espresso/65">{planner.headline}</p>}
                </div>
                <StatusPill value={planner.availabilityStatus} />
              </div>
              {planner.bio && <p className="mt-8 whitespace-pre-wrap text-sm leading-7 text-espresso/70">{planner.bio}</p>}

              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {planner.serviceAreas.length > 0 && <Info icon={<MapPin className="size-4" />} label="Service areas" value={planner.serviceAreas.join(', ')} />}
                {planner.yearsExperience != null && planner.yearsExperience > 0 && <Info icon={<BriefcaseBusiness className="size-4" />} label="Experience" value={`${planner.yearsExperience} year${planner.yearsExperience === 1 ? '' : 's'}`} />}
                {planner.completedWeddings != null && planner.completedWeddings > 0 && <Info icon={<CalendarDays className="size-4" />} label="Weddings completed" value={String(planner.completedWeddings)} />}
                {planner.teamSize != null && planner.teamSize > 0 && <Info icon={<Users className="size-4" />} label="Team size" value={String(planner.teamSize)} />}
                {(planner.minimumGuestCount != null || planner.maximumGuestCount != null) && <Info icon={<Users className="size-4" />} label="Wedding size" value={guestRange(planner.minimumGuestCount, planner.maximumGuestCount)} />}
                {planner.languages.length > 0 && <Info icon={<Languages className="size-4" />} label="Languages" value={planner.languages.join(', ')} />}
                {responseTime && <Info icon={<Clock3 className="size-4" />} label="Typical response" value={responseTime} />}
                {bookingNotice && <Info icon={<CalendarDays className="size-4" />} label="Booking notice" value={bookingNotice} />}
                {feeModel && <Info icon={<BriefcaseBusiness className="size-4" />} label="Fee model" value={feeModel} />}
              </div>
              <TagSection title="Services" values={planner.services} />
              <TagSection title="Wedding styles" values={planner.weddingStyles} />
              <TagSection title="Supported budgets" values={supportedBudgets} />
            </CardContent></Card>

            {(consultationProcess || teamStructure || accessibilitySupport || culturalExperience) && <Card className="border-gold/20 bg-white"><CardContent className="p-7"><h3 className="wewed-heading text-3xl">How this planner works</h3><div className="mt-5 space-y-5">{consultationProcess && <TextSection title="Consultation process" value={consultationProcess} />}{teamStructure && <TextSection title="Team structure" value={teamStructure} />}{accessibilitySupport && <TextSection title="Accessibility support" value={accessibilitySupport} />}{culturalExperience && <TextSection title="Cultural, traditional and religious wedding experience" value={culturalExperience} />}</div></CardContent></Card>}

            {planner.packages.length > 0 && <Card className="border-gold/20 bg-white"><CardContent className="p-7"><h3 className="wewed-heading text-3xl">Planning packages</h3><div className="mt-5 grid gap-4 md:grid-cols-2">{planner.packages.map((item, index) => <article key={`${item.name}-${index}`} className="rounded-2xl border border-gold/20 bg-champagne/50 p-5"><div className="flex items-start justify-between gap-3"><h4 className="font-serif text-2xl">{item.name}</h4>{item.startingPrice != null && <span className="font-semibold">{new Intl.NumberFormat('en', { style: 'currency', currency: item.currency, maximumFractionDigits: 0 }).format(item.startingPrice)}</span>}</div>{item.description && <p className="mt-3 text-sm leading-6 text-espresso/60">{item.description}</p>}{item.inclusions.length > 0 && <ul className="mt-4 space-y-2 text-xs">{item.inclusions.map((inclusion) => <li key={inclusion}>• {inclusion}</li>)}</ul>}</article>)}</div></CardContent></Card>}

            {(depositPolicy || cancellationPolicy || travelPolicy) && <Card className="border-gold/20 bg-white"><CardContent className="p-7"><h3 className="wewed-heading text-3xl">Booking policies</h3><div className="mt-5 space-y-5">{depositPolicy && <TextSection title="Deposit" value={depositPolicy} />}{cancellationPolicy && <TextSection title="Cancellation" value={cancellationPolicy} />}{travelPolicy && <TextSection title="Travel" value={travelPolicy} />}</div></CardContent></Card>}

            {planner.faq.length > 0 && <Card className="border-gold/20 bg-white"><CardContent className="p-7"><h3 className="wewed-heading text-3xl">Frequently asked questions</h3><div className="mt-5 space-y-3">{planner.faq.map((item, index) => <details key={`${item.question}-${index}`} className="rounded-xl border border-gold/15 bg-champagne/40 p-4"><summary className="cursor-pointer font-semibold">{item.question}</summary><p className="mt-3 text-sm leading-6 text-espresso/60">{item.answer}</p></details>)}</div></CardContent></Card>}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <Card className="border-gold/25 bg-espresso text-champagne"><CardContent className="p-6">
              <h3 className="wewed-heading text-2xl">Start a secure enquiry</h3>
              <p className="mt-3 text-sm leading-6 text-champagne/65">Sign in as the couple who owns the wedding. You choose what to share, and sending an enquiry never creates planner access.</p>
              <Button asChild className="mt-5 w-full bg-gold text-espresso hover:bg-gold-light"><Link href={`/couple/planners?planner=${encodeURIComponent(planner.id)}`}>Open couple planner centre</Link></Button>
            </CardContent></Card>
            {planner.portfolio.length > 0 && <Card className="border-gold/20 bg-champagne"><CardContent className="p-6"><h3 className="font-semibold">Portfolio</h3><ul className="mt-3 space-y-2 text-sm">{planner.portfolio.map((url) => <li key={url}><a className="break-all text-gold-muted underline" href={url} target="_blank" rel="noreferrer">Open portfolio item</a></li>)}</ul></CardContent></Card>}
            {planner.lastProfileUpdate && <p className="text-center text-xs text-espresso/45">Information updated {new Date(planner.lastProfileUpdate).toLocaleDateString()}</p>}
          </aside>
        </div>
      )}
    </MarketplaceFrame>
  )
}

function guestRange(minimum: number | null, maximum: number | null): string {
  if (minimum != null && maximum != null) return `${minimum}–${maximum} guests`
  if (maximum != null) return `Up to ${maximum} guests`
  if (minimum != null) return `${minimum}+ guests`
  return ''
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-xl border border-gold/15 bg-white/50 p-4"><p className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-gold-muted">{icon}{label}</p><p className="mt-2 text-sm">{value}</p></div>
}

function TagSection({ title, values }: { title: string; values: string[] }) {
  if (values.length === 0) return null
  return <section className="mt-7"><h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-muted">{title}</h3><div className="mt-3 flex flex-wrap gap-2">{values.map((item) => <span key={item} className="rounded-full border border-gold/20 bg-white/60 px-3 py-1.5 text-xs">{item}</span>)}</div></section>
}

function TextSection({ title, value }: { title: string; value: string }) {
  return <section><h4 className="text-xs font-semibold uppercase tracking-[0.13em] text-gold-muted">{title}</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-espresso/62">{value}</p></section>
}
