'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion'
import { ArrowUp } from 'lucide-react'

/**
 * ScrollProgress + BackToTop — combined floating utilities for long pages.
 *
 * Two pieces, one component (keeps DOM footprint small + shared scroll listener):
 *
 * 1. Scroll progress bar (top of viewport):
 *    A 2px gold gradient bar fixed to the very top of the viewport that fills
 *    from left → right as the user scrolls down. Adds a sense of "how far into
 *    the story am I" on this very long single-page site. Uses a spring-smoothed
 *    motion value so the bar feels alive rather than ticking.
 *
 * 2. Back-to-top floating button (bottom-right, appears after scroll):
 *    A circular gold button that smooth-scrolls to the top of the page.
 *    Appears (fade + slide up) once the user has scrolled past ~1.5 viewport
 *    heights, disappears when near the top. Position is carefully chosen to
 *    stack above the WhatsApp FAB and below the HelpPopups tour modal.
 *
 * Both are non-blocking (pointer-events: none for the bar; only the button is
 * interactive) and respect prefers-reduced-motion.
 */

const SCROLL_TRIGGER_PX = 600 // ≈ one viewport down on phones

export function ScrollProgressBackToTop() {
  const [showButton, setShowButton] = useState(false)

  // Spring-smoothed scroll progress (0 → 1)
  const progress = useSpring(0, { stiffness: 120, damping: 30, mass: 0.4 })
  // Use scaleX (transform) instead of width — doesn't require knowing the
  // parent's pixel width, which framer-motion misinterprets when given a "%"
  // string for width.
  const scaleX = useTransform(progress, (v) => v)

  // Single rAF-throttled scroll listener for both features.
  useEffect(() => {
    let rafId = 0
    let lastY = -1

    const update = () => {
      rafId = 0
      const doc = document.documentElement
      const scrollTop = window.scrollY || doc.scrollTop
      if (scrollTop === lastY) return
      lastY = scrollTop

      const maxScroll = doc.scrollHeight - window.innerHeight
      const ratio = maxScroll > 0 ? Math.min(1, Math.max(0, scrollTop / maxScroll)) : 0
      progress.set(ratio)

      // Show back-to-top once the user has scrolled past the trigger.
      const shouldShow = scrollTop > SCROLL_TRIGGER_PX && maxScroll - scrollTop > 200
      setShowButton((prev) => (prev !== shouldShow ? shouldShow : prev))
    }

    const onScroll = () => {
      if (rafId) return
      rafId = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [progress])

  const scrollToTop = useCallback(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' })
  }, [])

  return (
    <>
      {/* ── Scroll progress bar (top of viewport) ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[55] h-[2px] overflow-visible"
      >
        {/* Track (subtle base line) */}
        <div className="absolute inset-0 bg-gold/10" />
        {/* Fill — uses scaleX so it scales from left edge based on scroll ratio */}
        <motion.div
          style={{ scaleX, transformOrigin: '0% 50%' }}
          className="h-full w-full wewed-gold-gradient shadow-[0_0_8px_rgba(191,155,95,0.5)]"
        />
        {/* Subtle glow trailing the fill edge */}
        <motion.div
          style={{ scaleX, transformOrigin: '0% 50%' }}
          className="absolute top-0 h-[6px] w-full -translate-y-1/2 bg-gold/20 blur-sm"
        />
      </div>

      {/* ── Back to top button ── */}
      <AnimatePresence>
        {showButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.6, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={scrollToTop}
            aria-label="Back to top"
            title="Back to top"
            className="group fixed bottom-40 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 bg-espresso/95 text-gold shadow-lg backdrop-blur-md transition-all hover:border-gold hover:bg-espresso hover:scale-110 sm:bottom-44"
          >
            <ArrowUp className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
            {/* Gold ring pulse on hover */}
            <span className="pointer-events-none absolute inset-0 rounded-full border border-gold/0 transition-all duration-300 group-hover:inset-[-4px] group-hover:border-gold/30" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  )
}
