'use client'

import { motion } from 'framer-motion'

/**
 * SectionEyebrow — small uppercase gold label that sits above a section's H2,
 * giving the long-scroll homepage an editorial-magazine rhythm.
 *
 * Renders as a centered pill with gradient line accents on both sides
 * (uses the `.wewed-eyebrow` class defined in globals.css).
 *
 * Usage:
 *   <SectionEyebrow>Chapter One</SectionEyebrow>
 *   <h2>Our Story</h2>
 *
 * The component is intentionally tiny and stateless — it's purely presentational.
 * The `delay` prop (seconds) lets the eyebrow fade in slightly before the H2
 * for a layered reveal.
 */

interface SectionEyebrowProps {
  children: React.ReactNode
  /** Fade-in delay in seconds (default 0). */
  delay?: number
  /** Visual variant. `center` (default) has lines on both sides;
   *  `left` has only a trailing line; `right` has only a leading line. */
  align?: 'center' | 'left' | 'right'
  className?: string
}

export function SectionEyebrow({
  children,
  delay = 0,
  align = 'center',
  className = '',
}: SectionEyebrowProps) {
  const alignClass =
    align === 'left'
      ? 'wewed-eyebrow wewed-eyebrow-left'
      : align === 'right'
        ? 'wewed-eyebrow wewed-eyebrow-right'
        : 'wewed-eyebrow'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`mb-4 flex justify-center ${className}`}
    >
      <span className={alignClass}>{children}</span>
    </motion.div>
  )
}
