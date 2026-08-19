'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Gift, HandHeart, Heart, Plane } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { GiftRegistry } from '@/components/wedding/gift-registry'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'

interface PublicCampaign {
  id: string
  type: string
  title: string
  description: string | null
  currency: string
  targetAmount: number | null
  raised: number | null
  showTarget: boolean
  showRaised: boolean
  externalUrl: string | null
  ctaLabel: string | null
  publicNote: string | null
  recognition?: string[]
}

function money(value: number, currency: string): string {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value) }
  catch { return `${currency} ${Math.round(value).toLocaleString()}` }
}

export function GiftRegistryCampaignBridge() {
  const context = useWeddingContextSafe()
  const slug = context?.wedding?.slug
  const [campaigns, setCampaigns] = useState<PublicCampaign[] | null>(null)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    void fetch(`/api/contribution-campaigns/public?weddingSlug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json()
        if (!cancelled) setCampaigns(Array.isArray(body.data) && body.data.length ? body.data : [])
      })
      .catch(() => { if (!cancelled) setCampaigns([]) })
    return () => { cancelled = true }
  }, [slug])

  if (!campaigns || campaigns.length === 0) return <GiftRegistry />

  return (
    <section id="registry" className="wewed-section bg-champagne py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center md:mb-16">
          <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-gold-muted">With appreciation</p>
          <h2 className="wewed-heading wewed-heading-accent mt-3 text-3xl font-light text-espresso sm:text-4xl md:text-5xl">With Gratitude</h2>
          <p className="mx-auto mt-5 max-w-2xl font-sans text-sm leading-6 text-espresso/60">Your presence is the greatest gift. The information below is only here for anyone who has already been wondering how they might contribute.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => {
            const Icon = campaign.type === 'CHARITY' ? Heart : campaign.type === 'HOME' || campaign.type === 'ITEM_EXPERIENCE' ? Gift : campaign.type === 'WEDDING_SUPPORT' ? HandHeart : Plane
            const progress = campaign.targetAmount && campaign.raised !== null ? Math.min(100, Math.round((campaign.raised / campaign.targetAmount) * 100)) : null
            return (
              <article key={campaign.id} className="flex h-full flex-col rounded-2xl border border-gold/25 bg-ivory/70 p-6 shadow-sm">
                <span className="flex size-12 items-center justify-center rounded-full border border-gold/25 bg-gold/10"><Icon className="size-5 text-gold-muted" /></span>
                <h3 className="mt-5 font-serif text-2xl font-light text-espresso">{campaign.title}</h3>
                {campaign.description && <p className="mt-3 font-sans text-sm leading-6 text-espresso/65">{campaign.description}</p>}
                {(campaign.showTarget || campaign.showRaised) && <div className="mt-6 space-y-2">
                  {campaign.showRaised && campaign.raised !== null && <p className="font-serif text-xl text-gold-muted">{money(campaign.raised, campaign.currency)} <span className="font-sans text-xs text-espresso/45">received</span></p>}
                  {progress !== null && <Progress value={progress} className="h-1.5 bg-gold/15 [&>div]:bg-gold" />}
                  {campaign.showTarget && campaign.targetAmount !== null && <p className="font-sans text-[11px] text-espresso/45">Optional goal: {money(campaign.targetAmount, campaign.currency)}</p>}
                </div>}
                {campaign.publicNote && <p className="mt-5 font-serif text-sm italic leading-6 text-espresso/55">{campaign.publicNote}</p>}{campaign.recognition?.length ? <p className="mt-4 font-sans text-[11px] leading-5 text-espresso/45">With thanks to {campaign.recognition.join(', ')}.</p> : null}
                {campaign.externalUrl && <Button asChild variant="outline" className="mt-6 w-full border-gold/30 bg-gold/5 text-espresso hover:bg-gold/15"><a href={campaign.externalUrl} target="_blank" rel="noopener noreferrer">{campaign.ctaLabel || 'View gifting details'}<ArrowRight className="ml-2 size-4" /></a></Button>}
              </article>
            )
          })}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center font-sans text-xs leading-5 text-espresso/45">Contributing is completely optional. Contributor names and individual amounts are private unless the couple and contributor explicitly choose otherwise.</p>
      </div>
    </section>
  )
}
