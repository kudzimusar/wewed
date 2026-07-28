'use client';

import { motion } from 'framer-motion';
import { Languages } from 'lucide-react';
import { useWewedStore } from '@/lib/store';
import type { Locale } from '@/lib/i18n';
import { LOCALE_LABELS } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * LanguageToggle — a compact EN | SN switch for the navbar.
 *
 * - Active language renders in gold with an underline indicator.
 * - Inactive language renders in muted champagne.
 * - Subtle hover effect + framer-motion layout animation for the indicator.
 *
 * Two sizes are provided via the `size` prop:
 *  - 'sm' (default) — fits the desktop navbar
 *  - 'md' — used in the mobile Sheet drawer
 */
interface LanguageToggleProps {
  size?: 'sm' | 'md';
  className?: string;
}

const LOCALES: Locale[] = ['en', 'sn'];

export function LanguageToggle({ size = 'sm', className }: LanguageToggleProps) {
  const locale = useWewedStore((s) => s.locale);
  const setLocale = useWewedStore((s) => s.setLocale);

  const iconSize = size === 'sm' ? 14 : 16;
  const padX = size === 'sm' ? 'px-1.5' : 'px-2';
  const padY = size === 'sm' ? 'py-1' : 'py-1.5';
  const gap = size === 'sm' ? 'gap-1.5' : 'gap-2';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <div
      role="group"
      aria-label="Select language"
      className={cn(
        'inline-flex items-center rounded-full border border-gold/30 bg-espresso/40',
        padX,
        padY,
        gap,
        'backdrop-blur-sm',
        className,
      )}
    >
      <Languages
        className="text-gold/70"
        style={{ width: iconSize, height: iconSize }}
        aria-hidden="true"
      />

      <div className={cn('relative flex items-center', gap)}>
        {LOCALES.map((l) => {
          const isActive = locale === l;
          return (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              aria-pressed={isActive}
              aria-label={`Switch to ${l === 'en' ? 'English' : 'chiShona'}`}
              className={cn(
                'relative font-sans font-semibold uppercase tracking-[0.18em] transition-colors duration-200',
                textSize,
                'px-1.5 py-0.5',
                isActive
                  ? 'text-gold'
                  : 'text-champagne/55 hover:text-champagne/85',
              )}
            >
              {isActive && (
                <motion.span
                  layoutId={`lang-underline-${size}`}
                  className="absolute -bottom-0.5 left-1/2 h-px w-3/4 -translate-x-1/2 rounded-full bg-gold"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              {LOCALE_LABELS[l]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
