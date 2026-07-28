'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Heart, ClipboardList, Shield, ArrowRight, Globe2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GoldOrnament } from '@/components/wedding/decorative-elements';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type PillarId = 'celebrate' | 'plan' | 'preserve';

interface Pillar {
  id: PillarId;
  title: string;
  body: string;
  icon: typeof Heart;
  accent: 'clay' | 'sage' | 'plum';
}

interface Stat {
  value: string;
  label: string;
}

/* ─── Data ───────────────────────────────────────────────────────────────── */

const PILLARS: Pillar[] = [
  {
    id: 'celebrate',
    title: 'Celebrate',
    icon: Heart,
    accent: 'clay',
    body: 'Every couple gets a Forever Page — a permanent URL where their story lives on, before and after the day.',
  },
  {
    id: 'plan',
    title: 'Plan',
    icon: ClipboardList,
    accent: 'sage',
    body: 'A full wedding planner hidden behind the scenes. Checklist, budget, vendors, guests — built for Zimbabwean weddings, useful everywhere.',
  },
  {
    id: 'preserve',
    title: 'Preserve',
    icon: Shield,
    accent: 'plum',
    body: 'The Canon vault seals your wedding forever. Photos, videos, messages, songs — never lost, always yours.',
  },
];

const STATS: Stat[] = [
  { value: '1', label: 'flagship wedding' },
  { value: '8', label: 'bridal party profiles' },
  { value: '26', label: 'songs' },
  { value: '47', label: 'messages in the capsule' },
  { value: '∞', label: 'forever preserved' },
];

/* Accent visual mapping — plum/sage primary, with clay for celebrate pillar */
const ACCENT_STYLES: Record<
  Pillar['accent'],
  {
    iconWrap: string;
    icon: string;
    ring: string;
    number: string;
    border: string;
    glow: string;
  }
> = {
  clay: {
    iconWrap: 'bg-clay/12 border-clay/30',
    icon: 'text-clay',
    ring: 'group-hover:border-clay/50',
    number: 'text-clay/30',
    border: 'from-clay/0 via-clay/40 to-clay/0',
    glow: 'group-hover:shadow-clay/10',
  },
  sage: {
    iconWrap: 'bg-sage/12 border-sage/30',
    icon: 'text-sage',
    ring: 'group-hover:border-sage/50',
    number: 'text-sage/30',
    border: 'from-sage/0 via-sage/40 to-sage/0',
    glow: 'group-hover:shadow-sage/10',
  },
  plum: {
    iconWrap: 'bg-plum/12 border-plum/30',
    icon: 'text-plum',
    ring: 'group-hover:border-plum/50',
    number: 'text-plum/25',
    border: 'from-plum/0 via-plum/40 to-plum/0',
    glow: 'group-hover:shadow-plum/10',
  },
};

const EASING = [0.22, 1, 0.36, 1] as const;

/* ─── Pillar card ────────────────────────────────────────────────────────── */

function PillarCard({ pillar, index }: { pillar: Pillar; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  const Icon = pillar.icon;
  const styles = ACCENT_STYLES[pillar.accent];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 36 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 36 }}
      transition={{ duration: 0.7, ease: EASING, delay: 0.15 * index }}
      className="h-full"
    >
      <Card
        className={`group relative h-full overflow-hidden border bg-champagne/70 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl ${styles.ring} ${styles.glow} border-gold/20`}
      >
        {/* Faded oversized number watermark */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute right-5 top-2 font-serif text-7xl leading-none opacity-60 ${styles.number}`}
        >
          0{index + 1}
        </span>

        {/* Top accent hairline */}
        <div
          aria-hidden="true"
          className={`h-px w-full bg-gradient-to-r ${styles.border}`}
        />

        <CardContent className="relative flex h-full flex-col p-7 md:p-8">
          <div
            className={`mb-5 flex h-14 w-14 items-center justify-center rounded-full border ${styles.iconWrap}`}
          >
            <Icon className="h-6 w-6" />
          </div>

          <h3 className="wewed-heading mb-3 text-2xl text-espresso md:text-3xl">
            {pillar.title}
          </h3>

          <p className="text-sm leading-relaxed text-espresso/75 md:text-[15px]">
            {pillar.body}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Stat ───────────────────────────────────────────────────────────────── */

function StatItem({ stat, index }: { stat: Stat; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, ease: EASING, delay: 0.08 * index }}
      className="flex flex-col items-center px-3 text-center"
    >
      <span className="font-serif text-3xl leading-none text-plum md:text-4xl lg:text-5xl">
        {stat.value}
      </span>
      <span className="mt-2 text-xs uppercase tracking-[0.18em] text-espresso/60 md:text-[11px]">
        {stat.label}
      </span>
    </motion.div>
  );
}

/* ─── Main platform vision section ───────────────────────────────────────── */

export function PlatformVision() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const missionRef = useRef(null);
  const missionInView = useInView(missionRef, { once: true, margin: '-80px' });

  return (
    <section
      id="vision"
      className="wewed-section relative overflow-hidden bg-espresso py-20 text-champagne md:py-32"
    >
      {/* Atmospheric background layers */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 15% 20%, rgba(107,45,58,0.30), transparent 45%), radial-gradient(circle at 85% 80%, rgba(124,122,82,0.22), transparent 45%), radial-gradient(circle at 50% 50%, rgba(191,155,95,0.10), transparent 60%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 30% 30%, #FBF6EE 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 md:px-8">
        {/* Heading */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.8, ease: EASING }}
          className="mx-auto mb-14 max-w-3xl text-center md:mb-20"
        >
          <div className="mb-4 flex justify-center">
            <GoldOrnament className="w-full max-w-[180px]" />
          </div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-gold-muted">
            Our Mission
          </p>
          <h2 className="wewed-heading text-4xl text-champagne md:text-5xl lg:text-6xl">
            More Than a Wedding Website
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-champagne/70 md:text-lg">
            wewed is building the forever layer for love — in Zimbabwe, and
            across the world.
          </p>
        </motion.div>

        {/* Pillars */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-7 lg:items-stretch">
          {PILLARS.map((pillar, i) => (
            <PillarCard key={pillar.id} pillar={pillar} index={i} />
          ))}
        </div>

        {/* Mission statement block */}
        <motion.div
          ref={missionRef}
          initial={{ opacity: 0, y: 30 }}
          animate={
            missionInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }
          }
          transition={{ duration: 0.8, ease: EASING, delay: 0.1 }}
          className="mx-auto mt-16 max-w-4xl md:mt-24"
        >
          <div className="relative overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-plum/25 via-espresso to-espresso p-8 md:p-12 lg:p-16">
            {/* Decorative seal-ish circle */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full"
              style={{
                background:
                  'radial-gradient(circle, rgba(191,155,95,0.18), transparent 65%)',
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full"
              style={{
                background:
                  'radial-gradient(circle, rgba(107,45,58,0.25), transparent 65%)',
              }}
            />

            <div className="relative">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-px w-10 bg-gold/60" />
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">
                  Our Mission
                </span>
              </div>
              <p className="wewed-heading text-2xl leading-relaxed text-champagne md:text-3xl lg:text-4xl lg:leading-relaxed">
                We believe every love story deserves to be remembered. wewed is
                building the{' '}
                <span className="text-gold-light">infrastructure for memory</span>{' '}
                — starting with{' '}
                <span className="italic text-clay-light">
                  Charity &amp; Kudzie
                </span>
                , and growing to every couple who wants their forever preserved.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={missionInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.7, ease: EASING, delay: 0.3 }}
          className="mx-auto mt-12 max-w-4xl md:mt-16"
        >
          <div className="rounded-2xl border border-gold/20 bg-champagne/5 px-6 py-8 backdrop-blur-sm md:px-10 md:py-10">
            <p className="mb-7 text-center text-xs font-semibold uppercase tracking-[0.28em] text-gold-muted">
              The flagship wedding, in numbers
            </p>
            <div className="grid grid-cols-2 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-y-0">
              {STATS.map((stat, i) => (
                <StatItem key={stat.label} stat={stat} index={i} />
              ))}
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={missionInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.7, ease: EASING, delay: 0.4 }}
          className="mt-12 flex flex-col items-center gap-4 md:mt-16"
        >
          <p className="text-sm text-champagne/70">
            Hundreds of couples will follow. Yours could be next.
          </p>
          <Button
            asChild
            className="group rounded-full border border-gold bg-gold px-8 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-espresso transition-all hover:bg-gold-light hover:text-espresso hover:shadow-lg hover:shadow-gold/30"
          >
            <a href="#contact">
              <Globe2 className="h-4 w-4" />
              Join the wewed family
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

export default PlatformVision;
