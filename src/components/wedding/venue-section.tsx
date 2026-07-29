'use client'

import { useMemo, useRef } from 'react'
import Image from 'next/image'
import { motion, useInView } from 'framer-motion'
import {
  Check,
  ExternalLink,
  Flower2,
  MapPin,
  Phone,
  Sparkles,
  Star,
  Trees,
  Wine,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SectionEyebrow } from '@/components/wedding/section-eyebrow'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'

const FLAGSHIP_FEATURES = [
  'Ceremony garden with capacity for 200 guests',
  'Grand reception hall with crystal chandeliers',
  'Manicured lawns for outdoor cocktail hour',
  'On-site catering with Zimbabwean & international cuisine',
  'Complimentary valet parking',
  'Bridal suite with full preparation facilities',
]

const FLAGSHIP_MOMENTS = ['Garden Ceremony', 'Cocktail Hour', 'Grand Reception', 'Sparkler Exit']
const MOMENT_ICONS = [Flower2, Wine, Sparkles, Star]

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
        <Check className="size-3 text-gold" strokeWidth={2.5} />
      </span>
      <span className="font-sans text-sm leading-relaxed text-espresso/75">{text}</span>
    </li>
  )
}

function MomentVignette({ label, index }: { label: string; index: number }) {
  const Icon = MOMENT_ICONS[index % MOMENT_ICONS.length]
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: 0.08 * index }}
      className="group flex flex-col items-center gap-3 text-center"
    >
      <div className="relative flex size-14 items-center justify-center rounded-full border border-gold/30 bg-ivory/80 transition-all duration-300 group-hover:border-gold/60 group-hover:bg-gold/10 sm:size-16">
        <Icon className="size-5 text-gold sm:size-6" strokeWidth={1.25} />
      </div>
      <span className="wewed-heading text-sm font-light text-espresso sm:text-base">{label}</span>
    </motion.div>
  )
}

function formatDate(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date)
}

export function VenueSection() {
  const ctx = useWeddingContextSafe()
  const sectionRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' })
  const wedding = ctx?.wedding
  const isFlagship = ctx?.isFlagship ?? true
  const get = (field: string, fallback = '') => ctx?.getContent('venue', field, fallback) ?? fallback

  const venueName = get('heading', wedding?.venue || (isFlagship ? 'Imba Manor' : 'Wedding Venue'))
  const subtitle = get('subtitle', isFlagship ? 'Our chosen sanctuary — where forever begins' : '')
  const description = get('description', '')
  const address = get('address', '')
  const suburb = get('suburb', '')
  const cityCountry = get(
    'cityCountry',
    [wedding?.venueCity, wedding?.venueCountry].filter(Boolean).join(', '),
  )
  const phone = get('phone', '')
  const website = get('website', '')
  const imageUrl = get('imageUrl', '')
  const imageAlt = get('imageAlt', `${venueName} wedding venue`)
  const imageCaption = get('imageCaption', [venueName, cityCountry].filter(Boolean).join(' · '))
  const imageTitle = get('imageTitle', '')
  const aboutEyebrow = get('aboutEyebrow', 'About the Venue')
  const aboutHeading = get('aboutHeading', venueName)
  const mapUrl = wedding?.venueMapUrl || ''
  const exploreLabel = get('exploreLabel', 'Explore Venue')
  const directionsLabel = get('directionsLabel', 'Get Directions')
  const date = formatDate(wedding?.date)
  const monogram = wedding?.monogram || wedding?.title || ''

  const featureRows = ctx?.getOrdered('venue', 'feature').map((item) => item.value).filter(Boolean) ?? []
  const features = featureRows.length ? featureRows : isFlagship ? FLAGSHIP_FEATURES : []
  const momentRows = ctx?.getOrdered('venue', 'moment').map((item) => item.value).filter(Boolean) ?? []
  const moments = momentRows.length ? momentRows : isFlagship ? FLAGSHIP_MOMENTS : []
  const location = useMemo(
    () => [address, suburb, cityCountry].filter(Boolean).join(', '),
    [address, suburb, cityCountry],
  )

  if (!venueName && !description && !location) return null

  return (
    <section id="venue" className="wewed-section bg-ivory py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={sectionRef}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-14 text-center md:mb-20"
        >
          <SectionEyebrow>The Venue</SectionEyebrow>
          <div className="mb-4 flex items-center justify-center">
            <Trees className="h-5 w-5 text-gold" strokeWidth={1.25} />
          </div>
          <h2 className="wewed-heading wewed-heading-accent text-3xl font-light text-espresso sm:text-4xl md:text-5xl">
            {venueName}
          </h2>
          {subtitle && <p className="mt-6 font-sans text-sm tracking-wide text-espresso/60 sm:text-base">{subtitle}</p>}
        </motion.div>

        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="wewed-photo-frame relative aspect-[4/5] overflow-hidden rounded-2xl border-2 border-gold/30 bg-gradient-to-br from-espresso via-plum to-clay shadow-xl sm:aspect-[5/4] lg:aspect-[4/5]">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={imageAlt}
                  fill
                  unoptimized={imageUrl.startsWith('http')}
                  sizes="(min-width: 1024px) 50vw, 90vw"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-champagne/90">
                    <MapPin className="mx-auto size-12 text-gold" strokeWidth={1} />
                    <p className="mt-4 font-serif text-3xl">{venueName}</p>
                    {location && <p className="mt-2 max-w-sm px-6 font-sans text-xs uppercase tracking-[0.16em] text-champagne/60">{location}</p>}
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-espresso/70 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <div className="flex items-center gap-3">
                  <span className="h-px w-8 bg-gold" />
                  <MapPin className="size-4 text-gold" strokeWidth={1.5} />
                  <span className="font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-champagne">
                    {imageCaption || location}
                  </span>
                </div>
                {imageTitle && <p className="mt-2 wewed-heading text-xl font-light text-champagne sm:text-2xl">{imageTitle}</p>}
              </div>
            </div>

            {(monogram || date) && (
              <div className="absolute -right-3 -top-3 flex size-20 rotate-3 items-center justify-center rounded-full border border-gold/40 bg-champagne shadow-md">
                <div className="flex flex-col items-center px-2 text-center">
                  <span className="wewed-monogram max-w-16 truncate text-[10px] leading-none">{monogram}</span>
                  {date && <span className="mt-1 font-sans text-[8px] uppercase tracking-wider text-espresso/50">{date}</span>}
                </div>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card className="border-gold/20 bg-champagne/60 backdrop-blur-sm">
              <CardContent className="p-6 sm:p-8 lg:p-10">
                <p className="mb-2 font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-gold-muted">{aboutEyebrow}</p>
                <h3 className="wewed-heading mb-5 text-2xl font-light text-espresso sm:text-3xl">{aboutHeading}</h3>
                {description && <p className="mb-6 whitespace-pre-line font-sans text-sm leading-relaxed text-espresso/70 sm:text-[0.95rem]">{description}</p>}

                {location && (
                  <div className="mb-6 rounded-xl border border-gold/20 bg-ivory/55 p-4">
                    <p className="flex items-start gap-2 font-sans text-sm text-espresso/75">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-gold" />
                      {location}
                    </p>
                    {phone && (
                      <a href={`tel:${phone.replace(/\s+/g, '')}`} className="mt-3 flex items-center gap-2 font-sans text-sm text-espresso/70 hover:text-gold-muted">
                        <Phone className="size-4 text-gold" />
                        {phone}
                      </a>
                    )}
                  </div>
                )}

                {features.length > 0 && (
                  <ul className="mb-8 grid gap-3">
                    {features.map((feature) => <FeatureItem key={feature} text={feature} />)}
                  </ul>
                )}

                {(website || mapUrl) && (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    {website && (
                      <Button asChild variant="outline" className="flex-1 border-gold/40 bg-transparent font-sans text-xs uppercase tracking-[0.15em] text-espresso hover:bg-gold">
                        <a href={website} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-3.5 w-3.5" />
                          {exploreLabel}
                        </a>
                      </Button>
                    )}
                    {mapUrl && (
                      <Button asChild className="flex-1 bg-espresso font-sans text-xs uppercase tracking-[0.15em] text-champagne hover:bg-espresso/85">
                        <a href={mapUrl} target="_blank" rel="noopener noreferrer">
                          <MapPin className="mr-2 h-3.5 w-3.5" />
                          {directionsLabel}
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {moments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7 }}
            className="mt-16 sm:mt-20"
          >
            <div className="rounded-2xl border border-gold/20 bg-champagne/40 px-6 py-8 backdrop-blur-sm sm:px-10 sm:py-10">
              <p className="mb-8 text-center font-sans text-[11px] font-medium uppercase tracking-[0.25em] text-gold-muted">A Day of Moments</p>
              <div className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4">
                {moments.map((moment, index) => <MomentVignette key={`${moment}-${index}`} label={moment} index={index} />)}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  )
}
