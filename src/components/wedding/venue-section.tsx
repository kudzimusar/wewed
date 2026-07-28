'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { motion, useInView } from 'framer-motion';
import {
  Check,
  MapPin,
  ExternalLink,
  Flower2,
  Wine,
  Sparkles,
  Star,
  Trees,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SectionEyebrow } from '@/components/wedding/section-eyebrow';

const VENUE_FEATURES: string[] = [
  'Ceremony garden with capacity for 200 guests',
  'Grand reception hall with crystal chandeliers',
  'Manicured lawns for outdoor cocktail hour',
  'On-site catering with Zimbabwean & international cuisine',
  'Complimentary valet parking',
  'Bridal suite with full preparation facilities',
];

interface Moment {
  label: string;
  icon: typeof Flower2;
}

const MOMENTS: Moment[] = [
  { label: 'Garden Ceremony', icon: Flower2 },
  { label: 'Cocktail Hour', icon: Wine },
  { label: 'Grand Reception', icon: Sparkles },
  { label: 'Sparkler Exit', icon: Star },
];

function FeatureItem({ text, index }: { text: string; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-30px' });
  return (
    <li
      ref={ref}
      className="flex items-start gap-3"
    >
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
        <Check className="size-3 text-gold" strokeWidth={2.5} />
      </span>
      <span className="font-sans text-sm leading-relaxed text-espresso/75">
        {text}
      </span>
    </li>
  );
}

function MomentVignette({
  moment,
  index,
}: {
  moment: Moment;
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const Icon = moment.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
        delay: 0.1 * index,
      }}
      className="group flex flex-col items-center gap-3 text-center"
    >
      <div className="relative flex size-14 items-center justify-center rounded-full border border-gold/30 bg-ivory/80 transition-all duration-300 group-hover:border-gold/60 group-hover:bg-gold/10 sm:size-16">
        <span className="absolute inset-0 rounded-full border border-gold/10 transition-transform duration-500 group-hover:scale-110" />
        <Icon
          className="size-5 text-gold transition-transform duration-300 group-hover:scale-110 sm:size-6"
          strokeWidth={1.25}
        />
      </div>
      <span className="wewed-heading text-sm font-light text-espresso sm:text-base">
        {moment.label}
      </span>
    </motion.div>
  );
}

export function VenueSection() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });
  const imageRef = useRef(null);
  const isImageInView = useInView(imageRef, { once: true, margin: '-80px' });

  return (
    <section id="venue" className="wewed-section bg-ivory py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
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
            Imba Manor
          </h2>
          <p className="mt-6 font-sans text-sm tracking-wide text-espresso/60 sm:text-base">
            Our chosen sanctuary — where forever begins
          </p>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14 lg:items-center">
          {/* Left: Visual */}
          <motion.div
            ref={imageRef}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={
              isImageInView
                ? { opacity: 1, scale: 1 }
                : { opacity: 0, scale: 0.97 }
            }
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="relative order-1 lg:order-1"
          >
            <div className="wewed-photo-frame relative aspect-[4/5] sm:aspect-[5/4] lg:aspect-[4/5] overflow-hidden rounded-2xl border-2 border-gold/30 shadow-xl">
              <Image
                src="/hero-wedding.png"
                alt="Imba Manor — a romantic estate in Harare, Zimbabwe"
                fill
                sizes="(min-width: 1024px) 50vw, (min-width: 640px) 80vw, 90vw"
                className="wewed-ken-burns object-cover"
                quality={85}
                priority={false}
              />
              {/* Subtle overlay for depth */}
              <div className="absolute inset-0 bg-gradient-to-t from-espresso/60 via-transparent to-transparent" />

              {/* Caption overlay */}
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <div className="flex items-center gap-3">
                  <span className="h-px w-8 bg-gold" />
                  <MapPin className="size-4 text-gold" strokeWidth={1.5} />
                  <span className="font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-champagne">
                    Imba Manor · Harare, Zimbabwe
                  </span>
                </div>
                <p className="mt-2 wewed-heading text-xl font-light text-champagne sm:text-2xl">
                  Where &lsquo;Imba&rsquo; means home
                </p>
              </div>

              {/* Decorative corner accents */}
              <span key="tl" className="pointer-events-none absolute left-4 top-4 h-8 w-8 border-l border-t border-gold/50" />
              <span key="tr" className="pointer-events-none absolute right-4 top-4 h-8 w-8 border-r border-t border-gold/50" />
              <span key="bl" className="pointer-events-none absolute left-4 bottom-4 h-8 w-8 border-l border-b border-gold/50" />
              <span key="br" className="pointer-events-none absolute right-4 bottom-4 h-8 w-8 border-r border-b border-gold/50" />
            </div>

            {/* Floating monogram badge */}
            <div className="absolute -right-3 -top-3 flex size-16 rotate-3 items-center justify-center rounded-full border border-gold/40 bg-champagne shadow-md sm:size-20">
              <div className="flex flex-col items-center">
                <span className="wewed-monogram text-[10px] leading-none sm:text-xs">
                  C&amp;K
                </span>
                <span className="mt-0.5 font-sans text-[7px] uppercase tracking-wider text-espresso/50 sm:text-[9px]">
                  23.12.26
                </span>
              </div>
            </div>
          </motion.div>

          {/* Right: Details */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="order-2 lg:order-2"
          >
            <Card className="border-gold/20 bg-champagne/60 backdrop-blur-sm">
              <CardContent className="p-6 sm:p-8 lg:p-10">
                <p className="mb-2 font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-gold-muted">
                  About the Venue
                </p>
                <h3 className="wewed-heading mb-5 text-2xl font-light text-espresso sm:text-3xl">
                  An estate where elegance meets African warmth
                </h3>
                <p className="mb-7 font-sans text-sm leading-relaxed text-espresso/70 sm:text-[0.95rem]">
                  Nestled in the heart of Harare&rsquo;s verdant Borrowdale
                  suburb, Imba Manor is an exclusive estate that blends colonial
                  elegance with African warmth. Its manicured gardens, sweeping
                  lawns, and timeless architecture provide the perfect canvas
                  for a celebration of love. The name &lsquo;Imba&rsquo; means{' '}
                  <em className="font-serif italic text-espresso/80">home</em>{' '}
                  in Shona — and on December 23, 2026, this place will become
                  the home of our forever.
                </p>

                {/* Features list */}
                <ul className="mb-8 grid gap-3 sm:grid-cols-1">
                  {VENUE_FEATURES.map((f, i) => (
                    <FeatureItem key={f} text={f} index={i} />
                  ))}
                </ul>

                {/* Buttons */}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    asChild
                    variant="outline"
                    className="flex-1 justify-center border-gold/40 bg-transparent font-sans text-xs uppercase tracking-[0.15em] text-espresso transition-all hover:bg-gold hover:text-espresso"
                  >
                    <a
                      href="https://www.google.com/search?q=Imba+Manor+Harare+Zimbabwe"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-3.5 w-3.5" />
                      Explore Imba Manor
                    </a>
                  </Button>
                  <Button
                    asChild
                    className="flex-1 justify-center bg-espresso font-sans text-xs uppercase tracking-[0.15em] text-champagne transition-all hover:bg-espresso/85"
                  >
                    <a
                      href="https://www.google.com/maps/search/Imba+Manor+Harare+Zimbabwe"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin className="mr-2 h-3.5 w-3.5" />
                      Get Directions
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Moment strip */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 sm:mt-20"
        >
          <div className="relative rounded-2xl border border-gold/20 bg-champagne/40 px-6 py-8 backdrop-blur-sm sm:px-10 sm:py-10">
            {/* Gold hairlines */}
            <span className="absolute left-1/2 top-0 h-px w-24 -translate-x-1/2 bg-gradient-to-r from-transparent via-gold to-transparent" />
            <span className="absolute left-1/2 bottom-0 h-px w-24 -translate-x-1/2 bg-gradient-to-r from-transparent via-gold to-transparent" />

            <p className="mb-8 text-center font-sans text-[11px] font-medium uppercase tracking-[0.25em] text-gold-muted">
              A Day of Moments
            </p>
            <div className="grid grid-cols-2 gap-6 sm:gap-8 md:grid-cols-4">
              {MOMENTS.map((m, i) => (
                <MomentVignette key={m.label} moment={m} index={i} />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
