'use client'

import { motion } from 'framer-motion'
import { ChevronDown, Sparkles } from 'lucide-react'

/**
 * IntroductionsBanner — a slim CTA strip that sits above the <Guests /> section.
 *
 * Invites guests to tap any face in the wedding party to read a richer story.
 * Rendered as its own component so the lead agent can place it (or omit it)
 * independently of the Guests section. Uses the wewed gold/champagne palette
 * and framer-motion for an elegant fade-in.
 */
export function IntroductionsBanner() {
  return (
    <motion.section
      aria-label="Meet the wedding party"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full"
    >
      {/* slim gradient strip with gold hairlines top + bottom */}
      <div className="relative overflow-hidden border-y border-gold/25 bg-gradient-to-r from-champagne via-ivory to-champagne">
        {/* soft gold radial wash */}
        <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(ellipse_at_center,rgba(191,155,95,0.10),transparent_70%)]" />

        <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-1 px-4 py-5 text-center md:flex-row md:gap-4 md:py-6">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-gold" />
            <p className="wewed-heading text-lg text-espresso md:text-xl">
              Meet the people who make our day possible
            </p>
            <Sparkles className="size-4 text-gold" />
          </div>

          {/* vertical divider on desktop */}
          <span
            aria-hidden
            className="hidden h-5 w-px bg-gold/40 md:inline-block"
          />

          <p className="flex items-center gap-1.5 font-sans text-sm text-espresso/70">
            Tap any face to learn their story
            <motion.span
              animate={{ y: [0, 3, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex"
            >
              <ChevronDown className="size-4 text-clay" />
            </motion.span>
          </p>
        </div>
      </div>
    </motion.section>
  )
}

export default IntroductionsBanner
