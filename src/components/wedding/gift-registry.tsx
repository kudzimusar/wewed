'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Plane, Heart, Gift, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SectionEyebrow } from '@/components/wedding/section-eyebrow';
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider';
import { compactWeddingDate, coupleNames } from '@/lib/wedding-template-defaults';

type Accent = 'gold' | 'clay' | 'sage';
type RegistryIcon = 'plane' | 'heart' | 'gift';

interface RegistryCard {
  icon: RegistryIcon;
  title: string;
  description: string;
  accent: Accent;
  cta: string;
  meta: {
    label: string;
    raised: number;
    goal?: number;
    progress?: number;
    detail?: string;
  };
  href: string;
}

const STARTER_CARDS: RegistryCard[] = [
  {
    icon: 'plane',
    title: 'Example Honeymoon Fund',
    description: 'Replace this with a honeymoon, future-home or experience fund if you would like one.',
    accent: 'gold',
    cta: 'Gift details',
    meta: { label: 'Example only', raised: 0, detail: 'Replace this example with your own gifting details.' },
    href: '#rsvp',
  },
  {
    icon: 'heart',
    title: 'Example Cause We Love',
    description: 'Add an optional charity or community cause that guests may support in your honour.',
    accent: 'clay',
    cta: 'Learn more',
    meta: { label: 'Example only', raised: 0, detail: 'This optional card can be removed or replaced.' },
    href: '#rsvp',
  },
  {
    icon: 'gift',
    title: 'Example Home Registry',
    description: 'Add your preferred registry provider, shop, wish list or a note that no gifts are needed.',
    accent: 'sage',
    cta: 'Registry details',
    meta: { label: 'Available at', raised: 0, detail: 'Add your preferred registry or homeware provider.' },
    href: '#rsvp',
  },
];

const ICONS = { plane: Plane, heart: Heart, gift: Gift } as const;

const ACCENT_STYLES: Record<Accent, { iconWrap: string; icon: string; progress: string; button: string; ring: string; amount: string }> = {
  gold: {
    iconWrap: 'bg-gold/10 border-gold/30',
    icon: 'text-gold',
    progress: '[&>[data-slot=progress-indicator]]:bg-gold',
    button: 'border-gold/40 bg-gold/10 text-espresso hover:bg-gold hover:text-espresso',
    ring: 'group-hover:border-gold/50',
    amount: 'text-gold-muted',
  },
  clay: {
    iconWrap: 'bg-clay/10 border-clay/30',
    icon: 'text-clay',
    progress: '[&>[data-slot=progress-indicator]]:bg-clay',
    button: 'border-clay/40 bg-clay/10 text-clay hover:bg-clay hover:text-champagne',
    ring: 'group-hover:border-clay/50',
    amount: 'text-clay',
  },
  sage: {
    iconWrap: 'bg-sage/10 border-sage/30',
    icon: 'text-sage',
    progress: '[&>[data-slot=progress-indicator]]:bg-sage',
    button: 'border-sage/40 bg-sage/10 text-sage hover:bg-sage hover:text-champagne',
    ring: 'group-hover:border-sage/50',
    amount: 'text-sage',
  },
};

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function cardFromContent(value: string, metadata: Record<string, unknown>, index: number): RegistryCard {
  const icon = metadata.icon === 'heart' || metadata.icon === 'gift' ? metadata.icon : index === 1 ? 'heart' : index === 2 ? 'gift' : 'plane';
  const accent = metadata.accent === 'clay' || metadata.accent === 'sage' ? metadata.accent : 'gold';
  const goal = asNumber(metadata.goal, 0);
  const raised = asNumber(metadata.raised, 0);
  const progress = goal > 0 ? asNumber(metadata.progress, Math.round((raised / goal) * 100)) : undefined;

  return {
    icon,
    title: value,
    description: typeof metadata.description === 'string' ? metadata.description : '',
    accent,
    cta: typeof metadata.cta === 'string' ? metadata.cta : 'View details',
    meta: {
      label: typeof metadata.label === 'string' ? metadata.label : '',
      raised,
      goal: goal > 0 ? goal : undefined,
      progress,
      detail: typeof metadata.detail === 'string' ? metadata.detail : undefined,
    },
    href: typeof metadata.href === 'string' ? metadata.href : '#rsvp',
  };
}

function RegistryCardItem({ card, index }: { card: RegistryCard; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const Icon = ICONS[card.icon];
  const styles = ACCENT_STYLES[card.accent];
  const isExternal = card.href.startsWith('http');
  const noGoalDetail = card.meta.detail || (card.icon === 'gift' ? 'Curated homeware & timeless pieces' : card.description);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 * index }}
      className="h-full"
    >
      <Card className={`group h-full border-gold/25 bg-champagne shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${styles.ring}`}>
        <CardContent className="flex h-full flex-col p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between">
            <span className={`flex size-14 items-center justify-center rounded-full border ${styles.iconWrap} transition-transform duration-300 group-hover:scale-105`}>
              <Icon className={`size-6 ${styles.icon}`} strokeWidth={1.25} />
            </span>
            {card.meta.goal && (
              <span className="rounded-full border border-gold/20 bg-ivory/70 px-3 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.15em] text-gold-muted">
                {card.meta.progress}% Funded
              </span>
            )}
          </div>

          <h3 className="wewed-heading mb-3 text-xl font-light leading-snug text-espresso sm:text-2xl">{card.title}</h3>
          <p className="mb-6 font-sans text-sm leading-relaxed text-espresso/65">{card.description}</p>

          {card.meta.goal ? (
            <div className="mb-6 mt-auto space-y-2.5">
              <div className="flex items-baseline justify-between">
                <span className="font-sans text-[11px] font-medium uppercase tracking-wider text-espresso/50">{card.meta.label}</span>
                <span className="font-sans text-[11px] text-espresso/45">of ${card.meta.goal.toLocaleString()}</span>
              </div>
              <Progress value={card.meta.progress} className={`h-1.5 bg-gold/15 ${styles.progress}`} />
              <div className="flex items-baseline gap-2">
                <span className={`font-serif text-2xl font-light tabular-nums ${styles.amount}`}>${card.meta.raised.toLocaleString()}</span>
                <span className="font-sans text-xs text-espresso/45">raised</span>
              </div>
            </div>
          ) : (
            <div className="mb-6 mt-auto space-y-1.5">
              <p className="font-sans text-[11px] font-medium uppercase tracking-wider text-espresso/50">{card.meta.label || 'Wedding registry'}</p>
              {noGoalDetail && <p className="font-serif text-sm italic leading-relaxed text-espresso/60">{noGoalDetail}</p>}
            </div>
          )}

          <Button asChild variant="outline" className={`w-full justify-center border font-sans text-xs uppercase tracking-[0.15em] transition-all duration-300 ${styles.button}`}>
            <a href={card.href} {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
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
  const ctx = useWeddingContextSafe();
  const wedding = ctx?.wedding;
  const rows = ctx?.getOrdered('registry', 'card-') ?? [];
  const cards = rows.length > 0 ? rows.map((row, index) => cardFromContent(row.value, row.metadata, index)) : STARTER_CARDS;
  const heading = ctx?.getContent('registry', 'heading', 'With Gratitude') ?? 'With Gratitude';
  const subtitle = ctx?.getContent(
    'registry',
    'subtitle',
    'Your presence is the greatest gift. Add any optional gifting information you would like guests to know.',
  ) ?? 'Your presence is the greatest gift. Add any optional gifting information you would like guests to know.';
  const culturalNote = ctx?.getContent(
    'registry',
    'culturalNote',
    'Add any family, cultural or gifting tradition you would like to share. This section is optional.',
  ) ?? 'Add any family, cultural or gifting tradition you would like to share. This section is optional.';
  const footerMark = [wedding?.monogram || coupleNames(wedding), compactWeddingDate(wedding?.date)].filter(Boolean).join(' · ');

  return (
    <section id="registry" data-classic-section="gift-registry" className="wewed-section bg-champagne py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={sectionRef}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-14 text-center md:mb-20"
        >
          <SectionEyebrow>With Appreciation</SectionEyebrow>
          <h2 className="wewed-heading wewed-heading-accent text-3xl font-light text-espresso sm:text-4xl md:text-5xl">{heading}</h2>
          <p className="mx-auto mt-6 max-w-2xl font-sans text-sm tracking-wide text-espresso/60 sm:text-base">{subtitle}</p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          {cards.map((card, index) => <RegistryCardItem key={`${card.title}-${index}`} card={card} index={index} />)}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 text-center"
        >
          <div className="mx-auto flex max-w-2xl items-center justify-center gap-4">
            <span className="hidden h-px w-12 bg-gradient-to-r from-transparent to-gold/40 sm:block" />
            <p className="font-serif text-base italic leading-relaxed text-espresso/70 sm:text-lg">&ldquo;{culturalNote}&rdquo;</p>
            <span className="hidden h-px w-12 bg-gradient-to-l from-transparent to-gold/40 sm:block" />
          </div>
          {footerMark && <p className="mt-6 wewed-monogram text-xs">{footerMark}</p>}
        </motion.div>
      </div>
    </section>
  );
}
