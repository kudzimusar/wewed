'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Plane, Heart, Gift, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SectionEyebrow } from '@/components/wedding/section-eyebrow';

type Accent = 'gold' | 'clay' | 'sage';

interface RegistryCard {
  icon: typeof Plane;
  title: string;
  description: string;
  accent: Accent;
  cta: string;
  meta: {
    label: string;
    raised: number;
    goal?: number;
    progress?: number;
  };
  href: string;
}

const CARDS: RegistryCard[] = [
  {
    icon: Plane,
    title: 'Honeymoon to Victoria Falls & Cape Town',
    description:
      'Help us start our forever with the adventure of a lifetime.',
    accent: 'gold',
    cta: 'Contribute',
    meta: {
      label: 'Raised so far',
      raised: 2340,
      goal: 5000,
      progress: 47,
    },
    href: '#rsvp',
  },
  {
    icon: Heart,
    title: 'Musarurwa Family Foundation',
    description:
      'Supporting education for children in rural Zimbabwe — a cause close to our hearts.',
    accent: 'clay',
    cta: 'Donate',
    meta: {
      label: 'Raised so far',
      raised: 1820,
    },
    href: '#rsvp',
  },
  {
    icon: Gift,
    title: 'Registry at Boardmans & Mr. Price Home',
    description:
      'For those who prefer to give a tangible gift for our home.',
    accent: 'sage',
    cta: 'View Registry',
    meta: {
      label: '',
      raised: 0,
    },
    href: 'https://www.boardmans.co.za',
  },
];

const ACCENT_STYLES: Record<
  Accent,
  {
    iconWrap: string;
    icon: string;
    progress: string;
    button: string;
    ring: string;
    amount: string;
  }
> = {
  gold: {
    iconWrap: 'bg-gold/10 border-gold/30',
    icon: 'text-gold',
    progress: '[&>[data-slot=progress-indicator]]:bg-gold',
    button:
      'border-gold/40 bg-gold/10 text-espresso hover:bg-gold hover:text-espresso',
    ring: 'group-hover:border-gold/50',
    amount: 'text-gold-muted',
  },
  clay: {
    iconWrap: 'bg-clay/10 border-clay/30',
    icon: 'text-clay',
    progress: '[&>[data-slot=progress-indicator]]:bg-clay',
    button:
      'border-clay/40 bg-clay/10 text-clay hover:bg-clay hover:text-champagne',
    ring: 'group-hover:border-clay/50',
    amount: 'text-clay',
  },
  sage: {
    iconWrap: 'bg-sage/10 border-sage/30',
    icon: 'text-sage',
    progress: '[&>[data-slot=progress-indicator]]:bg-sage',
    button:
      'border-sage/40 bg-sage/10 text-sage hover:bg-sage hover:text-champagne',
    ring: 'group-hover:border-sage/50',
    amount: 'text-sage',
  },
};

function RegistryCardItem({
  card,
  index,
}: {
  card: RegistryCard;
  index: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const Icon = card.icon;
  const styles = ACCENT_STYLES[card.accent];
  const isExternal = card.href.startsWith('http');

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
        delay: 0.15 * index,
      }}
      className="h-full"
    >
      <Card
        className={`group h-full border-gold/25 bg-champagne shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${styles.ring}`}
      >
        <CardContent className="flex h-full flex-col p-6 sm:p-8">
          {/* Icon */}
          <div className="mb-6 flex items-start justify-between">
            <span
              className={`flex size-14 items-center justify-center rounded-full border ${styles.iconWrap} transition-transform duration-300 group-hover:scale-105`}
            >
              <Icon className={`size-6 ${styles.icon}`} strokeWidth={1.25} />
            </span>
            {card.meta.goal && (
              <span className="rounded-full border border-gold/20 bg-ivory/70 px-3 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.15em] text-gold-muted">
                {card.meta.progress}% Funded
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="wewed-heading mb-3 text-xl font-light leading-snug text-espresso sm:text-2xl">
            {card.title}
          </h3>

          {/* Description */}
          <p className="mb-6 font-sans text-sm leading-relaxed text-espresso/65">
            {card.description}
          </p>

          {/* Progress / Amount */}
          {card.meta.goal ? (
            <div className="mb-6 mt-auto space-y-2.5">
              <div className="flex items-baseline justify-between">
                <span className="font-sans text-[11px] font-medium uppercase tracking-wider text-espresso/50">
                  {card.meta.label}
                </span>
                <span className="font-sans text-[11px] text-espresso/45">
                  of ${card.meta.goal.toLocaleString()}
                </span>
              </div>
              <Progress
                value={card.meta.progress}
                className={`h-1.5 bg-gold/15 ${styles.progress}`}
              />
              <div className="flex items-baseline gap-2">
                <span
                  className={`font-serif text-2xl font-light tabular-nums ${styles.amount}`}
                >
                  ${card.meta.raised.toLocaleString()}
                </span>
                <span className="font-sans text-xs text-espresso/45">raised</span>
              </div>
            </div>
          ) : (
            <div className="mb-6 mt-auto">
              <p className="font-sans text-[11px] font-medium uppercase tracking-wider text-espresso/50">
                {card.meta.label || 'Available at'}
              </p>
              <p className="mt-1 font-sans text-sm italic text-espresso/55">
                Curated homeware &amp; timeless pieces
              </p>
            </div>
          )}

          {/* CTA */}
          <Button
            asChild
            variant="outline"
            className={`w-full justify-center border font-sans text-xs uppercase tracking-[0.15em] transition-all duration-300 ${styles.button}`}
          >
            <a
              href={card.href}
              {...(isExternal
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              {card.cta}
              <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function GiftRegistry() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section id="registry" className="wewed-section bg-champagne py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <motion.div
          ref={sectionRef}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-14 text-center md:mb-20"
        >
          <SectionEyebrow>With Appreciation</SectionEyebrow>
          <h2 className="wewed-heading wewed-heading-accent text-3xl font-light text-espresso sm:text-4xl md:text-5xl">
            With Gratitude
          </h2>
          <p className="mx-auto mt-6 max-w-2xl font-sans text-sm tracking-wide text-espresso/60 sm:text-base">
            Your presence is the greatest gift. For those who wish to give
            more, here are a few ways.
          </p>
        </motion.div>

        {/* Cards grid */}
        <div className="grid gap-6 md:gap-8 md:grid-cols-3">
          {CARDS.map((card, i) => (
            <RegistryCardItem key={card.title} card={card} index={i} />
          ))}
        </div>

        {/* Cultural note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 text-center"
        >
          <div className="mx-auto flex max-w-2xl items-center justify-center gap-4">
            <span className="hidden h-px w-12 bg-gradient-to-r from-transparent to-gold/40 sm:block" />
            <p className="font-serif text-base italic leading-relaxed text-espresso/70 sm:text-lg">
              &ldquo;In Shona tradition, it is customary to bring a small gift
              for the families. This is entirely optional — your presence is
              what truly matters.&rdquo;
            </p>
            <span className="hidden h-px w-12 bg-gradient-to-l from-transparent to-gold/40 sm:block" />
          </div>
          <p className="mt-6 wewed-monogram text-xs">C&amp;K &middot; 23.12.26</p>
        </motion.div>
      </div>
    </section>
  );
}
