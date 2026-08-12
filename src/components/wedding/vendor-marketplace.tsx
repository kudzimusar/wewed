'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  Trees,
  Camera,
  Flower2,
  Disc3,
  ArrowRight,
  Sparkles,
  Heart,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'
import { compactWeddingDate, coupleNames } from '@/lib/wedding-template-defaults'

type Category = 'Venue' | 'Photographer' | 'Florist' | 'Entertainment'

interface MarketplaceCategory {
  name: string
  category: Category
  description: string
  icon: typeof Trees
  accent: 'gold' | 'clay' | 'plum' | 'sage'
  featured?: boolean
}

const CATEGORIES: MarketplaceCategory[] = [
  {
    name: 'Explore venues',
    category: 'Venue',
    description: 'Discover ceremony and reception spaces that fit your guest count, location and celebration style.',
    icon: Trees,
    accent: 'gold',
    featured: true,
  },
  {
    name: 'Find a photographer',
    category: 'Photographer',
    description: 'Browse wedding photographers and compare their portfolios, service areas and enquiry options.',
    icon: Camera,
    accent: 'clay',
  },
  {
    name: 'Plan the florals',
    category: 'Florist',
    description: 'Explore florists and décor specialists for bouquets, ceremony styling and reception installations.',
    icon: Flower2,
    accent: 'sage',
  },
  {
    name: 'Book entertainment',
    category: 'Entertainment',
    description: 'Discover DJs, musicians and entertainment providers for every part of the wedding day.',
    icon: Disc3,
    accent: 'plum',
  },
]

const ACCENT_STYLES: Record<
  MarketplaceCategory['accent'],
  { gradient: string; icon: string; ring: string }
> = {
  gold: {
    gradient: 'from-gold/35 via-gold/10 to-espresso/15',
    icon: 'text-gold',
    ring: 'group-hover:border-gold/60',
  },
  clay: {
    gradient: 'from-clay/30 via-clay/10 to-espresso/15',
    icon: 'text-clay',
    ring: 'group-hover:border-clay/60',
  },
  plum: {
    gradient: 'from-plum/30 via-plum/10 to-espresso/15',
    icon: 'text-plum',
    ring: 'group-hover:border-plum/60',
  },
  sage: {
    gradient: 'from-sage/30 via-sage/10 to-espresso/15',
    icon: 'text-sage',
    ring: 'group-hover:border-sage/60',
  },
}

const EASING = [0.22, 1, 0.36, 1] as const

function MarketplaceCard({
  item,
  index,
}: {
  item: MarketplaceCategory
  index: number
}) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  const Icon = item.icon
  const styles = ACCENT_STYLES[item.accent]
  const href = `/vendors?category=${encodeURIComponent(item.category)}`

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, ease: EASING, delay: 0.1 * index }}
      className="h-full"
    >
      <Card
        className={`group h-full overflow-hidden border bg-champagne shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${
          item.featured
            ? 'border-gold/60 ring-1 ring-gold/30'
            : `border-gold/20 ${styles.ring}`
        }`}
      >
        <div
          className={`relative flex aspect-[5/4] items-center justify-center bg-gradient-to-br ${styles.gradient}`}
        >
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 25% 25%, currentColor 1px, transparent 1px)',
              backgroundSize: '18px 18px',
              color: '#FBF6EE',
            }}
          />

          {item.featured && (
            <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full border border-gold/50 bg-espresso/85 px-2.5 py-0.5 backdrop-blur-sm">
              <Sparkles className="size-3 text-gold" />
              <span className="font-sans text-[10px] font-medium uppercase tracking-[0.15em] text-gold-light">
                Featured category
              </span>
            </div>
          )}

          <div className="absolute right-3 top-3 z-10">
            <Badge
              variant="outline"
              className="border-champagne/30 bg-espresso/50 font-sans text-[10px] uppercase tracking-[0.12em] text-champagne backdrop-blur-sm"
            >
              {item.category}
            </Badge>
          </div>

          <motion.span
            whileHover={{ scale: 1.05 }}
            className="relative flex size-16 items-center justify-center rounded-full border border-gold/25 bg-champagne/80 backdrop-blur-sm transition-all duration-300 group-hover:scale-110 sm:size-20"
          >
            <Icon
              className={`size-7 ${styles.icon} sm:size-8`}
              strokeWidth={1.25}
            />
          </motion.span>
        </div>

        <CardContent className="flex h-full flex-col p-5 sm:p-6">
          <h3 className="wewed-heading text-xl font-light leading-tight text-espresso sm:text-2xl">
            {item.name}
          </h3>
          <p className="mb-5 mt-3 font-sans text-sm leading-relaxed text-espresso/65">
            {item.description}
          </p>
          <Button
            asChild
            variant="outline"
            className="mt-auto w-full justify-center border-gold/40 bg-transparent font-sans text-[11px] uppercase tracking-[0.15em] text-espresso transition-all hover:bg-gold hover:text-espresso"
          >
            <a href={href} aria-label={`${item.name} in the Wewed marketplace`}>
              Browse category
              <ArrowRight className="ml-1.5 size-3.5" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function VendorMarketplace() {
  const sectionRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' })
  const ctaRef = useRef(null)
  const isCtaInView = useInView(ctaRef, { once: true, margin: '-50px' })
  const ctx = useWeddingContextSafe()
  const wedding = ctx?.wedding
  const footerMark = [
    wedding?.monogram || coupleNames(wedding),
    compactWeddingDate(wedding?.date),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section id="vendors" className="wewed-section bg-ivory py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={sectionRef}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: EASING }}
          className="mb-12 text-center md:mb-16"
        >
          <div className="mb-4 flex items-center justify-center gap-2">
            <Heart className="h-4 w-4 text-gold" strokeWidth={1.25} />
            <span className="font-sans text-[11px] uppercase tracking-[0.25em] text-gold-muted">
              The Marketplace
            </span>
          </div>
          <h2 className="wewed-heading wewed-heading-accent text-3xl font-light text-espresso sm:text-4xl md:text-5xl">
            Find the right team
          </h2>
          <p className="mx-auto mt-6 max-w-2xl font-sans text-sm leading-relaxed text-espresso/60 sm:text-base">
            Explore wedding professionals in the Wewed marketplace without exposing another couple&apos;s booked suppliers.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 md:gap-7 lg:grid-cols-4">
          {CATEGORIES.map((item, index) => (
            <MarketplaceCard key={item.category} item={item} index={index} />
          ))}
        </div>

        <motion.div
          ref={ctaRef}
          initial={{ opacity: 0, y: 20 }}
          animate={isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.7, ease: EASING, delay: 0.1 }}
          className="mt-16 md:mt-20"
        >
          <div className="wewed-photo-frame relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-champagne via-ivory to-gold/10 p-8 sm:p-10">
            <span className="pointer-events-none absolute left-1/2 top-0 h-px w-32 -translate-x-1/2 bg-gradient-to-r from-transparent via-gold to-transparent" />
            <span className="pointer-events-none absolute bottom-0 left-1/2 h-px w-32 -translate-x-1/2 bg-gradient-to-r from-transparent via-gold to-transparent" />

            <div className="flex flex-col items-center gap-6 text-center lg:flex-row lg:justify-between lg:text-left">
              <div className="max-w-2xl">
                <div className="mb-3 flex items-center justify-center gap-2 lg:justify-start">
                  <Sparkles className="size-4 text-gold" strokeWidth={1.5} />
                  <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-gold-muted">
                    Open Marketplace
                  </span>
                </div>
                <h3 className="wewed-heading text-2xl font-light text-espresso sm:text-3xl">
                  Offer wedding services?
                </h3>
                <p className="mt-3 font-sans text-sm leading-relaxed text-espresso/65 sm:text-base">
                  Join the Wewed vendor marketplace so couples and planners can discover your services through a governed provider profile.
                </p>
              </div>
              <Button
                asChild
                className="shrink-0 bg-espresso font-sans text-xs uppercase tracking-[0.15em] text-champagne transition-all hover:bg-espresso/85"
              >
                <a href="/register?role=vendor">
                  Apply as Vendor
                  <ArrowRight className="ml-2 size-3.5" />
                </a>
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="wewed-divider mx-auto w-32" />
          {footerMark && (
            <p className="mt-6 wewed-monogram text-xs tracking-widest">
              {footerMark}
            </p>
          )}
        </motion.div>
      </div>
    </section>
  )
}
