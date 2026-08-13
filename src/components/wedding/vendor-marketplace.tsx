'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  Star,
  MapPin,
  Mail,
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
type Accent = 'gold' | 'clay' | 'plum' | 'sage'
type IconName = 'trees' | 'camera' | 'flower' | 'disc'

interface VendorCardData {
  name: string
  category: Category
  location?: string
  description: string
  rating: number
  featured?: boolean
  icon: IconName
  accent: Accent
  email?: string
  profileHref?: string
  ctaLabel?: string
  starter?: boolean
}

const STARTER_VENDORS: VendorCardData[] = [
  {
    name: 'Explore venues',
    category: 'Venue',
    description: 'Discover ceremony and reception spaces that fit your guest count, location and celebration style.',
    rating: 0,
    featured: true,
    icon: 'trees',
    accent: 'gold',
    profileHref: '/vendors?category=Venue',
    ctaLabel: 'Browse category',
    starter: true,
  },
  {
    name: 'Find a photographer',
    category: 'Photographer',
    description: 'Browse wedding photographers and compare portfolios, service areas and enquiry options.',
    rating: 0,
    icon: 'camera',
    accent: 'clay',
    profileHref: '/vendors?category=Photographer',
    ctaLabel: 'Browse category',
    starter: true,
  },
  {
    name: 'Plan the florals',
    category: 'Florist',
    description: 'Explore florists and décor specialists for bouquets, ceremony styling and reception installations.',
    rating: 0,
    icon: 'flower',
    accent: 'sage',
    profileHref: '/vendors?category=Florist',
    ctaLabel: 'Browse category',
    starter: true,
  },
  {
    name: 'Book entertainment',
    category: 'Entertainment',
    description: 'Discover DJs, musicians and entertainment providers for every part of the wedding day.',
    rating: 0,
    icon: 'disc',
    accent: 'plum',
    profileHref: '/vendors?category=Entertainment',
    ctaLabel: 'Browse category',
    starter: true,
  },
]

const ICONS = {
  trees: Trees,
  camera: Camera,
  flower: Flower2,
  disc: Disc3,
} as const

const ACCENT_STYLES: Record<Accent, { gradient: string; icon: string; ring: string }> = {
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

function categoryFrom(value: unknown, fallback: Category): Category {
  return value === 'Venue' || value === 'Photographer' || value === 'Florist' || value === 'Entertainment'
    ? value
    : fallback
}

function accentFrom(value: unknown, fallback: Accent): Accent {
  return value === 'gold' || value === 'clay' || value === 'plum' || value === 'sage'
    ? value
    : fallback
}

function iconFrom(value: unknown, fallback: IconName): IconName {
  return value === 'trees' || value === 'camera' || value === 'flower' || value === 'disc'
    ? value
    : fallback
}

function vendorFromRow(
  value: string,
  metadata: Record<string, unknown>,
  index: number,
): VendorCardData {
  const defaults = STARTER_VENDORS[index % STARTER_VENDORS.length]
  const ratingValue = typeof metadata.rating === 'number' ? metadata.rating : 0
  return {
    name: value,
    category: categoryFrom(metadata.category, defaults.category),
    location: typeof metadata.location === 'string' ? metadata.location : undefined,
    description:
      typeof metadata.description === 'string'
        ? metadata.description
        : 'A wedding professional selected for this celebration.',
    rating: Math.max(0, Math.min(5, Math.round(ratingValue))),
    featured: metadata.featured === true,
    icon: iconFrom(metadata.icon, defaults.icon),
    accent: accentFrom(metadata.accent, defaults.accent),
    email: typeof metadata.email === 'string' && metadata.email.trim() ? metadata.email.trim() : undefined,
    profileHref:
      typeof metadata.profileHref === 'string' && metadata.profileHref.trim()
        ? metadata.profileHref.trim()
        : `/vendors?category=${encodeURIComponent(categoryFrom(metadata.category, defaults.category))}`,
    ctaLabel: typeof metadata.ctaLabel === 'string' ? metadata.ctaLabel : 'View Profile',
  }
}

function VendorCard({ vendor, index }: { vendor: VendorCardData; index: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  const Icon = ICONS[vendor.icon]
  const styles = ACCENT_STYLES[vendor.accent]
  const featured = vendor.featured

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
          featured ? 'border-gold/60 ring-1 ring-gold/30' : `border-gold/20 ${styles.ring}`
        }`}
      >
        <div className={`relative flex aspect-[5/4] items-center justify-center bg-gradient-to-br ${styles.gradient}`}>
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'radial-gradient(circle at 25% 25%, currentColor 1px, transparent 1px)',
              backgroundSize: '18px 18px',
              color: '#FBF6EE',
            }}
          />

          {featured && (
            <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full border border-gold/50 bg-espresso/85 px-2.5 py-0.5 backdrop-blur-sm">
              <Sparkles className="size-3 text-gold" />
              <span className="font-sans text-[10px] font-medium uppercase tracking-[0.15em] text-gold-light">
                Featured
              </span>
            </div>
          )}

          <div className="absolute right-3 top-3 z-10">
            <Badge
              variant="outline"
              className="border-champagne/30 bg-espresso/50 font-sans text-[10px] uppercase tracking-[0.12em] text-champagne backdrop-blur-sm"
            >
              {vendor.category}
            </Badge>
          </div>

          <motion.span
            whileHover={{ scale: 1.05 }}
            className="relative flex size-16 items-center justify-center rounded-full border border-champagne/30 bg-champagne/80 backdrop-blur-sm transition-all duration-300 group-hover:scale-110 sm:size-20"
          >
            <Icon className={`size-7 ${styles.icon} sm:size-8`} strokeWidth={1.25} />
          </motion.span>

          {vendor.rating > 0 && (
            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-full border border-champagne/30 bg-espresso/55 px-2.5 py-0.5 backdrop-blur-sm">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, ratingIndex) => (
                  <Star
                    key={ratingIndex}
                    className={`size-3 ${
                      ratingIndex < vendor.rating
                        ? 'fill-gold text-gold'
                        : 'fill-transparent text-champagne/30'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <CardContent className="flex h-[calc(100%-auto)] flex-col p-5 sm:p-6">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className="wewed-heading text-xl font-light leading-tight text-espresso sm:text-2xl">
              {vendor.name}
            </h3>
          </div>

          {vendor.location && (
            <div className="mb-3 flex items-center gap-1.5 font-sans text-[11px] uppercase tracking-[0.12em] text-gold-muted">
              <MapPin className="size-3" strokeWidth={1.5} />
              {vendor.location}
            </div>
          )}

          <p className="mb-5 font-sans text-sm leading-relaxed text-espresso/65">{vendor.description}</p>

          <div className="mt-auto flex flex-col gap-2 sm:flex-row">
            <Button
              asChild
              variant="outline"
              className={`flex-1 justify-center font-sans text-[11px] uppercase tracking-[0.15em] transition-all duration-300 ${
                featured
                  ? 'border-gold/50 bg-gold/10 text-espresso hover:bg-gold hover:text-espresso'
                  : 'border-gold/30 bg-transparent text-espresso hover:bg-gold hover:text-espresso'
              }`}
            >
              <a href={vendor.profileHref || `/vendors?category=${encodeURIComponent(vendor.category)}`} aria-label={`${vendor.ctaLabel || 'View'} ${vendor.name}`}>
                {vendor.ctaLabel || 'View Profile'}
              </a>
            </Button>
            {vendor.email && (
              <Button
                asChild
                variant="ghost"
                className="flex-1 justify-center border border-espresso/15 bg-transparent font-sans text-[11px] uppercase tracking-[0.15em] text-espresso/75 transition-all duration-300 hover:bg-espresso hover:text-champagne"
              >
                <a
                  href={`mailto:${vendor.email}?subject=Wedding%20enquiry%20via%20Wewed`}
                  aria-label={`Contact ${vendor.name}`}
                >
                  <Mail className="mr-1.5 size-3.5" />
                  Contact
                </a>
              </Button>
            )}
          </div>
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
  const rows = ctx?.getOrdered('vendors', 'vendor-') ?? []
  const vendors = rows.length > 0
    ? rows.map((row, index) => vendorFromRow(row.value, row.metadata, index))
    : STARTER_VENDORS
  const heading = ctx?.getContent('vendors', 'heading', 'The Makings of a Perfect Day') ?? 'The Makings of a Perfect Day'
  const subtitle = ctx?.getContent(
    'vendors',
    'subtitle',
    rows.length > 0
      ? 'The talented hands behind this celebration.'
      : 'Discover the wedding professionals who can help bring your celebration to life.',
  ) ?? 'Discover the wedding professionals who can help bring your celebration to life.'
  const footerMark = [wedding?.monogram || coupleNames(wedding), compactWeddingDate(wedding?.date)]
    .filter(Boolean)
    .join(' · ')

  return (
    <section id="vendors" data-classic-section="vendor-marketplace" className="wewed-section bg-ivory py-20 md:py-32">
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
            <span className="font-sans text-[11px] uppercase tracking-[0.25em] text-gold-muted">The Marketplace</span>
          </div>
          <h2 className="wewed-heading wewed-heading-accent text-3xl font-light text-espresso sm:text-4xl md:text-5xl">{heading}</h2>
          <p className="mx-auto mt-6 max-w-2xl font-sans text-sm leading-relaxed text-espresso/60 sm:text-base">{subtitle}</p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 md:gap-7 lg:grid-cols-4">
          {vendors.map((vendor, index) => <VendorCard key={`${vendor.name}-${index}`} vendor={vendor} index={index} />)}
        </div>

        {rows.length === 0 && (
          <p className="mx-auto mt-6 max-w-2xl text-center font-sans text-xs leading-5 text-espresso/45">
            Marketplace categories are shown until this wedding publishes its own vendor showcase.
          </p>
        )}

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
                  <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-gold-muted">Open Marketplace</span>
                </div>
                <h3 className="wewed-heading text-2xl font-light text-espresso sm:text-3xl">Want to be featured?</h3>
                <p className="mt-3 font-sans text-sm leading-relaxed text-espresso/65 sm:text-base">
                  Join the Wewed vendor marketplace — where couples and planners discover the artisans who make weddings unforgettable.
                </p>
              </div>
              <Button asChild className="shrink-0 bg-espresso font-sans text-xs uppercase tracking-[0.15em] text-champagne transition-all hover:bg-espresso/85">
                <a href="/register?role=vendor">
                  Apply as Vendor
                  <ArrowRight className="ml-2 size-3.5 transition-transform group-hover:translate-x-0.5" />
                </a>
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div className="mt-12 text-center" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }}>
          <div className="wewed-divider mx-auto w-32" />
          {footerMark && <p className="mt-6 wewed-monogram text-xs tracking-widest">{footerMark}</p>}
        </motion.div>
      </div>
    </section>
  )
}
