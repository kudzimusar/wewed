'use client'

import Image from 'next/image'
import { MapPin } from 'lucide-react'
import { useWeddingContext } from '@/components/wedding/wedding-data-provider'
import {
  Prose,
  Reveal,
  SiteSection,
  displayableImageSrc,
  usePublishedCopy,
  useSiteItems,
} from '@/components/wedding/site/primitives'
import { venueDirectionsUrl, venueLocality } from '@/lib/wedding-site/format'

/** Venue is a core fact (Wedding.venue/venueCity/venueCountry), so this section always renders. */
export function SiteVenue() {
  const { wedding } = useWeddingContext()
  const heading = usePublishedCopy('venue', 'heading')
  const subtitle = usePublishedCopy('venue', 'subtitle')
  const description = usePublishedCopy('venue', 'description')
  const imageUrl = usePublishedCopy('venue', 'imageUrl')
  const features = useSiteItems('venue')
  if (!wedding || !wedding.venue) return null

  const locality = venueLocality(wedding)
  const directions = venueDirectionsUrl(wedding)
  const image = displayableImageSrc(imageUrl)

  return (
    <SiteSection id="venue" eyebrow="The Venue" heading={heading || wedding.venue} subtitle={subtitle || undefined}>
      <div className={`grid items-center gap-10 ${image ? 'lg:grid-cols-2' : ''}`}>
        {image ? (
          <Reveal className="relative aspect-[4/5] overflow-hidden rounded-3xl sm:aspect-[4/3] lg:aspect-[4/5]">
            <Image
              src={image}
              alt={`${wedding.venue}`}
              fill
              sizes="(min-width: 1024px) 480px, 100vw"
              unoptimized={image.startsWith('http')}
              className="object-cover"
            />
          </Reveal>
        ) : null}
        <Reveal className={image ? '' : 'mx-auto max-w-2xl text-center'}>
          {heading ? <p className="wewed-heading text-2xl font-light text-espresso">{wedding.venue}</p> : null}
          {locality ? (
            <p className="mt-2 font-sans text-sm uppercase tracking-[0.22em] text-gold-muted">{locality}</p>
          ) : null}
          {description ? (
            <Prose text={description} className="mt-6 font-sans text-base leading-8 text-espresso/70" />
          ) : null}
          {directions ? (
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full border border-gold/40 px-6 font-sans text-xs uppercase tracking-[0.2em] text-espresso transition-colors hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Directions
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
        </Reveal>
      </div>

      {features.length ? (
        <ul className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((item, index) => (
            <li key={item.id}>
              <Reveal delay={0.05 * (index % 3)} className="h-full rounded-2xl border border-gold/20 bg-champagne/40 p-6">
                <h3 className="wewed-heading text-xl font-light text-espresso">{item.title}</h3>
                {item.body ? <p className="mt-3 font-sans text-sm leading-6 text-espresso/65">{item.body}</p> : null}
              </Reveal>
            </li>
          ))}
        </ul>
      ) : null}
    </SiteSection>
  )
}
