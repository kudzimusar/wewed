'use client';

import { motion, type Variants } from 'framer-motion';
import Image from 'next/image';
import { Countdown } from '@/components/wedding/countdown';
import { InlineEditButton } from '@/components/wedding/inline-edit-button';
import { useInlineContent } from '@/lib/inline-content';
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider';

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
  // Read from wedding data context (multi-couple).
  // Fall back to inline content (localStorage edits), then hardcoded defaults.
  // The try/catch handles the case where the provider isn't wrapped.
  const ctx = useWeddingContextSafe();

  const dbBride = ctx?.getContent('hero', 'brideName', 'Charity') ?? 'Charity';
  const dbGroom = ctx?.getContent('hero', 'groomName', 'Kudzie') ?? 'Kudzie';
  const dbDate = ctx?.getContent('hero', 'date', '23 · 12 · 26') ?? '23 · 12 · 26';
  const dbVenue = ctx?.getContent('hero', 'venue', 'Imba Manor · Harare, Zimbabwe') ?? 'Imba Manor · Harare, Zimbabwe';
  const dbTagline = ctx?.getContent('hero', 'tagline', 'Mr & Mrs Musarurwa') ?? 'Mr & Mrs Musarurwa';

  // Inline-editable overrides (localStorage). Edits take priority over DB content.
  const [nameOne] = useInlineContent('hero', 'name-one', dbBride);
  const [nameTwo] = useInlineContent('hero', 'name-two', dbGroom);
  const [date] = useInlineContent('hero', 'date', dbDate);
  const [venue] = useInlineContent('hero', 'venue', dbVenue);
  const [tagline] = useInlineContent('hero', 'tagline', dbTagline);

  return (
    <section
      id="home"
      className="wewed-section relative flex min-h-screen flex-col items-center justify-center overflow-hidden"
    >
      {/* Background image with overlay */}
      <div className="absolute inset-0" aria-hidden="true">
        <Image
          src="/hero-wedding.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center wewed-ken-burns"
          priority
          quality={90}
        />
        {/* Parallax sheen layer — drifts slowly opposite to ken-burns for depth */}
        <div
          className="absolute inset-0 wewed-hero-sheen bg-[radial-gradient(ellipse_at_30%_30%,_rgba(216,188,126,0.10)_0%,_transparent_55%)]"
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-espresso/70" />
        {/* Radial gradient glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(191,155,95,0.12)_0%,_transparent_70%)]" />
      </div>

      {/* Bottom gradient fade into next section */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent"
        aria-hidden="true"
      />

      {/* Content */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex flex-col items-center px-4 text-center"
      >
        {/* Top ornamental divider */}
        <motion.div variants={fadeUp} className="mb-8 flex items-center gap-3 sm:gap-4">
          <div className="h-px w-12 bg-gold/40 sm:w-20" />
          <span className="wewed-monogram text-xs">&#9670;</span>
          <div className="h-px w-12 bg-gold/40 sm:w-20" />
        </motion.div>

        {/* Names */}
        <motion.h1
          variants={fadeUp}
          className="wewed-heading text-5xl font-light leading-tight text-champagne sm:text-7xl md:text-8xl lg:text-9xl"
        >
          <span className="flex items-center justify-center gap-2">
            <span>{nameOne}</span>
            <InlineEditButton
              section="hero"
              field="name-one"
              label="bride's name"
              defaultValue={dbBride}
              size="md"
            />
          </span>
          <span className="block text-gold my-1">&amp;</span>
          <span className="flex items-center justify-center gap-2">
            <span>{nameTwo}</span>
            <InlineEditButton
              section="hero"
              field="name-two"
              label="groom's name"
              defaultValue={dbGroom}
              size="md"
            />
          </span>
        </motion.h1>

        {/* Bottom ornamental divider */}
        <motion.div variants={fadeUp} className="mt-8 flex items-center gap-3 sm:gap-4">
          <div className="h-px w-12 bg-gold/40 sm:w-20" />
          <span className="wewed-monogram text-xs">&#9670;</span>
          <div className="h-px w-12 bg-gold/40 sm:w-20" />
        </motion.div>

        {/* Date in monogram style */}
        <motion.div
          variants={fadeUp}
          className="mt-5 flex items-center gap-2"
        >
          <p className="wewed-monogram text-xl tracking-[0.3em] sm:text-3xl">
            {date}
          </p>
          <InlineEditButton
            section="hero"
            field="date"
            label="wedding date"
            defaultValue={dbDate}
          />
        </motion.div>

        {/* Venue */}
        <motion.div
          variants={fadeUp}
          className="mt-3 flex items-center gap-2"
        >
          <p className="font-sans text-sm font-light tracking-wider text-champagne/80 sm:text-base">
            {venue}
          </p>
          <InlineEditButton
            section="hero"
            field="venue"
            label="venue line"
            defaultValue={dbVenue}
          />
        </motion.div>

        {/* Tagline */}
        <motion.div
          variants={fadeUp}
          className="mt-2 flex items-center gap-2"
        >
          <p className="font-serif text-base font-light italic text-gold/80 sm:text-lg">
            {tagline}
          </p>
          <InlineEditButton
            section="hero"
            field="tagline"
            label="tagline"
            defaultValue={dbTagline}
          />
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          variants={fadeUp}
          className="mt-6 flex flex-col items-center gap-1 text-champagne/40"
        >
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

        {/* Countdown */}
        <motion.div variants={fadeUp} className="mt-10 sm:mt-14">
          <p className="wewed-monogram mb-4 text-xs tracking-[0.2em] text-gold/60 uppercase">
            Counting the moments until forever
          </p>
          <Countdown />
        </motion.div>
      </motion.div>
    </section>
  );
}
