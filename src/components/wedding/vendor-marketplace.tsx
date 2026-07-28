'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
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
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Category = 'Venue' | 'Photographer' | 'Florist' | 'Entertainment';

interface Vendor {
  name: string;
  category: Category;
  location?: string;
  description: string;
  rating: number;
  featured?: boolean;
  icon: typeof Trees;
  accent: 'gold' | 'clay' | 'plum' | 'sage';
  email: string;
}

/* ─── Data ───────────────────────────────────────────────────────────────── */

const VENDORS: Vendor[] = [
  {
    name: 'Imba Manor',
    category: 'Venue',
    location: 'Harare, Zimbabwe',
    description:
      'An estate where elegance meets African warmth — where our forever begins.',
    rating: 5,
    featured: true,
    icon: Trees,
    accent: 'gold',
    email: 'celebrations@imbamanor.co.zw',
  },
  {
    name: 'Tendai Photography',
    category: 'Photographer',
    description:
      'Capturing love stories across Zimbabwe for over a decade.',
    rating: 5,
    icon: Camera,
    accent: 'clay',
    email: 'hello@tendaiphotography.com',
  },
  {
    name: 'Sage & Bloom',
    category: 'Florist',
    description:
      'Botanical artistry for the modern romantic — every stem, a story.',
    rating: 5,
    icon: Flower2,
    accent: 'sage',
    email: 'studio@sageandbloom.co.zw',
  },
  {
    name: 'Rhythm & Soul DJ',
    category: 'Entertainment',
    description:
      'From ceremony to last dance, we keep the celebration moving.',
    rating: 5,
    icon: Disc3,
    accent: 'plum',
    email: 'bookings@rhythmandsoul.co.zw',
  },
];

const ACCENT_STYLES: Record<
  Vendor['accent'],
  { gradient: string; iconWrap: string; icon: string; ring: string }
> = {
  gold: {
    gradient: 'from-gold/35 via-gold/10 to-espresso/15',
    iconWrap: 'border-gold/40 bg-gold/10',
    icon: 'text-gold',
    ring: 'group-hover:border-gold/60',
  },
  clay: {
    gradient: 'from-clay/30 via-clay/10 to-espresso/15',
    iconWrap: 'border-clay/40 bg-clay/10',
    icon: 'text-clay',
    ring: 'group-hover:border-clay/60',
  },
  plum: {
    gradient: 'from-plum/30 via-plum/10 to-espresso/15',
    iconWrap: 'border-plum/40 bg-plum/10',
    icon: 'text-plum',
    ring: 'group-hover:border-plum/60',
  },
  sage: {
    gradient: 'from-sage/30 via-sage/10 to-espresso/15',
    iconWrap: 'border-sage/40 bg-sage/10',
    icon: 'text-sage',
    ring: 'group-hover:border-sage/60',
  },
};

const EASING = [0.22, 1, 0.36, 1] as const;

/* ─── Vendor card ─────────────────────────────────────────────────────────── */

function VendorCard({ vendor, index }: { vendor: Vendor; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const Icon = vendor.icon;
  const styles = ACCENT_STYLES[vendor.accent];
  const featured = vendor.featured;

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
          featured
            ? 'border-gold/60 ring-1 ring-gold/30'
            : 'border-gold/20 ' + styles.ring
        }`}
      >
        {/* Image placeholder — gradient + icon */}
        <div
          className={`relative flex aspect-[5/4] items-center justify-center bg-gradient-to-br ${styles.gradient}`}
        >
          {/* Decorative pattern */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 25% 25%, currentColor 1px, transparent 1px)',
              backgroundSize: '18px 18px',
              color: '#FBF6EE',
            }}
          />

          {/* Featured badge */}
          {featured && (
            <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full border border-gold/50 bg-espresso/85 px-2.5 py-0.5 backdrop-blur-sm">
              <Sparkles className="size-3 text-gold" />
              <span className="font-sans text-[10px] font-medium uppercase tracking-[0.15em] text-gold-light">
                Featured
              </span>
            </div>
          )}

          {/* Category badge */}
          <div className="absolute right-3 top-3 z-10">
            <Badge
              variant="outline"
              className="border-champagne/30 bg-espresso/50 font-sans text-[10px] uppercase tracking-[0.12em] text-champagne backdrop-blur-sm"
            >
              {vendor.category}
            </Badge>
          </div>

          {/* Center icon */}
          <motion.span
            whileHover={{ scale: 1.05 }}
            className={`relative flex size-16 items-center justify-center rounded-full border bg-champagne/80 backdrop-blur-sm transition-all duration-300 group-hover:scale-110 sm:size-20`}
          >
            <Icon
              className={`size-7 ${styles.icon} sm:size-8`}
              strokeWidth={1.25}
            />
          </motion.span>

          {/* Rating */}
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-full border border-champagne/30 bg-espresso/55 px-2.5 py-0.5 backdrop-blur-sm">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`size-3 ${
                    i < vendor.rating
                      ? 'fill-gold text-gold'
                      : 'fill-transparent text-champagne/30'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Body */}
        <CardContent className="flex flex-col p-5 sm:p-6">
          {/* Name + location */}
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

          {/* Description */}
          <p className="mb-5 font-sans text-sm leading-relaxed text-espresso/65">
            {vendor.description}
          </p>

          {/* Buttons */}
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
              <a href="#" aria-label={`View ${vendor.name} profile`}>
                View Profile
              </a>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="flex-1 justify-center border border-espresso/15 bg-transparent font-sans text-[11px] uppercase tracking-[0.15em] text-espresso/75 transition-all duration-300 hover:bg-espresso hover:text-champagne"
            >
              <a
                href={`mailto:${vendor.email}?subject=Wedding%20enquiry%20via%20wewed`}
                aria-label={`Contact ${vendor.name}`}
              >
                <Mail className="mr-1.5 size-3.5" />
                Contact
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Section ──────────────────────────────────────────────────────────────── */

export function VendorMarketplace() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });
  const ctaRef = useRef(null);
  const isCtaInView = useInView(ctaRef, { once: true, margin: '-50px' });

  return (
    <section
      id="vendors"
     
      className="wewed-section bg-ivory py-20 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
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
            The Makings of a Perfect Day
          </h2>
          <p className="mx-auto mt-6 max-w-2xl font-sans text-sm leading-relaxed text-espresso/60 sm:text-base">
            The talented hands behind our celebration — and available for yours.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid gap-6 md:gap-7 md:grid-cols-2 lg:grid-cols-4">
          {VENDORS.map((v, i) => (
            <VendorCard key={v.name} vendor={v} index={i} />
          ))}
        </div>

        {/* CTA — Apply as Vendor */}
        <motion.div
          ref={ctaRef}
          initial={{ opacity: 0, y: 20 }}
          animate={isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.7, ease: EASING, delay: 0.1 }}
          className="mt-16 md:mt-20"
        >
          <div className="wewed-photo-frame relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-champagne via-ivory to-gold/10 p-8 sm:p-10">
            {/* Decorative gold hairlines */}
            <span className="pointer-events-none absolute left-1/2 top-0 h-px w-32 -translate-x-1/2 bg-gradient-to-r from-transparent via-gold to-transparent" />
            <span className="pointer-events-none absolute left-1/2 bottom-0 h-px w-32 -translate-x-1/2 bg-gradient-to-r from-transparent via-gold to-transparent" />

            <div className="flex flex-col items-center gap-6 text-center lg:flex-row lg:justify-between lg:text-left">
              <div className="max-w-2xl">
                <div className="mb-3 flex items-center justify-center gap-2 lg:justify-start">
                  <Sparkles className="size-4 text-gold" strokeWidth={1.5} />
                  <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-gold-muted">
                    Open Marketplace
                  </span>
                </div>
                <h3 className="wewed-heading text-2xl font-light text-espresso sm:text-3xl">
                  Want to be featured?
                </h3>
                <p className="mt-3 font-sans text-sm leading-relaxed text-espresso/65 sm:text-base">
                  Join the wewed vendor marketplace — where couples across
                  Zimbabwe and beyond discover the artisans who make weddings
                  unforgettable.
                </p>
              </div>
              <Button
                asChild
                className="shrink-0 bg-espresso font-sans text-xs uppercase tracking-[0.15em] text-champagne transition-all hover:bg-espresso/85"
              >
                <a href="mailto:marketplace@wewed.co.zw?subject=Vendor%20Application">
                  Apply as Vendor
                  <ArrowRight className="ml-2 size-3.5 transition-transform group-hover:translate-x-0.5" />
                </a>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Footer monogram */}
        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="wewed-divider mx-auto w-32" />
          <p className="mt-6 wewed-monogram text-xs tracking-widest">
            C&amp;K &middot; 23.12.26
          </p>
        </motion.div>
      </div>
    </section>
  );
}
