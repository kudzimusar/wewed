'use client';

import { useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { CalendarPlus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRef } from 'react';
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider';
import { googleCalendarUrl } from '@/lib/wedding-template-defaults';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  total: number;
}

function calculateTimeLeft(targetValue: string): TimeLeft {
  const target = new Date(targetValue).getTime();
  if (Number.isNaN(target)) return { days: 0, hours: 0, minutes: 0, total: 0 };
  const total = target - Date.now();
  if (total <= 0) return { days: 0, hours: 0, minutes: 0, total: 0 };

  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    total,
  };
}

interface TimeSegmentProps {
  value: number;
  label: string;
}

function TimeSegment({ value, label }: TimeSegmentProps) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-serif text-2xl font-light tabular-nums text-champagne sm:text-3xl">
        {value}
      </span>
      <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-gold-muted sm:text-xs">
        {label}
      </span>
    </span>
  );
}

export function CountdownBanner() {
  const wedding = useWeddingContextSafe()?.wedding;
  const weddingDate = wedding?.date ?? '';
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  useEffect(() => {
    if (!weddingDate) {
      setTimeLeft(null);
      return;
    }
    const update = () => setTimeLeft(calculateTimeLeft(weddingDate));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [weddingDate]);

  const isPast = timeLeft?.total === 0;

  return (
    <section
      ref={ref}
      aria-label="Countdown to the wedding"
      className="relative overflow-hidden bg-espresso"
    >
      <div
        className="wewed-ken-burns pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, var(--color-gold) 1px, transparent 1.5px), radial-gradient(circle at 70% 60%, var(--color-gold) 1px, transparent 1.5px), radial-gradient(circle at 40% 80%, var(--color-gold-light) 1px, transparent 1.5px)',
          backgroundSize: '60px 60px, 90px 90px, 70px 70px',
        }}
        aria-hidden="true"
      />
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(191,155,95,0.18) 0%, transparent 65%)',
        }}
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 sm:px-6 md:flex-row md:gap-8 md:py-12 lg:px-8"
      >
        <div className="order-3 w-full md:order-1 md:w-auto md:flex-1">
          <a
            href={googleCalendarUrl(wedding)}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex w-full items-center justify-center gap-2 font-sans text-[11px] font-medium uppercase tracking-[0.18em] text-champagne/60 transition-colors hover:text-gold md:justify-start md:w-auto"
          >
            <CalendarPlus
              className="h-4 w-4 transition-transform group-hover:-translate-y-0.5"
              strokeWidth={1.5}
            />
            <span className="border-b border-transparent pb-0.5 transition-colors group-hover:border-gold/40">
              Add to Calendar
            </span>
          </a>
        </div>

        <div className="order-1 flex flex-col items-center gap-2 md:order-2 md:flex-1 md:gap-3">
          {timeLeft && !isPast ? (
            <>
              <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold-muted sm:text-xs">
                Counting the moments until forever
              </p>
              <div className="flex flex-wrap items-baseline justify-center gap-x-4 gap-y-2 sm:gap-x-6">
                <TimeSegment value={timeLeft.days} label="Days" />
                <span className="font-serif text-xl text-gold/40 sm:text-2xl">·</span>
                <TimeSegment value={timeLeft.hours} label="Hrs" />
                <span className="font-serif text-xl text-gold/40 sm:text-2xl">·</span>
                <TimeSegment value={timeLeft.minutes} label="Min" />
              </div>
            </>
          ) : (
            <p className="wewed-heading text-2xl font-light text-champagne sm:text-3xl">
              Forever has begun
              <span className="ml-2 inline-block text-clay">&#9829;</span>
            </p>
          )}
        </div>

        <div className="order-2 w-full md:order-3 md:w-auto md:flex-1 md:flex md:justify-end">
          <Button
            asChild
            className="group w-full justify-center bg-gold font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-espresso transition-all hover:bg-gold-light md:w-auto"
          >
            <a href="#rsvp">
              RSVP Now
              <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </a>
          </Button>
        </div>
      </motion.div>
    </section>
  );
}
