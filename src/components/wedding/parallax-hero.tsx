'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'
import Image from 'next/image'
import { Countdown } from '@/components/wedding/countdown'

/* ── Gold dust particle ── */
interface Particle {
  id: number
  left: number // vw
  size: number // px
  delay: number // s
  duration: number // s
  sway: number // px horizontal sway
  opacity: number
}

// Deterministic pseudo-random based on index (avoids SSR/CSR hydration mismatch)
function seeded(n: number) {
  const x = Math.sin(n * 9999) * 10000
  return x - Math.floor(x)
}

const PARTICLES: Particle[] = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: seeded(i) * 100,
  size: 2 + seeded(i + 100) * 3,
  delay: seeded(i + 200) * 8,
  duration: 9 + seeded(i + 300) * 7,
  sway: 10 + seeded(i + 400) * 30,
  opacity: 0.3 + seeded(i + 500) * 0.3,
}))

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2, delayChildren: 0.6 },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
  },
}

/**
 * ParallaxHero
 * ────────────
 * An OPTIONAL upgrade of <HeroSection /> adding:
 *   • Mouse-move parallax on the background image (subtle, ~6px)
 *   • Scroll-based parallax (background drifts slower than foreground)
 *   • Floating gold-dust particles drifting upward (~18 particles)
 *   • Subtle gradient overlay shift
 *
 * All effects use transform3d + will-change for GPU acceleration, and
 * listeners are passive + rAF-throttled.
 */
export function ParallaxHero() {
  const containerRef = useRef<HTMLElement>(null)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const rafRef = useRef<number | null>(null)

  // Scroll-driven transforms
  const { scrollY } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  })
  // Background drifts slower than foreground as you scroll.
  const bgY = useTransform(scrollY, [0, 800], [0, 120])
  const bgScale = useTransform(scrollY, [0, 800], [1, 1.12])
  const overlayOpacity = useTransform(scrollY, [0, 600], [1, 0.7])

  // Smooth the mouse parallax with a spring so it glides.
  const smoothX = useSpring(mouse.x, { stiffness: 60, damping: 18, mass: 0.6 })
  const smoothY = useSpring(mouse.y, { stiffness: 60, damping: 18, mass: 0.6 })

  // Background transform combines scroll (bgY) + mouse parallax (~±6px).
  // Mouse movement range [-0.5, 0.5] mapped to ±6px.
  // Scroll-driven Y is applied on an outer wrapper; mouse-driven Y/X and
  // scale are applied on the inner image so the transforms compose cleanly
  // without string-joining motion values.
  const bgMouseX = useTransform(smoothX, [-0.5, 0.5], [-6, 6])
  const bgMouseY = useTransform(smoothY, [-0.5, 0.5], [-6, 6])

  // Throttled mouse handler via requestAnimationFrame.
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        const w = window.innerWidth
        const h = window.innerHeight
        setMouse({ x: e.clientX / w - 0.5, y: e.clientY / h - 0.5 })
        rafRef.current = null
      })
    }
    window.addEventListener('mousemove', handleMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleMove)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Foreground subtle parallax (~±3px) — adds depth without nausea.
  const fgTranslateX = useTransform(smoothX, [-0.5, 0.5], [-3, 3])
  const fgTranslateY = useTransform(smoothY, [-0.5, 0.5], [-2, 2])

  // Pre-compute particle styles (stable across renders).
  const particleStyles = useMemo(
    () =>
      PARTICLES.map((p) => ({
        left: `${p.left}vw`,
        width: `${p.size}px`,
        height: `${p.size}px`,
        opacity: p.opacity,
        animationDelay: `${p.delay}s`,
        animationDuration: `${p.duration}s`,
        '--sway': `${p.sway}px`,
      })),
    []
  )

  return (
    <section
      ref={containerRef}
      id="home"
      className="wewed-section relative flex min-h-screen flex-col items-center justify-center overflow-hidden"
    >
      {/* Background image — scroll parallax on outer wrapper, mouse + ken burns on inner image */}
      <motion.div
        className="absolute inset-0 will-change-transform"
        style={{ y: bgY }}
        aria-hidden="true"
      >
        <motion.div
          className="absolute inset-0 will-change-transform"
          style={{ x: bgMouseX, y: bgMouseY, scale: bgScale }}
        >
          <Image
            src="/hero-wedding.png"
            alt=""
            fill
            sizes="100vw"
            className="wewed-ken-burns object-cover object-center"
            priority
            quality={90}
          />
        </motion.div>
      </motion.div>

      {/* Dark overlay for text readability (fades slightly on scroll) */}
      <motion.div
        className="absolute inset-0 bg-espresso/70 will-change-[opacity]"
        style={{ opacity: overlayOpacity }}
        aria-hidden="true"
      />

      {/* Animated gradient overlay — subtle hue drift between gold ↔ clay */}
      <motion.div
        className="absolute inset-0 will-change-[opacity]"
        aria-hidden="true"
        animate={{
          background: [
            'radial-gradient(ellipse at 30% 40%, rgba(191,155,95,0.16) 0%, transparent 60%)',
            'radial-gradient(ellipse at 70% 50%, rgba(192,99,63,0.10) 0%, transparent 60%)',
            'radial-gradient(ellipse at 30% 40%, rgba(191,155,95,0.16) 0%, transparent 60%)',
          ],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Floating gold dust particles */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        {particleStyles.map((style, i) => (
          <span
            key={i}
            className="wewed-gold-dust absolute bottom-[-10px] rounded-full bg-gold-light"
            style={style as React.CSSProperties}
          />
        ))}
      </div>

      {/* Bottom gradient fade into next section */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background to-transparent"
        aria-hidden="true"
      />

      {/* Content — foreground parallax */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        style={{ x: fgTranslateX, y: fgTranslateY }}
        className="relative z-10 flex flex-col items-center px-4 text-center will-change-transform"
      >
        {/* Top ornamental divider */}
        <motion.div variants={fadeUp} className="mb-8 flex items-center gap-3 sm:gap-4">
          <div className="h-px w-12 bg-gold/40 sm:w-20" />
          <span className="wewed-monogram text-xs">&#9670;</span>
          <div className="h-px w-12 bg-gold/40 sm:w-20" />
        </motion.div>

        {/* Names */}
        <motion.h1
          variants={fadeUp}
          className="wewed-heading text-5xl font-light leading-tight text-champagne sm:text-7xl md:text-8xl lg:text-9xl"
        >
          <span className="block">Charity</span>
          <span className="my-1 block text-gold">&amp;</span>
          <span className="block">Kudzie</span>
        </motion.h1>

        {/* Bottom ornamental divider */}
        <motion.div variants={fadeUp} className="mt-8 flex items-center gap-3 sm:gap-4">
          <div className="h-px w-12 bg-gold/40 sm:w-20" />
          <span className="wewed-monogram text-xs">&#9670;</span>
          <div className="h-px w-12 bg-gold/40 sm:w-20" />
        </motion.div>

        {/* Date in monogram style */}
        <motion.p
          variants={fadeUp}
          className="wewed-monogram mt-5 text-xl tracking-[0.3em] sm:text-3xl"
        >
          23 &middot; 12 &middot; 26
        </motion.p>

        {/* Venue */}
        <motion.p
          variants={fadeUp}
          className="mt-3 font-sans text-sm font-light tracking-wider text-champagne/80 sm:text-base"
        >
          Imba Manor &middot; Harare, Zimbabwe
        </motion.p>

        {/* Tagline */}
        <motion.p
          variants={fadeUp}
          className="mt-2 font-serif text-base font-light italic text-gold/80 sm:text-lg"
        >
          Mr &amp; Mrs Musarurwa
        </motion.p>

        {/* Scroll hint */}
        <motion.div
          variants={fadeUp}
          className="mt-6 flex flex-col items-center gap-1 text-champagne/40"
        >
          <span className="font-sans text-[10px] uppercase tracking-[0.2em]">
            Scroll to explore
          </span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="text-gold/40"
            >
              <path
                d="M8 2L8 14M8 14L2 8M8 14L14 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        </motion.div>

        {/* Countdown */}
        <motion.div variants={fadeUp} className="mt-10 sm:mt-14">
          <p className="wewed-monogram mb-4 text-xs uppercase tracking-[0.2em] text-gold/60">
            Counting the moments until forever
          </p>
          <Countdown />
        </motion.div>
      </motion.div>
    </section>
  )
}

export default ParallaxHero
