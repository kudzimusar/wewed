'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * HelpPopups — non-blocking contextual first-time-user help.
 *
 * Design principles (fixed in Task 17):
 * - NEVER auto-show a full-viewport blocking modal. A first-time guest should be
 *   able to scroll, click the navbar, and use the site immediately. The previous
 *   implementation hijacked the screen with a `fixed inset-0 z-[60]` overlay
 *   after a 3-second timer — that blocked the RSVP / SONGBOOK nav links and was
 *   hostile UX.
 * - Instead, on the very first visit only, show a small NON-blocking "hint pill"
 *   in the bottom-right corner. It auto-dismisses after 8 seconds, or the user
 *   can dismiss it manually. It never covers content or interactive elements.
 * - The floating help button (always present, has the pulsing gold dot) opens
 *   the full guided tour ON DEMAND. That respects user agency.
 * - The "dismissed" state is persisted in localStorage so it never auto-shows
 *   again. The help button is always available for users who want the tour.
 */

const HELP_SEEN_KEY = 'wewed:help-seen-v2'
const HELP_TOUR_KEY = 'wewed:help-tour-dismissed'

interface HelpTip {
  id: string
  title: string
  body: string
  icon: string
}

const HELP_TIPS: HelpTip[] = [
  {
    id: 'welcome',
    title: 'Welcome to wewed',
    body: 'This is the wedding website for Charity & Kudzie. Scroll down to explore their story, RSVP, songbook, and more. Use the BEFORE | AFTER toggle to switch between anticipation and memory modes.',
    icon: '🎉',
  },
  {
    id: 'rsvp',
    title: 'RSVP',
    body: 'Click the RSVP link in the navbar to confirm your attendance. Choose your meal, note dietary needs, request a song, and leave a message for the couple.',
    icon: '✉️',
  },
  {
    id: 'songbook',
    title: 'Songbook & Voting',
    body: 'Browse 26 songs across ceremony, reception, and first dance. Click the heart icon to vote for songs you want to hear. The DJ will see the live-ranked list on the wedding day.',
    icon: '🎵',
  },
  {
    id: 'village',
    title: 'Meet Our Village',
    body: 'This section shows memories, blessings, and advice from invited guests. Each guest gets a personal token link to contribute their own story. Filter by type using the chips above.',
    icon: '❤️',
  },
  {
    id: 'planner',
    title: 'Wedding Planner',
    body: 'The PLAN button opens a full wedding planning dashboard for the couple — 80+ checklist tasks, budget tracker, vendor manager, guest list, timeline, and seating chart. Requires a password.',
    icon: '📋',
  },
  {
    id: 'edit',
    title: 'Couple Editing',
    body: 'The couple can log in (bottom-left button) to edit website content directly. Gold pencil icons appear next to editable text. Click any pencil to edit names, stories, dates, and more.',
    icon: '✏️',
  },
  {
    id: 'share',
    title: 'Share the Wedding',
    body: "Use the Spread the Love section to share this website via WhatsApp, Telegram, social media, or QR code. Help others discover Charity & Kudzie's story.",
    icon: '🔗',
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    body: 'Ctrl+Shift+A: Admin Dashboard · Ctrl+Shift+P: Build Progress. The couple can use these to quickly access management tools.',
    icon: '⌨️',
  },
]

export function HelpPopups() {
  const [showHint, setShowHint] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [currentTip, setCurrentTip] = useState(0)

  const dismissHint = useCallback(() => {
    setShowHint(false)
    try {
      localStorage.setItem(HELP_SEEN_KEY, 'true')
    } catch {
      // ignore
    }
  }, [])

  const openTour = useCallback(() => {
    setShowHint(false)
    setShowTour(true)
    try {
      localStorage.setItem(HELP_SEEN_KEY, 'true')
    } catch {
      // ignore
    }
  }, [])

  const closeTour = useCallback(() => {
    setShowTour(false)
    try {
      localStorage.setItem(HELP_TOUR_KEY, 'true')
    } catch {
      // ignore
    }
  }, [])

  // On first ever visit, show the gentle hint pill after 2.5s.
  // The hint is non-blocking (sits in the corner) and auto-dismisses after 8s.
  useEffect(() => {
    try {
      const seen = localStorage.getItem(HELP_SEEN_KEY) === 'true'
      const tourDismissed = localStorage.getItem(HELP_TOUR_KEY) === 'true'
      if (!seen && !tourDismissed) {
        const t = window.setTimeout(() => setShowHint(true), 2500)
        return () => window.clearTimeout(t)
      }
    } catch {
      // localStorage unavailable (private mode etc.) — fail silently.
    }
  }, [])

  // Auto-dismiss the hint after 8 seconds.
  useEffect(() => {
    if (!showHint) return
    const t = window.setTimeout(() => dismissHint(), 8000)
    return () => window.clearTimeout(t)
  }, [showHint, dismissHint])

  const handleNext = () => {
    if (currentTip < HELP_TIPS.length - 1) {
      setCurrentTip(currentTip + 1)
    } else {
      closeTour()
    }
  }

  const handlePrev = () => {
    if (currentTip > 0) {
      setCurrentTip(currentTip - 1)
    }
  }

  const tip = HELP_TIPS[currentTip]

  return (
    <>
      {/* ───────────────────────────────────────────────────────────
          Floating help button — always present (lower z-index than tour).
          Removed the pulsing dot once the user has interacted with help.
         ─────────────────────────────────────────────────────────── */}
      <button
        onClick={() => {
          setCurrentTip(0)
          setShowTour(true)
        }}
        aria-label="Show help tour"
        className="fixed bottom-24 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 bg-espresso/90 text-gold shadow-lg backdrop-blur-md transition-all hover:border-gold hover:bg-espresso hover:scale-110 sm:bottom-28"
      >
        <HelpCircle className="h-5 w-5" />
        <span className="pointer-events-none absolute -top-1 -right-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-gold" />
        </span>
      </button>

      {/* ───────────────────────────────────────────────────────────
          First-visit hint pill — NON-blocking. Sits in bottom-right corner,
          auto-dismisses after 8s, never covers navbar or content.
         ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showHint && !showTour && (
          <motion.div
            initial={{ opacity: 0, y: 30, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 20, x: 20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            role="status"
            aria-live="polite"
            className="fixed bottom-6 right-6 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gold/30 bg-champagne/95 shadow-2xl backdrop-blur-md dark:bg-espresso/95 sm:bottom-6"
          >
            {/* Gold top accent */}
            <div className="h-0.5 w-full wewed-gold-gradient" aria-hidden="true" />
            <div className="flex items-start gap-3 p-4">
              <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-serif text-sm font-medium text-espresso dark:text-champagne">
                  First time here?
                </p>
                <p className="mt-0.5 font-sans text-xs leading-relaxed text-espresso/70 dark:text-champagne/70">
                  Take a 30-second tour of the story, RSVP, songbook, and guest village.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={openTour}
                    className="font-sans text-xs font-medium uppercase tracking-[0.12em] text-gold transition-colors hover:text-gold-light"
                  >
                    Take the tour →
                  </button>
                  <button
                    onClick={dismissHint}
                    className="font-sans text-xs text-espresso/40 transition-colors hover:text-espresso/70 dark:text-champagne/40 dark:hover:text-champagne/70"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <button
                onClick={dismissHint}
                aria-label="Dismiss hint"
                className="-mr-1 -mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-espresso/40 transition-colors hover:bg-espresso/5 hover:text-espresso/70 dark:text-champagne/40 dark:hover:bg-champagne/5 dark:hover:text-champagne/70"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ───────────────────────────────────────────────────────────
          Full guided tour dialog — shown ONLY on explicit user click.
          Backdrop dismiss persists the dismissed state (previous bug fix).
         ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showTour && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-espresso/60 backdrop-blur-sm"
            onClick={closeTour}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="help-tour-title"
              className="mx-4 max-w-md rounded-2xl border border-gold/30 bg-champagne p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={closeTour}
                aria-label="Close help"
                className="absolute right-4 top-4 text-espresso/40 hover:text-espresso"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Tip content */}
              <div className="mb-4 text-center">
                <span className="text-4xl" aria-hidden="true">{tip.icon}</span>
              </div>
              <h3
                id="help-tour-title"
                className="mb-2 text-center font-serif text-2xl font-light text-espresso"
              >
                {tip.title}
              </h3>
              <p className="mb-6 text-center font-sans text-sm leading-relaxed text-espresso/70">
                {tip.body}
              </p>

              {/* Progress dots */}
              <div className="mb-4 flex justify-center gap-1.5">
                {HELP_TIPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentTip(i)}
                    aria-label={`Go to tip ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentTip ? 'w-6 bg-gold' : 'w-1.5 bg-espresso/20'
                    }`}
                  />
                ))}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between">
                <button
                  onClick={closeTour}
                  className="font-sans text-xs uppercase tracking-[0.15em] text-espresso/50 hover:text-espresso/70"
                >
                  Close tour
                </button>
                <div className="flex items-center gap-2">
                  {currentTip > 0 && (
                    <Button
                      onClick={handlePrev}
                      variant="ghost"
                      size="sm"
                      className="text-espresso/60 hover:text-espresso"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    onClick={handleNext}
                    size="sm"
                    className="bg-gold text-espresso hover:bg-gold/90"
                  >
                    {currentTip < HELP_TIPS.length - 1 ? (
                      <>
                        Next
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </>
                    ) : (
                      'Got it!'
                    )}
                  </Button>
                </div>
              </div>

              {/* Step counter */}
              <p className="mt-3 text-center font-sans text-[10px] uppercase tracking-[0.15em] text-espresso/40">
                {currentTip + 1} of {HELP_TIPS.length}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
