'use client';

import { useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Check,
  X,
  Sparkles,
  Crown,
  Gift,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { GoldOrnament } from '@/components/wedding/decorative-elements';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type TierId = 'free' | 'canon' | 'forever';

interface Feature {
  label: string;
  included: boolean;
}

interface Tier {
  id: TierId;
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  features: Feature[];
  cta: string;
  icon: typeof Sparkles;
}

/* ─── Data ───────────────────────────────────────────────────────────────── */

const TIERS: Tier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    tagline: 'For couples who want to share their joy with the world',
    cta: 'Start Free',
    icon: Gift,
    features: [
      { label: 'Public wedding page', included: true },
      { label: 'Custom URL (wewed.app/your-names)', included: true },
      { label: 'RSVP + songbook + live wall', included: true },
      { label: '1 year of AFTER preservation', included: true },
      { label: 'Mobile PWA', included: true },
      { label: 'Private vault', included: false },
      { label: 'Wedding planner', included: false },
      { label: 'Vendor marketplace', included: false },
    ],
  },
  {
    id: 'canon',
    name: 'Canon',
    price: '$9',
    cadence: 'per month',
    tagline: 'For couples who want their wedding sealed in the vault, forever',
    cta: 'Choose Canon',
    icon: Crown,
    features: [
      { label: 'Everything in Free', included: true },
      { label: 'Private or link-only vault', included: true },
      { label: 'Forever preservation (Canon Seal)', included: true },
      { label: 'Basic wedding planner (checklist + budget)', included: true },
      { label: 'Custom domain support', included: true },
      { label: '50GB photo/video storage', included: true },
      { label: 'Full planner suite', included: false },
      { label: 'Vendor marketplace', included: false },
    ],
  },
  {
    id: 'forever',
    name: 'Forever',
    price: '$29',
    cadence: 'per month',
    tagline: 'The complete wewed ecosystem — plan, celebrate, and preserve',
    cta: 'Choose Forever',
    icon: Sparkles,
    features: [
      { label: 'Everything in Canon', included: true },
      {
        label:
          'Full wedding planner (checklist, budget, guests, timeline, seating)',
        included: true,
      },
      { label: 'Vendor marketplace listing', included: true },
      { label: 'Merch store integration', included: true },
      { label: 'Unlimited storage', included: true },
      { label: 'Priority support', included: true },
      { label: 'Custom themes & branding', included: true },
    ],
  },
];

/* Visual config per tier — drives background, border, text, button styling */
const TIER_STYLES: Record<
  TierId,
  {
    card: string;
    heading: string;
    price: string;
    cadence: string;
    tagline: string;
    button: string;
    featureIncluded: string;
    featureExcluded: string;
    iconWrap: string;
  }
> = {
  free: {
    card: 'bg-champagne border-gold/40',
    heading: 'text-espresso',
    price: 'text-espresso',
    cadence: 'text-espresso/60',
    tagline: 'text-espresso/70',
    button:
      'border-gold/50 bg-transparent text-espresso hover:bg-gold hover:text-espresso',
    featureIncluded: 'text-espresso/80',
    featureExcluded: 'text-espresso/35',
    iconWrap: 'bg-gold/15 text-gold border-gold/30',
  },
  canon: {
    card: 'bg-espresso border-gold text-champagne',
    heading: 'text-champagne',
    price: 'text-gold-light',
    cadence: 'text-champagne/60',
    tagline: 'text-champagne/75',
    button:
      'bg-gold text-espresso hover:bg-gold-light hover:text-espresso shadow-lg shadow-gold/20',
    featureIncluded: 'text-champagne/90',
    featureExcluded: 'text-champagne/30',
    iconWrap: 'bg-gold/20 text-gold-light border-gold/50',
  },
  forever: {
    card: 'bg-plum border-gold text-champagne',
    heading: 'text-champagne',
    price: 'text-gold-light',
    cadence: 'text-champagne/60',
    tagline: 'text-champagne/80',
    button:
      'bg-plum text-gold-light border border-gold/60 hover:bg-plum-light hover:text-gold-light',
    featureIncluded: 'text-champagne/90',
    featureExcluded: 'text-champagne/30',
    iconWrap: 'bg-gold/15 text-gold-light border-gold/40',
  },
};

/* ─── Full feature matrix for the compare accordion ──────────────────────── */

interface MatrixRow {
  category: string;
  features: { label: string; free: boolean; canon: boolean; forever: boolean }[];
}

const FEATURE_MATRIX: MatrixRow[] = [
  {
    category: 'The Forever Page',
    features: [
      { label: 'Public wedding page', free: true, canon: true, forever: true },
      {
        label: 'Custom URL (wewed.app/your-names)',
        free: true,
        canon: true,
        forever: true,
      },
      {
        label: 'BEFORE | AFTER lifecycle switch',
        free: true,
        canon: true,
        forever: true,
      },
      {
        label: 'Custom domain (yourname.com)',
        free: false,
        canon: true,
        forever: true,
      },
      {
        label: 'Custom themes & branding',
        free: false,
        canon: false,
        forever: true,
      },
    ],
  },
  {
    category: 'Guests & RSVP',
    features: [
      {
        label: 'RSVP with QR token check-in',
        free: true,
        canon: true,
        forever: true,
      },
      {
        label: 'Songbook with live voting',
        free: true,
        canon: true,
        forever: true,
      },
      {
        label: 'Live photo wall',
        free: true,
        canon: true,
        forever: true,
      },
      {
        label: 'Memory time capsule',
        free: true,
        canon: true,
        forever: true,
      },
    ],
  },
  {
    category: 'The Vault',
    features: [
      {
        label: '1 year of AFTER preservation',
        free: true,
        canon: true,
        forever: true,
      },
      {
        label: 'Forever preservation (Canon Seal)',
        free: false,
        canon: true,
        forever: true,
      },
      {
        label: 'Private or link-only vault',
        free: false,
        canon: true,
        forever: true,
      },
      {
        label: '50GB photo/video storage',
        free: false,
        canon: true,
        forever: true,
      },
      {
        label: 'Unlimited storage',
        free: false,
        canon: false,
        forever: true,
      },
    ],
  },
  {
    category: 'Wedding Planner',
    features: [
      {
        label: 'Checklist + budget (basic)',
        free: false,
        canon: true,
        forever: true,
      },
      {
        label: 'Guest list management',
        free: false,
        canon: false,
        forever: true,
      },
      {
        label: 'Timeline & day-of schedule',
        free: false,
        canon: false,
        forever: true,
      },
      {
        label: 'Seating chart builder',
        free: false,
        canon: false,
        forever: true,
      },
    ],
  },
  {
    category: 'Marketplace & Commerce',
    features: [
      {
        label: 'Vendor marketplace listing',
        free: false,
        canon: false,
        forever: true,
      },
      {
        label: 'Merch store integration',
        free: false,
        canon: false,
        forever: true,
      },
    ],
  },
  {
    category: 'Support',
    features: [
      { label: 'Community support', free: true, canon: true, forever: true },
      { label: 'Email support', free: false, canon: true, forever: true },
      {
        label: 'Priority support (24h)',
        free: false,
        canon: false,
        forever: true,
      },
    ],
  },
];

/* ─── Easing & motion variants ───────────────────────────────────────────── */

const EASING = [0.22, 1, 0.36, 1] as const;

/* ─── Tier card ──────────────────────────────────────────────────────────── */

function TierCard({ tier, index }: { tier: Tier; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  const styles = TIER_STYLES[tier.id];
  const Icon = tier.icon;
  const isFeatured = tier.id === 'canon';

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, ease: EASING, delay: 0.12 * index }}
      className={`relative h-full ${isFeatured ? 'lg:-translate-y-4' : ''}`}
    >
      {/* "Most Popular" ribbon for the featured tier */}
      {isFeatured && (
        <div className="absolute -top-3 left-1/2 z-20 -translate-x-1/2">
          <div className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-espresso shadow-lg shadow-gold/30">
            <Sparkles className="h-3 w-3" />
            Most Popular
          </div>
        </div>
      )}

      <Card
        className={`relative h-full overflow-hidden border-2 shadow-sm transition-all duration-300 hover:shadow-2xl ${
          styles.card
        } ${isFeatured ? 'shadow-xl shadow-espresso/20 lg:scale-[1.03]' : ''}`}
      >
        {/* Subtle radial glow for featured */}
        {isFeatured && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                'radial-gradient(circle at 50% 0%, rgba(191,155,95,0.18), transparent 60%)',
            }}
          />
        )}

        <CardContent className="relative flex h-full flex-col p-6 md:p-8">
          {/* Icon + tier name */}
          <div className="mb-5 flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-full border ${styles.iconWrap}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <h3
              className={`wewed-heading text-3xl md:text-4xl ${styles.heading}`}
            >
              {tier.name}
            </h3>
          </div>

          {/* Price */}
          <div className="mb-2 flex items-baseline gap-2">
            <span
              className={`font-serif text-5xl leading-none ${styles.price}`}
            >
              {tier.price}
            </span>
            <span
              className={`text-sm font-medium tracking-wide ${styles.cadence}`}
            >
              {tier.cadence}
            </span>
          </div>

          {/* Tagline */}
          <p className={`mb-6 text-sm italic leading-relaxed ${styles.tagline}`}>
            {tier.tagline}
          </p>

          {/* Hairline separator */}
          <div
            aria-hidden="true"
            className={`mb-6 h-px w-full ${
              isFeatured
                ? 'bg-gradient-to-r from-transparent via-gold/60 to-transparent'
                : 'bg-gradient-to-r from-transparent via-gold/40 to-transparent'
            }`}
          />

          {/* Feature list */}
          <ul className="mb-7 space-y-3">
            {tier.features.map((feature) => (
              <li key={feature.label} className="flex items-start gap-2.5">
                {feature.included ? (
                  <Check
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      isFeatured ? 'text-gold' : 'text-gold'
                    }`}
                  />
                ) : (
                  <X
                    className={`mt-0.5 h-4 w-4 shrink-0 ${styles.featureExcluded}`}
                  />
                )}
                <span
                  className={`text-sm leading-snug ${
                    feature.included
                      ? styles.featureIncluded
                      : styles.featureExcluded
                  } ${feature.included ? '' : 'line-through'}`}
                >
                  {feature.label}
                </span>
              </li>
            ))}
          </ul>

          {/* CTA button — pinned to bottom for alignment */}
          <div className="mt-auto">
            <Button
              className={`w-full rounded-full py-3 text-sm font-semibold uppercase tracking-[0.12em] ${styles.button}`}
            >
              {tier.cta}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Feature matrix row (for accordion) ─────────────────────────────────── */

function MatrixCell({ value }: { value: boolean }) {
  return value ? (
    <Check className="mx-auto h-4 w-4 text-gold" />
  ) : (
    <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
  );
}

function MatrixCategory({ row }: { row: MatrixRow }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] border-collapse text-left">
        <thead>
          <tr className="border-b border-gold/20">
            <th className="py-3 pr-4 text-xs font-semibold uppercase tracking-[0.14em] text-espresso/70">
              {row.category}
            </th>
            <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-espresso/70">
              Free
            </th>
            <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-espresso/70">
              Canon
            </th>
            <th className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-espresso/70">
              Forever
            </th>
          </tr>
        </thead>
        <tbody>
          {row.features.map((feature) => (
            <tr
              key={feature.label}
              className="border-b border-border/60 last:border-b-0"
            >
              <td className="py-3 pr-4 text-sm text-espresso/85">
                {feature.label}
              </td>
              <td className="px-2 py-3 text-center">
                <MatrixCell value={feature.free} />
              </td>
              <td className="px-2 py-3 text-center">
                <MatrixCell value={feature.canon} />
              </td>
              <td className="px-2 py-3 text-center">
                <MatrixCell value={feature.forever} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Main pricing section ───────────────────────────────────────────────── */

export function PricingSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [compareOpen, setCompareOpen] = useState<string | undefined>();

  return (
    <section
      id="pricing"
      className="wewed-section relative bg-ivory py-20 md:py-32"
    >
      {/* Soft decorative backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, #BF9B5F 1px, transparent 1px), radial-gradient(circle at 80% 70%, #6B2D3A 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 md:px-8">
        {/* Section heading */}
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
            Pricing
          </p>
          <h2 className="wewed-heading text-4xl text-espresso md:text-5xl lg:text-6xl">
            Your Forever, Preserved
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-espresso/70 md:text-lg">
            Every love story deserves to live on. Choose how wewed preserves
            yours.
          </p>
        </motion.div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8 lg:items-stretch">
          {TIERS.map((tier, i) => (
            <TierCard key={tier.id} tier={tier} index={i} />
          ))}
        </div>

        {/* Note row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8, ease: EASING, delay: 0.4 }}
          className="mx-auto mt-10 max-w-3xl text-center md:mt-12"
        >
          <p className="text-sm leading-relaxed text-espresso/65 md:text-base">
            All plans include the{' '}
            <span className="font-semibold text-espresso">BEFORE | AFTER</span>{' '}
            experience. Cancel anytime. Zimbabwean couples get{' '}
            <span className="font-semibold text-clay">20% off</span> with code{' '}
            <span className="rounded-md border border-gold/40 bg-champagne px-2 py-0.5 font-mono text-xs font-semibold tracking-wider text-espresso">
              ZIMBABWE2026
            </span>
            .
          </p>
        </motion.div>

        {/* Compare features accordion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.7, ease: EASING, delay: 0.5 }}
          className="mx-auto mt-14 max-w-4xl"
        >
          <Accordion
            type="single"
            collapsible
            value={compareOpen}
            onValueChange={setCompareOpen}
            className="rounded-2xl border border-gold/30 bg-champagne/60 px-5 py-2 shadow-sm backdrop-blur-sm md:px-8"
          >
            <AccordionItem value="compare" className="border-b-0">
              <AccordionTrigger className="py-5 text-left hover:no-underline">
                <div className="flex items-center gap-3">
                  <ChevronDown
                    className={`h-5 w-5 text-gold transition-transform duration-300 ${
                      compareOpen ? 'rotate-180' : ''
                    }`}
                  />
                  <span className="wewed-heading text-xl text-espresso md:text-2xl">
                    Compare Features
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <div className="space-y-6">
                  {FEATURE_MATRIX.map((row) => (
                    <MatrixCategory key={row.category} row={row} />
                  ))}
                </div>

                <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-gold/20 pt-5 sm:flex-row">
                  <p className="text-xs text-espresso/55">
                    Every wewed plan comes with our forever guarantee — your
                    love story, preserved.
                  </p>
                  <a
                    href="#contact"
                    className="group inline-flex items-center gap-1.5 text-sm font-semibold text-plum transition-colors hover:text-clay"
                  >
                    Talk to us
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </a>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </motion.div>

        {/* Enterprise / custom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.7, ease: EASING, delay: 0.6 }}
          className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-4 rounded-2xl border border-gold/20 bg-gradient-to-br from-champagne to-ivory px-6 py-7 text-center shadow-sm sm:flex-row sm:text-left md:mt-12"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
            <Crown className="h-5 w-5 text-gold" />
          </div>
          <div className="flex-1">
            <h3 className="wewed-heading text-xl text-espresso">
              Planning something bigger?
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-espresso/65">
              For multi-day celebrations, cultural collaborations, or custom
              Forever Pages — let&apos;s craft something together.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="shrink-0 rounded-full border-gold/50 text-espresso hover:bg-gold hover:text-espresso"
          >
            <a href="#contact">Talk to us</a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

export default PricingSection;
