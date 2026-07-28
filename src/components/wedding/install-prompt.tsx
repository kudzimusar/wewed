'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Sparkles } from 'lucide-react';
import { usePWAInstall } from '@/components/wedding/pwa-register';
import { useWewedStore } from '@/lib/store';
import { useLocale } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

/** Local copy strings for the install banner — kept here because they are
 *  banner-specific (not part of the global i18n dictionary). */
const COPY: Record<Locale, { title: string; body: string; cta: string }> = {
  en: {
    title: 'Install wewed',
    body: 'Add to your home screen for the best experience.',
    cta: 'Install',
  },
  sn: {
    title: 'Isa wewed',
    body: 'Isa pahome screen yako kuti uwane zvakanaka.',
    cta: 'Isa',
  },
};

/**
 * InstallPrompt — a small, dismissible banner that appears when the browser
 * indicates the PWA is installable (the `beforeinstallprompt` event has fired).
 *
 *  - Anchored bottom-right on desktop, bottom-center on mobile.
 *  - Gold-accented, elegant, matches the wewed design language.
 *  - Slide-up entrance via framer-motion.
 *  - Dismissal persists in the zustand store (so it doesn't nag on reload).
 *  - Disappears automatically once the app is installed.
 */
export function InstallPrompt() {
  const { canInstall, promptInstall, isInstalled } = usePWAInstall();
  const dismissed = useWewedStore((s) => s.installPromptDismissed);
  const dismiss = useWewedStore((s) => s.dismissInstallPrompt);
  const locale = useLocale();
  const copy = COPY[locale];

  // Defer the first appearance slightly so it doesn't fight the hero animation.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!canInstall) return;
    const id = window.setTimeout(() => setArmed(true), 2500);
    return () => window.clearTimeout(id);
  }, [canInstall]);

  const visible = canInstall && armed && !dismissed && !isInstalled;

  const handleInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      // The `appinstalled` event will fire and the banner will hide itself.
    } else if (outcome === 'dismissed') {
      // User explicitly dismissed the native prompt — respect that.
      dismiss();
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="install-prompt"
          initial={{ y: 80, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          role="dialog"
          aria-labelledby="install-prompt-title"
          aria-describedby="install-prompt-desc"
          className="pointer-events-auto fixed bottom-4 right-4 z-50 mx-auto flex w-[calc(100vw-2rem)] max-w-sm items-center gap-3 rounded-xl border border-gold/40 bg-espresso/95 p-4 shadow-2xl backdrop-blur-md sm:bottom-6 sm:right-6 sm:left-auto sm:mx-0"
        >
          {/* Gold accent stripe on the left */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-gradient-to-b from-gold/80 to-clay/60"
          />

          {/* Icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 ring-1 ring-gold/30">
            <Download className="h-5 w-5 text-gold" aria-hidden="true" />
          </div>

          {/* Copy */}
          <div className="min-w-0 flex-1">
            <p
              id="install-prompt-title"
              className="font-serif text-base font-medium text-champagne"
            >
              {copy.title}
            </p>
            <p
              id="install-prompt-desc"
              className="mt-0.5 line-clamp-2 font-sans text-xs text-champagne/70"
            >
              {copy.body}
            </p>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleInstall}
              className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso shadow transition-all hover:bg-gold/90 active:scale-95"
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {copy.cta}
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss install prompt"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-champagne/60 transition-colors hover:bg-gold/10 hover:text-champagne"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
