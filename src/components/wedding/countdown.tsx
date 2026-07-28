'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const WEDDING_DATE = new Date('2026-12-23T14:00:00+02:00'); // 2pm CAT

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calculateTimeLeft(): TimeLeft {
  const now = new Date().getTime();
  const target = WEDDING_DATE.getTime();
  const total = target - now;

  if (total <= 0) {
    const elapsed = now - target;
    return {
      days: Math.floor(elapsed / (1000 * 60 * 60 * 24)),
      hours: Math.floor((elapsed / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((elapsed / (1000 * 60)) % 60),
      seconds: Math.floor((elapsed / 1000) % 60),
      total: elapsed,
    };
  }

  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
    total,
  };
}

function CountdownUnit({
  value,
  label,
  isPast,
}: {
  value: number;
  label: string;
  isPast: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="flex flex-col items-center"
    >
      <div className="relative flex h-20 w-20 items-center justify-center rounded-lg border border-gold/30 bg-champagne/80 backdrop-blur-sm sm:h-24 sm:w-24">
        <span
          className={`font-serif text-3xl font-light tabular-nums sm:text-4xl ${
            isPast ? 'text-plum' : 'text-espresso'
          }`}
        >
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="mt-2 font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-gold-muted sm:text-xs">
        {label}
      </span>
    </motion.div>
  );
}

export function Countdown() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [isPast, setIsPast] = useState(false);

  useEffect(() => {
    const update = () => {
      const t = calculateTimeLeft();
      setTimeLeft(t);
      setIsPast(t.total > 0 ? false : true);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!timeLeft) {
    return (
      <div className="flex items-center justify-center gap-3 sm:gap-5">
        {[0, 0, 0, 0].map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center"
          >
            <div className="h-20 w-20 rounded-lg border border-gold/20 bg-champagne/40 sm:h-24 sm:w-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {isPast ? (
        <p className="font-serif text-lg text-plum italic sm:text-xl">
          {timeLeft.days} day{timeLeft.days !== 1 ? 's' : ''} since forever
          <span className="ml-2 inline-block text-clay">&#9829;</span>
        </p>
      ) : (
        <p className="font-serif text-sm text-gold italic sm:text-base">
          Counting the moments until forever
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-5">
        <CountdownUnit value={timeLeft.days} label="Days" isPast={isPast} />
        <CountdownUnit value={timeLeft.hours} label="Hours" isPast={isPast} />
        <CountdownUnit
          value={timeLeft.minutes}
          label="Minutes"
          isPast={isPast}
        />
        <CountdownUnit
          value={timeLeft.seconds}
          label="Seconds"
          isPast={isPast}
        />
      </div>
    </div>
  );
}
