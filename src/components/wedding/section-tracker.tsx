'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * SectionTracker — a small floating chip showing the current section name.
 *
 * As the user scrolls this very long single-page site, a tiny gold-bordered
 * chip appears at the top-center of the viewport showing the name of the
 * section currently in view (e.g. "Our Story", "RSVP", "Songbook"). It acts
 * as a "you are here" indicator, helping guests orient themselves in the
 * long editorial scroll.
 *
 * Design:
 *  - Hidden at the very top of the page (hero section is self-evident).
 *  - Appears (fade + slide down) once the user scrolls past the hero.
 *  - Smoothly crossfades the label when the section changes.
 *  - Non-blocking (pointer-events: none, sits in z-40 above content but
 *    below modals).
 *  - Respects prefers-reduced-motion (no crossfade, instant swap).
 *
 * Implementation:
 *  - Uses a static ID → label map (no DOM modifications needed, zero
 *    hydration risk).
 *  - Uses IntersectionObserver to track which section is most visible.
 *  - Single observer, single rAF-throttled scroll handler.
 *  - Only tracks sections that exist in the DOM at mount time.
 */

// Static map of section IDs to human-readable labels.
// This avoids modifying any section component (zero hydration risk) and
// keeps all tracker logic self-contained.
const SECTION_LABELS: Record<string, string> = {
  home: 'Charity & Kudzie',
  story: 'Our Story',
  venue: 'The Venue',
  theday: 'The Day',
  rsvp: 'RSVP',
  travel: 'Travel & Stay',
  registry: 'Gifts & Gratitude',
  songbook: 'The Songbook',
  'songbook-enhanced': 'The Songbook',
  guests: 'Meet Our Village',
  vendors: 'The Makings of a Perfect Day',
  checkin: 'Check In',
  'gallery-enhanced': 'Moments That Matter',
  gallery: 'Gallery',
  share: 'Share Your Moments',
  capsule: 'Memory Time Capsule',
  livewall: 'Live from Imba Manor',
  faq: 'Questions & Answers',
  'share-wedding': 'Spread the Love',
  pricing: 'Your Forever, Preserved',
}

const HERO_HEIGHT_PX = 600 // Below this, show the tracker

export function SectionTracker() {
  const [activeLabel, setActiveLabel] = useState<string | null>(null)
  const [showTracker, setShowTracker] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [progressPercent, setProgressPercent] = useState(0)
  const visibleRef = useRef<Map<string, number>>(new Map())
  const rafRef = useRef<number>(0)

  // Set up reduced-motion listener.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Pick the most-visible section and update the label.
  const pickActive = useCallback(() => {
    rafRef.current = 0
    const visible = visibleRef.current
    if (visible.size === 0) {
      return
    }
    let bestId = ''
    let bestRatio = 0
    visible.forEach((ratio, id) => {
      if (ratio > bestRatio && SECTION_LABELS[id]) {
        bestRatio = ratio
        bestId = id
      }
    })
    if (bestId) {
      setActiveLabel((prev) => (prev !== SECTION_LABELS[bestId] ? SECTION_LABELS[bestId] : prev))
    }
  }, [])

  // Track scroll position to toggle tracker visibility + reading progress.
  useEffect(() => {
    let lastY = -1
    const onScroll = () => {
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        const y = window.scrollY
        if (y === lastY) return
        lastY = y
        const shouldShow = y > HERO_HEIGHT_PX
        setShowTracker((prev) => (prev !== shouldShow ? shouldShow : prev))
        // Calculate reading progress percentage (0–100).
        const doc = document.documentElement
        const maxScroll = doc.scrollHeight - window.innerHeight
        const ratio = maxScroll > 0 ? Math.min(1, Math.max(0, y / maxScroll)) : 0
        setProgressPercent(Math.round(ratio * 100))
        pickActive()
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('scroll', onScroll)
    }
  }, [pickActive])

  // Observe each known section for visibility ratio.
  useEffect(() => {
    // Find all sections that have both an ID and a label in our map.
    const sectionIds = Object.keys(SECTION_LABELS)
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)

    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id
          if (entry.isIntersecting) {
            visibleRef.current.set(id, entry.intersectionRatio)
          } else {
            visibleRef.current.delete(id)
          }
        }
        pickActive()
      },
      {
        // Track the middle band of the viewport — what's "currently being read"
        rootMargin: '-30% 0px -50% 0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      }
    )
    sections.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [pickActive])

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4 sm:top-6"
    >
      <AnimatePresence>
        {showTracker && activeLabel && (
          <motion.div
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none flex items-center gap-2 rounded-full border border-gold/30 bg-espresso/85 px-4 py-1.5 shadow-lg backdrop-blur-md"
          >
            {/* Diamond marker */}
            <span
              className="h-1.5 w-1.5 rotate-45 bg-gold"
              aria-hidden="true"
            />
            {/* Label — crossfade on change */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={activeLabel}
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="font-sans text-[10px] uppercase tracking-[0.22em] text-champagne/90 sm:text-xs"
              >
                {activeLabel}
              </motion.span>
            </AnimatePresence>
            {/* Reading progress percentage — subtle gold divider + percentage */}
            <span
              className="flex items-center gap-1.5"
              aria-label={`Reading progress: ${progressPercent}%`}
            >
              <span className="h-3 w-px bg-gold/30" aria-hidden="true" />
              <span className="font-sans text-[10px] font-medium tabular-nums text-gold/80 sm:text-xs">
                {progressPercent}%
              </span>
            </span>
            {/* Subtle right dot */}
            <span
              className="h-1 w-1 rounded-full bg-gold/50"
              aria-hidden="true"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
