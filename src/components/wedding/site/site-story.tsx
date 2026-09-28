'use client'

import Image from 'next/image'
import {
  OwnerSetupPrompt,
  Prose,
  Reveal,
  SiteSection,
  displayableImageSrc,
  metadataString,
  usePublishedCopy,
  useSiteItems,
} from '@/components/wedding/site/primitives'
import type { PublicSiteItem } from '@/lib/wedding-site/model'

function ItemImage({ item, className }: { item: PublicSiteItem; className: string }) {
  const src = displayableImageSrc(item.media?.thumbnailUrl || item.media?.url)
  if (!src) return null
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        src={src}
        alt={item.media?.caption || ''}
        fill
        sizes="(min-width: 768px) 320px, 90vw"
        unoptimized={src.startsWith('http')}
        className="object-cover"
      />
    </div>
  )
}

function Milestone({ item, index }: { item: PublicSiteItem; index: number }) {
  const when = metadataString(item, 'date') || metadataString(item, 'year')
  return (
    <li className="relative grid gap-4 pl-8 sm:pl-0 md:grid-cols-2 md:gap-12">
      <span className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full border border-gold bg-ivory md:left-1/2 md:-translate-x-1/2" aria-hidden="true" />
      <Reveal delay={0.05 * (index % 3)} className={index % 2 === 0 ? 'md:text-right' : 'md:order-2'}>
        {when ? (
          <p className="font-sans text-[11px] uppercase tracking-[0.28em] text-gold-muted">{when}</p>
        ) : null}
        <h3 className="wewed-heading mt-2 text-2xl font-light text-espresso">{item.title}</h3>
        {item.body ? <Prose text={item.body} className="mt-3 font-sans text-sm leading-7 text-espresso/70" /> : null}
      </Reveal>
      <div className={index % 2 === 0 ? 'md:order-2' : ''}>
        <ItemImage item={item} className="aspect-[4/3] rounded-2xl" />
      </div>
    </li>
  )
}

function PartyProfile({ item }: { item: PublicSiteItem }) {
  const role = metadataString(item, 'role')
  return (
    <li className="flex flex-col items-center text-center">
      <ItemImage item={item} className="mb-4 h-32 w-32 rounded-full border border-gold/30" />
      <p className="wewed-heading text-xl font-light text-espresso">{item.title}</p>
      {role ? <p className="mt-1 font-sans text-[11px] uppercase tracking-[0.24em] text-gold-muted">{role}</p> : null}
      {item.body ? <p className="mt-3 max-w-xs font-sans text-sm leading-6 text-espresso/65">{item.body}</p> : null}
    </li>
  )
}

export function SiteStory() {
  const heading = usePublishedCopy('story', 'heading')
  const subtitle = usePublishedCopy('story', 'subtitle')
  const title = usePublishedCopy('story', 'title')
  const introduction = usePublishedCopy('story', 'introduction')
  const body = usePublishedCopy('story', 'body')
  const milestones = useSiteItems('story')
  const hasStory = Boolean(title || introduction || body || milestones.length)

  if (!hasStory) {
    return (
      <OwnerSetupPrompt
        section="story"
        message="Your story is not published yet, so guests don't see this section. Add and publish it when you're ready."
      />
    )
  }

  return (
    <SiteSection id="story" eyebrow="Our Story" heading={heading || title || 'Our Story'} subtitle={subtitle || undefined}>
      {introduction || body ? (
        <Reveal className="mx-auto mb-16 max-w-2xl text-center">
          {heading && title ? <h3 className="wewed-heading mb-6 text-2xl font-light text-espresso">{title}</h3> : null}
          {introduction ? (
            <Prose text={introduction} className="font-serif text-lg italic leading-8 text-espresso/80" />
          ) : null}
          {body ? <Prose text={body} className="mt-6 font-sans text-base leading-8 text-espresso/70" /> : null}
        </Reveal>
      ) : null}
      {milestones.length ? (
        <ol className="relative space-y-14 before:absolute before:bottom-0 before:left-[4px] before:top-0 before:w-px before:bg-gold/25 md:before:left-1/2">
          {milestones.map((item, index) => (
            <Milestone key={item.id} item={item} index={index} />
          ))}
        </ol>
      ) : null}
    </SiteSection>
  )
}

export function SiteParty() {
  const heading = usePublishedCopy('party', 'heading')
  const subtitle = usePublishedCopy('party', 'subtitle')
  const people = useSiteItems('party')
  if (!people.length) return null
  return (
    <SiteSection id="party" eyebrow="Wedding Party" heading={heading || 'Wedding Party'} subtitle={subtitle || undefined} tone="champagne">
      <ul className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((item) => (
          <PartyProfile key={item.id} item={item} />
        ))}
      </ul>
    </SiteSection>
  )
}
