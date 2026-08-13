'use client';

import { motion, type Variants } from 'framer-motion';
import Image from 'next/image';
import { Countdown } from '@/components/wedding/countdown';
import { InlineEditButton } from '@/components/wedding/inline-edit-button';
import { useInlineContent } from '@/lib/inline-content';
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider';
import {
  compactWeddingDate,
  weddingVenueLine,
} from '@/lib/wedding-template-defaults';

const EASE = [0.22, 1, 0.36, 1] as const;

const stagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.6,
    },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: EASE },
  },
};

export function HeroSection() {
  const ctx = useWeddingContextSafe();
  const wedding = ctx?.wedding;

  const defaultPartner1 = wedding?.couple.partner1 || 'Partner One';
  const defaultPartner2 = wedding?.couple.partner2 || 'Partner Two';
  const defaultDate = compactWeddingDate(wedding?.date) || 'Add your wedding date';
  const defaultVenue = weddingVenueLine(wedding);
  const defaultTagline = wedding?.tagline || 'Our wedding · our story · our people';

  const dbPartner1 = ctx?.getContent('hero', 'brideName', defaultPartner1) ?? defaultPartner1;
  const dbPartner2 = ctx?.getContent('hero', 'groomName', defaultPartner2) ?? defaultPartner2;
  const dbDate = ctx?.getContent('hero', 'date', defaultDate) ?? defaultDate;
  const dbVenue = ctx?.getContent('hero', 'venue', defaultVenue) ?? defaultVenue;
  const dbTagline = ctx?.getContent('hero', 'tagline', defaultTagline) ?? defaultTagline;
  const heroImageUrl = ctx?.getContent('hero', 'imageUrl', '') ?? '';

  const [nameOne] = useInlineContent('hero', 'brideName', dbPartner1);
  const [nameTwo] = useInlineContent('hero', 'groomName', dbPartner2);
  const [date] = useInlineContent('hero', 'date', dbDate);
  const [venue] = useInlineContent('hero', 'venue', dbVenue);
  const [tagline] = useInlineContent('hero', 'tagline', dbTagline);

  return (
    <section
      id="home"
      className="wewed-section relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-espresso via-plum to-clay"
    >
      <div className="absolute inset-0" aria-hidden="true">
        {heroImageUrl && (
          <Image
            src={heroImageUrl}
            alt=""
            fill
            unoptimized={heroImageUrl.startsWith('http')}
            sizes="100vw"
            className="object-cover object-center wewed-ken-burns"
            priority
            quality={90}
          />
        )}
        <div className="absolute inset-0 wewed-hero-sheen bg-[radial-gradient(ellipse_at_30%_30%,_rgba(216,188,126,0.10)_0%,_transparent_55%)]" />
        <div className="absolute inset-0 bg-espresso/70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(191,155,95,0.12)_0%,_transparent_70%)]" />
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent"
        aria-hidden="true"
      />

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex flex-col items-center px-4 text-center"
      >
        <motion.div variants={fadeUp} className="mb-8 flex items-center gap-3 sm:gap-4">
          <div className="h-px w-12 bg-gold/40 sm:w-20" />
          <span className="wewed-monogram text-xs">&#9670;</span>
          <div className="h-px w-12 bg-gold/40 sm:w-20" />
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="wewed-heading text-5xl font-light leading-tight text-champagne sm:text-7xl md:text-8xl lg:text-9xl"
        >
          <span className="flex items-center justify-center gap-2">
            <span>{nameOne}</span>
            <InlineEditButton
              section="hero"
              field="brideName"
              label="first partner's name"
              defaultValue={dbPartner1}
              size="md"
            />
          </span>
          <span className="block text-gold my-1">&amp;</span>
          <span className="flex items-center justify-center gap-2">
            <span>{nameTwo}</span>
            <InlineEditButton
              section="hero"
              field="groomName"
              label="second partner's name"
              defaultValue={dbPartner2}
              size="md"
            />
          </span>
        </motion.h1>

        <motion.div variants={fadeUp} className="mt-8 flex items-center gap-3 sm:gap-4">
          <div className="h-px w-12 bg-gold/40 sm:w-20" />
          <span className="wewed-monogram text-xs">&#9670;</span>
          <div className="h-px w-12 bg-gold/40 sm:w-20" />
        </motion.div>

        <motion.div variants={fadeUp} className="mt-5 flex items-center gap-2">
          <p className="wewed-monogram text-xl tracking-[0.3em] sm:text-3xl">{date}</p>
          <InlineEditButton
            section="hero"
            field="date"
            label="wedding date display"
            defaultValue={dbDate}
          />
        </motion.div>

        <motion.div variants={fadeUp} className="mt-3 flex items-center gap-2">
          <p className="font-sans text-sm font-light tracking-wider text-champagne/80 sm:text-base">{venue}</p>
          <InlineEditButton
            section="hero"
            field="venue"
            label="venue line"
            defaultValue={dbVenue}
          />
        </motion.div>

        <motion.div variants={fadeUp} className="mt-2 flex items-center gap-2">
          <p className="font-serif text-base font-light italic text-gold/80 sm:text-lg">{tagline}</p>
          <InlineEditButton
            section="hero"
            field="tagline"
            label="tagline"
            defaultValue={dbTagline}
          />
        </motion.div>

        <motion.div variants={fadeUp} className="mt-6 flex flex-col items-center gap-1 text-champagne/40">
          <span className="font-sans text-[10px] uppercase tracking-[0.2em]">Scroll to explore</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gold/40">
              <path d="M8 2L8 14M8 14L2 8M8 14L14 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.div>
        </motion.div>

        <motion.div variants={fadeUp} className="mt-10 sm:mt-14">
          <p className="wewed-monogram mb-4 text-xs uppercase tracking-[0.2em] text-gold/60">
            Counting the moments until forever
          </p>
          <Countdown />
        </motion.div>
      </motion.div>
    </section>
  );
}
