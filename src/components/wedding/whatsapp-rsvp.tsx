'use client';

import { useEffect, useState, useCallback, useMemo, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, HelpCircle, CalendarCheck } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePWAInstall } from '@/components/wedding/pwa-register';
import { useWewedStore } from '@/lib/store';
import {
  buildWhatsAppUrl,
  COUPLE_WHATSAPP_NUMBER,
  COUPLE_WHATSAPP_DISPLAY,
  type SocialPlatform,
  SOCIAL_PLATFORMS,
} from '@/lib/social';

/* ============================================================
   WhatsAppRSVP — floating "Quick RSVP via WhatsApp" helper
   ------------------------------------------------------------
   A persistent green FAB that opens a small popover letting
   guests RSVP or ask the couple a question via WhatsApp.
   - Mobile: always visible
   - Desktop: visible after scrolling past the hero (scrollY > 480)
   - Dismissable (session persistence in sessionStorage)
   - Shifts up when the PWA install prompt is visible
   - Pulse ring to draw attention
   ============================================================ */

const DISMISS_KEY = 'wewed_wa_rsvp_dismissed';
const SCROLL_THRESHOLD = 480; // px — roughly past the hero

/* ── Mounted detection (SSR-safe via useSyncExternalStore) ──
 * Returns false on the server, true on the client. No setState
 * in an effect — the canonical React 18 pattern. */
const emptySubscribe = () => () => {};
const getMountedClient = () => true;
const getMountedServer = () => false;

/* ── Tiny external store for session-persisted dismissal ──
 * Writable + subscribable so useSyncExternalStore can read it
 * without a synchronous setState inside an effect. */
let _dismissed = false;
const _dismissListeners = new Set<() => void>();
function subscribeDismissed(cb: () => void) {
  _dismissListeners.add(cb);
  return () => {
    _dismissListeners.delete(cb);
  };
}
function getDismissedClient() {
  return _dismissed;
}
function getDismissedServer() {
  return false;
}
function setDismissedStore(v: boolean) {
  if (_dismissed === v) return;
  _dismissed = v;
  _dismissListeners.forEach((l) => l());
}

/* ── WhatsApp glyph (brand) ── */
function WhatsAppGlyph({ className }: { className?: string }) {
  const p: SocialPlatform = SOCIAL_PLATFORMS.whatsapp;
  return (
    <svg
      viewBox={p.iconViewBox}
      className={className}
      fill="currentColor"
      fillRule={p.iconFillRule || 'nonzero'}
      aria-hidden="true"
    >
      {p.iconPaths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export function WhatsAppRSVP() {
  const isMobile = useIsMobile();
  const { canInstall } = usePWAInstall();
  const installDismissed = useWewedStore((s) => s.installPromptDismissed);

  const mounted = useSyncExternalStore(
    emptySubscribe,
    getMountedClient,
    getMountedServer
  );
  const dismissed = useSyncExternalStore(
    subscribeDismissed,
    getDismissedClient,
    getDismissedServer
  );

  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  // Restore dismissal from sessionStorage once on the client.
  // The store update happens via setDismissedStore, which notifies
  // subscribers asynchronously — no synchronous setState in effect.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') {
        setDismissedStore(true);
      }
    } catch {
      /* sessionStorage may be unavailable (private mode) — ignore */
    }
  }, []);

  // Scroll listener — desktop only reveals after hero. The initial
  // position check is deferred via requestAnimationFrame so it isn't
  // a synchronous setState in the effect body.
  useEffect(() => {
    if (!mounted) return;
    const onScroll = () => {
      setScrolledPastHero(window.scrollY > SCROLL_THRESHOLD);
    };
    const raf = window.requestAnimationFrame(onScroll);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [mounted]);

  const dismiss = useCallback(() => {
    setDismissedStore(true);
    setOpen(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  // Visibility rules
  const installVisible = canInstall && !installDismissed;
  const visible = mounted && !dismissed && (isMobile || scrolledPastHero);

  // ── Build pre-filled WhatsApp messages ───────────────────
  const guestName = name.trim() || '[your name]';

  const rsvpMessage = useMemo(
    () =>
      `Hi! I'd like to RSVP for Charity & Kudzie's wedding on Dec 23. My name is ${guestName}. I will [accept/decline].`,
    [guestName]
  );

  const questionMessage = useMemo(
    () =>
      `Hi Charity & Kudzie! I have a question about the wedding: `,
    []
  );

  const handleRsvp = useCallback(() => {
    const url = buildWhatsAppUrl(rsvpMessage, COUPLE_WHATSAPP_NUMBER);
    window.open(url, '_blank', 'noopener,noreferrer');
    setOpen(false);
  }, [rsvpMessage]);

  const handleQuestion = useCallback(() => {
    const url = buildWhatsAppUrl(questionMessage, COUPLE_WHATSAPP_NUMBER);
    window.open(url, '_blank', 'noopener,noreferrer');
    setOpen(false);
  }, [questionMessage]);

  // Don't render until mounted (avoids SSR hydration mismatch on visibility)
  if (!mounted) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="wa-rsvp-fab"
          initial={{ scale: 0, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          className={`pointer-events-auto fixed right-4 z-40 sm:right-6 ${
            installVisible ? 'bottom-24 sm:bottom-28' : 'bottom-6'
          }`}
          aria-live="polite"
        >
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <Popover open={open} onOpenChange={setOpen}>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Quick RSVP via WhatsApp"
                      aria-haspopup="dialog"
                      aria-expanded={open}
                      className="relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl shadow-[#25D366]/30 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-champagne"
                      style={{ background: '#25D366' }}
                    >
                      {/* Pulse ring */}
                      {!open && (
                        <>
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 rounded-full"
                            style={{ background: '#25D366', opacity: 0.5 }}
                          />
                          <motion.span
                            aria-hidden="true"
                            className="absolute inset-0 rounded-full"
                            style={{ background: '#25D366' }}
                            animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
                            transition={{
                              duration: 2.2,
                              ease: 'easeOut',
                              repeat: Infinity,
                            }}
                          />
                        </>
                      )}
                      <WhatsAppGlyph className="relative z-10 h-7 w-7" />
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  className="border-gold/30 bg-espresso text-champagne font-sans text-xs"
                >
                  Quick RSVP via WhatsApp
                </TooltipContent>

                {/* ── Popover panel ── */}
                <PopoverContent
                  side="top"
                  align="end"
                  sideOffset={12}
                  className="w-[calc(100vw-2rem) max-w-sm rounded-2xl border-gold/40 bg-white p-5 shadow-2xl"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                        style={{ background: '#25D366' }}
                      >
                        <WhatsAppGlyph className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-serif text-lg leading-tight text-espresso">
                          Quick RSVP
                        </p>
                        <p className="font-sans text-xs text-espresso/60">
                          via WhatsApp · {COUPLE_WHATSAPP_DISPLAY}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={dismiss}
                      aria-label="Dismiss WhatsApp RSVP helper"
                      className="rounded-full p-1 text-espresso/40 transition-colors hover:bg-gold/10 hover:text-espresso"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Name input */}
                  <div className="mt-4">
                    <label
                      htmlFor="wa-rsvp-name"
                      className="mb-1.5 block font-sans text-[11px] uppercase tracking-[0.18em] text-gold-muted"
                    >
                      Your name (optional)
                    </label>
                    <Input
                      id="wa-rsvp-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Tariro Moyo"
                      maxLength={60}
                      className="border-gold/25 bg-champagne/40 font-sans text-sm text-espresso placeholder:text-espresso/40 focus-visible:ring-gold"
                    />
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-col gap-2.5">
                    <Button
                      type="button"
                      onClick={handleRsvp}
                      className="h-11 w-full border-transparent text-white shadow-md transition-all hover:brightness-105 active:scale-[0.98]"
                      style={{ background: '#25D366' }}
                    >
                      <CalendarCheck className="mr-2 h-4 w-4" />
                      RSVP via WhatsApp
                    </Button>
                    <Button
                      type="button"
                      onClick={handleQuestion}
                      variant="outline"
                      className="h-11 w-full border-gold/40 text-espresso hover:bg-gold/10 hover:text-espresso"
                    >
                      <HelpCircle className="mr-2 h-4 w-4" />
                      Ask a Question
                    </Button>
                  </div>

                  {/* Footer */}
                  <p className="mt-4 flex items-center justify-center gap-1.5 font-sans text-[11px] text-espresso/45">
                    <MessageCircle className="h-3 w-3" />
                    Opens WhatsApp with a pre-filled message
                  </p>
                </PopoverContent>
              </Popover>
            </Tooltip>
          </TooltipProvider>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default WhatsAppRSVP;
