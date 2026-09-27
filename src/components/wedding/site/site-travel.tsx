'use client'

import { ExternalLink } from 'lucide-react'
import {
  OwnerSetupPrompt,
  Reveal,
  SiteSection,
  isSafeHttpUrl,
  metadataString,
  usePublishedCopy,
  useSiteItems,
} from '@/components/wedding/site/primitives'
import type { PublicSiteItem } from '@/lib/wedding-site/model'

function InfoCard({ item, index }: { item: PublicSiteItem; index: number }) {
  const category = metadataString(item, 'category')
  const detail = metadataString(item, 'detail')
  const link = item.url && isSafeHttpUrl(item.url) ? item.url : null
  return (
    <li>
      <Reveal delay={0.05 * (index % 3)} className="flex h-full flex-col rounded-2xl border border-gold/20 bg-ivory p-6 shadow-[0_1px_0_rgba(191,155,95,0.15)]">
        {category ? (
          <p className="font-sans text-[11px] uppercase tracking-[0.26em] text-gold-muted">{category}</p>
        ) : null}
        <h3 className="wewed-heading mt-2 text-xl font-light text-espresso">{item.title}</h3>
        {detail ? <p className="mt-1 font-sans text-xs text-espresso/55">{detail}</p> : null}
        {item.body ? <p className="mt-3 flex-1 whitespace-pre-line font-sans text-sm leading-6 text-espresso/70">{item.body}</p> : null}
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-11 items-center gap-2 self-start font-sans text-xs uppercase tracking-[0.18em] text-espresso underline decoration-gold/50 underline-offset-4 hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
          >
            More information
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
      </Reveal>
    </li>
  )
}

/** Travel cards and Guest Guide entries are both website-owned WeddingSiteItem rows. */
export function SiteTravel({ showGuide }: { showGuide: boolean }) {
  const heading = usePublishedCopy('travel', 'heading')
  const subtitle = usePublishedCopy('travel', 'subtitle')
  const guideHeading = usePublishedCopy('guide', 'heading')
  const travel = useSiteItems('travel')
  const guide = useSiteItems('guide')
  const guideItems = showGuide ? guide : []

  if (!travel.length && !guideItems.length) {
    return (
      <OwnerSetupPrompt
        section="travel"
        message="No travel or accommodation details are published yet, so guests don't see Travel & Stay."
      />
    )
  }

  return (
    <SiteSection id="travel" eyebrow="Travel & Stay" heading={heading || 'Travel & Stay'} subtitle={subtitle || undefined} tone="champagne">
      {travel.length ? (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {travel.map((item, index) => (
            <InfoCard key={item.id} item={item} index={index} />
          ))}
        </ul>
      ) : null}
      {guideItems.length ? (
        <div id="guide" className={`scroll-mt-20 ${travel.length ? 'mt-16' : ''}`}>
          <h3 className="mb-6 text-center font-sans text-[11px] font-medium uppercase tracking-[0.3em] text-gold-muted">
            {guideHeading || 'Guest Guide'}
          </h3>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {guideItems.map((item, index) => (
              <InfoCard key={item.id} item={item} index={index} />
            ))}
          </ul>
        </div>
      ) : null}
    </SiteSection>
  )
}
