'use client'

import { motion } from 'framer-motion'
import { CSSProperties } from 'react'

/* ============================================================
   Decorative Elements — reusable SVG + motion ornaments
   Palette: gold (#BF9B5F), gold-light (#D8BC7E), champagne
   All are responsive + use framer-motion for subtle animation.
   ============================================================ */

const GOLD = '#BF9B5F'
const GOLD_LIGHT = '#D8BC7E'
const GOLD_MUTED = '#A68B4B'

/* ───────────────────────────────────────────────────────────
   GoldOrnament
   A decorative horizontal divider with two flourish curls and a
   central diamond. Use `className` to control width.
   ─────────────────────────────────────────────────────────── */
export function GoldOrnament({
  className = 'w-full max-w-xs',
  height = 24,
}: {
  className?: string
  height?: number
}) {
  return (
    <motion.svg
      viewBox="0 0 240 24"
      height={height}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Left line */}
      <line
        x1="0"
        y1="12"
        x2="86"
        y2="12"
        stroke={GOLD}
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* Left curl */}
      <path
        d="M86 12 C 96 12, 100 4, 108 4 C 102 8, 104 12, 110 12"
        stroke={GOLD}
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
      />
      {/* Left inner curl */}
      <path
        d="M90 12 C 96 12, 98 8, 104 8"
        stroke={GOLD_LIGHT}
        strokeWidth="0.75"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Central diamond */}
      <g transform="translate(120, 12)">
        <path
          d="M0 -6 L5 0 L0 6 L-5 0 Z"
          fill={GOLD}
          opacity="0.9"
        />
        <path
          d="M0 -3 L2.5 0 L0 3 L-2.5 0 Z"
          fill={GOLD_LIGHT}
        />
      </g>
      {/* Right curl (mirror) */}
      <path
        d="M154 12 C 144 12, 140 4, 132 4 C 138 8, 136 12, 130 12"
        stroke={GOLD}
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M150 12 C 144 12, 142 8, 136 8"
        stroke={GOLD_LIGHT}
        strokeWidth="0.75"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Right line */}
      <line
        x1="154"
        y1="12"
        x2="240"
        y2="12"
        stroke={GOLD}
        strokeWidth="1"
        strokeLinecap="round"
      />
    </motion.svg>
  )
}

/* ───────────────────────────────────────────────────────────
   MonogramSeal
   A circular wax-seal style monogram with "C&K 23.12.26".
   Slight float animation. Scales on hover.
   ─────────────────────────────────────────────────────────── */
export function MonogramSeal({
  size = 96,
  className = '',
  interactive = false,
}: {
  size?: number
  className?: string
  interactive?: boolean
}) {
  return (
    <motion.div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      initial={{ opacity: 0, scale: 0.85 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={interactive ? { scale: 1.05 } : undefined}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Charity and Kudzie monogram, 23.12.26"
      >
        <defs>
          <radialGradient id="wewed-seal-bg" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#C0633F" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#6B2D3A" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#1A1410" stopOpacity="0.95" />
          </radialGradient>
          <linearGradient id="wewed-seal-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={GOLD_LIGHT} />
            <stop offset="50%" stopColor={GOLD} />
            <stop offset="100%" stopColor={GOLD_MUTED} />
          </linearGradient>
        </defs>

        {/* Outer ring */}
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="url(#wewed-seal-ring)"
          strokeWidth="1.5"
        />
        {/* Seal body */}
        <circle cx="50" cy="50" r="44" fill="url(#wewed-seal-bg)" />
        {/* Inner gold ring */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="url(#wewed-seal-ring)"
          strokeWidth="0.6"
          opacity="0.8"
        />
        {/* Decorative dotted ring */}
        <circle
          cx="50"
          cy="50"
          r="36"
          fill="none"
          stroke={GOLD}
          strokeWidth="0.4"
          strokeDasharray="0.5 2"
          opacity="0.6"
        />
      </svg>

      {/* Text overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="wewed-monogram text-gold-light leading-none"
          style={{ fontSize: size * 0.22 }}
        >
          C&amp;K
        </span>
        <span
          className="mt-1 font-sans tracking-[0.2em] text-champagne/80"
          style={{ fontSize: size * 0.1 }}
        >
          23.12.26
        </span>
      </div>
    </motion.div>
  )
}

/* ───────────────────────────────────────────────────────────
   FloralCorner
   An SVG floral corner decoration. Position via `className`
   (e.g. "absolute top-4 left-4"). Use `flip` to mirror.
   ─────────────────────────────────────────────────────────── */
export function FloralCorner({
  size = 80,
  className = '',
  flip = 'none',
}: {
  size?: number
  className?: string
  /** 'none' | 'x' (mirror horizontal) | 'y' (mirror vertical) | 'xy' (both) */
  flip?: 'none' | 'x' | 'y' | 'xy'
}) {
  const scaleX = flip === 'x' || flip === 'xy' ? -1 : 1
  const scaleY = flip === 'y' || flip === 'xy' ? -1 : 1
  const transformStyle: CSSProperties = {
    transform: `scale(${scaleX}, ${scaleY})`,
  }
  return (
    <motion.svg
      viewBox="0 0 80 80"
      width={size}
      height={size}
      className={className}
      style={transformStyle}
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <g fill="none" stroke={GOLD} strokeWidth="1" strokeLinecap="round">
        {/* Main stem from corner */}
        <path d="M4 4 C 20 14, 36 18, 56 22" />
        {/* Secondary stem */}
        <path d="M4 4 C 14 20, 18 36, 22 56" />
        {/* Leaf 1 */}
        <path
          d="M22 14 C 30 10, 38 14, 40 22 C 32 22, 24 20, 22 14 Z"
          fill={GOLD}
          fillOpacity="0.15"
        />
        {/* Leaf 2 */}
        <path
          d="M14 22 C 10 30, 14 38, 22 40 C 22 32, 20 24, 14 22 Z"
          fill={GOLD}
          fillOpacity="0.15"
        />
        {/* Small leaf */}
        <path
          d="M36 20 C 42 18, 48 22, 50 28 C 44 28, 38 26, 36 20 Z"
          fill={GOLD_LIGHT}
          fillOpacity="0.18"
        />
        {/* Bud */}
        <circle cx="56" cy="22" r="3" fill={GOLD} fillOpacity="0.5" />
        <circle cx="56" cy="22" r="1.5" fill={GOLD_LIGHT} />
        {/* Petals around bud */}
        <path d="M56 22 C 60 18, 64 18, 66 22" />
        <path d="M56 22 C 60 26, 64 26, 66 22" />
        {/* Small accents */}
        <circle cx="22" cy="56" r="2" fill={GOLD} fillOpacity="0.4" />
        <path d="M22 56 C 26 60, 30 62, 36 60" />
        {/* Tendrils */}
        <path d="M40 22 C 44 26, 44 30, 40 34" opacity="0.6" />
        <path d="M22 40 C 26 44, 30 44, 34 40" opacity="0.6" />
      </g>
    </motion.svg>
  )
}

/* ───────────────────────────────────────────────────────────
   GoldSparkle
   An animated sparkle/star burst for hover accents.
   Use `active` to control persistent vs hover-only.
   ─────────────────────────────────────────────────────────── */
export function GoldSparkle({
  size = 24,
  className = '',
  active = false,
  delay = 0,
}: {
  size?: number
  className?: string
  active?: boolean
  delay?: number
}) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0, rotate: -45 }}
      animate={
        active
          ? {
              opacity: [0, 1, 0.6, 1],
              scale: [0, 1.1, 0.95, 1],
              rotate: [-45, 0],
            }
          : { opacity: 0, scale: 0 }
      }
      transition={{
        duration: 1.2,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      <defs>
        <linearGradient id={`sparkle-grad-${size}-${delay}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={GOLD_LIGHT} />
          <stop offset="100%" stopColor={GOLD} />
        </linearGradient>
      </defs>
      {/* Four-point star burst */}
      <path
        d="M12 0 L13.8 10.2 L24 12 L13.8 13.8 L12 24 L10.2 13.8 L0 12 L10.2 10.2 Z"
        fill={`url(#sparkle-grad-${size}-${delay})`}
      />
      {/* Center highlight */}
      <circle cx="12" cy="12" r="1.6" fill="#FFFFFF" fillOpacity="0.7" />
    </motion.svg>
  )
}

/* ───────────────────────────────────────────────────────────
   SectionTransition
   A smooth gradient transition strip between sections.
   `from` / `to` accept 'champagne' | 'espresso' | 'transparent'.
   ─────────────────────────────────────────────────────────── */
const TRANSITION_COLORS: Record<string, string> = {
  champagne: '#FBF6EE',
  espresso: '#1A1410',
  transparent: 'transparent',
  plum: '#6B2D3A',
  gold: '#BF9B5F',
}

export function SectionTransition({
  from = 'champagne',
  to = 'champagne',
  height = 48,
  className = '',
}: {
  from?: keyof typeof TRANSITION_COLORS | string
  to?: keyof typeof TRANSITION_COLORS | string
  height?: number
  className?: string
}) {
  const fromColor = TRANSITION_COLORS[from] ?? from
  const toColor = TRANSITION_COLORS[to] ?? to
  return (
    <div
      className={`pointer-events-none w-full ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 1200 ${height}`}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        className="block"
      >
        <defs>
          <linearGradient
            id={`wewed-transition-${from}-${to}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={fromColor} stopOpacity="1" />
            <stop offset="100%" stopColor={toColor} stopOpacity="1" />
          </linearGradient>
          {/* Subtle gold hairline in middle */}
          <linearGradient
            id={`wewed-transition-line-${from}-${to}`}
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <stop offset="0%" stopColor={GOLD} stopOpacity="0" />
            <stop offset="50%" stopColor={GOLD} stopOpacity="0.5" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect
          x="0"
          y="0"
          width="1200"
          height={height}
          fill={`url(#wewed-transition-${from}-${to})`}
        />
        <line
          x1="0"
          y1={height / 2}
          x2="1200"
          y2={height / 2}
          stroke={`url(#wewed-transition-line-${from}-${to})`}
          strokeWidth="0.5"
        />
      </svg>
    </div>
  )
}

/* ───────────────────────────────────────────────────────────
   Export bundle for convenient import
   ─────────────────────────────────────────────────────────── */
const DecorativeElements = {
  GoldOrnament,
  MonogramSeal,
  FloralCorner,
  GoldSparkle,
  SectionTransition,
}

export default DecorativeElements
