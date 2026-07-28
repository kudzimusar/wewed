'use client'

import { motion } from 'framer-motion'
import { Shield, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ============================================================
   CanonSeal
   ------------------------------------------------------------
   A decorative wax-seal-style emblem marking a wedding as
   "Canon Sealed" — preserved forever.

   Design:
     • Outer scalloped gold ring (embossed wax seal)
     • Inner radial gold gradient body
     • Curved top-arc text: "CANON SEALED · 23.12.26 · WEWED"
     • Curved bottom-arc text: "PRESERVED FOREVER"
     • Center shield with a star + monogram
     • Slow rotating shimmer overlay (gold-light)
     • Optional floating animation for hero/footer placement

   Usage:
     <CanonSeal size={120} />                       // static
     <CanonSeal size={96} floating className="…" /> // footer
     <CanonSeal size={140} showInfo showTagline />  // with text
   ============================================================ */

export interface CanonSealProps {
  /** Diameter in pixels. Default 96. */
  size?: number
  /** Floating animation (gentle bob). Default false. */
  floating?: boolean
  /** Show the "Canon Sealed" caption beneath the seal. */
  showCaption?: boolean
  /** Show the date tagline beneath the caption. */
  showTagline?: boolean
  /** Optional date string for the seal arc text. Default "23.12.26". */
  date?: string
  /** Optional monogram for the seal center. Default "C&K". */
  monogram?: string
  /** Extra classes on the wrapper. */
  className?: string
  /** Stagger entrance reveal. Default true. */
  reveal?: boolean
}

const GOLD = '#BF9B5F'
const GOLD_LIGHT = '#D8BC7E'
const GOLD_MUTED = '#A68B4B'
const ESPRESSO = '#1A1410'

export function CanonSeal({
  size = 96,
  floating = false,
  showCaption = false,
  showTagline = false,
  date = '23.12.26',
  monogram = 'C&K',
  className,
  reveal = true,
}: CanonSealProps) {
  return (
    <motion.div
      className={cn('inline-flex flex-col items-center', className)}
      initial={reveal ? { opacity: 0, scale: 0.85, rotate: -8 } : false}
      whileInView={reveal ? { opacity: 1, scale: 1, rotate: 0 } : undefined}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="relative inline-flex items-center justify-center"
        style={{ width: size, height: size }}
        animate={floating ? { y: [0, -6, 0] } : undefined}
        transition={
          floating
            ? { duration: 4.5, repeat: Infinity, ease: 'easeInOut' }
            : undefined
        }
      >
        {/* ─── SVG seal ──────────────────────────────────── */}
        <svg
          viewBox="0 0 120 120"
          width={size}
          height={size}
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label={`Canon Sealed · ${date} · wewed — preserved forever`}
          className="drop-shadow-[0_4px_12px_rgba(191,155,95,0.25)]"
        >
          <defs>
            {/* Wax-seal body gradient */}
            <radialGradient id="canon-seal-body" cx="50%" cy="38%" r="65%">
              <stop offset="0%" stopColor={GOLD_LIGHT} />
              <stop offset="45%" stopColor={GOLD} />
              <stop offset="85%" stopColor={GOLD_MUTED} />
              <stop offset="100%" stopColor="#8a7238" />
            </radialGradient>
            {/* Inner darker gold for depth */}
            <radialGradient id="canon-seal-inner" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#E8CC92" stopOpacity="0.9" />
              <stop offset="60%" stopColor={GOLD} stopOpacity="0.95" />
              <stop offset="100%" stopColor={GOLD_MUTED} stopOpacity="1" />
            </radialGradient>
            {/* Highlight gloss */}
            <linearGradient
              id="canon-seal-gloss"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
              <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.12" />
              <stop offset="80%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
            {/* Bottom inner shadow */}
            <radialGradient
              id="canon-seal-shadow"
              cx="50%"
              cy="80%"
              r="60%"
            >
              <stop offset="0%" stopColor="#000000" stopOpacity="0" />
              <stop offset="100%" stopColor="#3a2a14" stopOpacity="0.45" />
            </radialGradient>
            {/* Slow shimmer overlay */}
            <linearGradient
              id="canon-seal-shimmer"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="48%" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.4" />
              <stop offset="52%" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
            {/* Top-arc text path */}
            <path
              id="canon-seal-arc-top"
              d="M 16 60 A 44 44 0 0 1 104 60"
              fill="none"
            />
            {/* Bottom-arc text path */}
            <path
              id="canon-seal-arc-bot"
              d="M 22 70 A 38 38 0 0 0 98 70"
              fill="none"
            />
          </defs>

          {/* Scalloped wax-seal outer edge (24 bumps) */}
          <g>
            {Array.from({ length: 24 }).map((_, i) => {
              const angle = (i / 24) * Math.PI * 2
              const r1 = 56
              const r2 = 60
              const cx = 60 + Math.cos(angle) * r2
              const cy = 60 + Math.sin(angle) * r2
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={3}
                  fill={GOLD_MUTED}
                  opacity="0.7"
                />
              )
            })}
          </g>

          {/* Outer wax-seal disc */}
          <circle cx="60" cy="60" r="58" fill="url(#canon-seal-body)" />
          <circle
            cx="60"
            cy="60"
            r="58"
            fill="url(#canon-seal-shadow)"
          />
          {/* Inner gold ring */}
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="url(#canon-seal-inner)"
            stroke={GOLD_MUTED}
            strokeWidth="0.6"
          />
          {/* Dotted decorative ring */}
          <circle
            cx="60"
            cy="60"
            r="46"
            fill="none"
            stroke={ESPRESSO}
            strokeOpacity="0.25"
            strokeWidth="0.5"
            strokeDasharray="0.6 2"
          />
          {/* Inner hairline ring */}
          <circle
            cx="60"
            cy="60"
            r="38"
            fill="none"
            stroke={ESPRESSO}
            strokeOpacity="0.2"
            strokeWidth="0.4"
          />

          {/* Curved top-arc text */}
          <text
            fill={ESPRESSO}
            fontSize="6.2"
            fontFamily="var(--font-inter), sans-serif"
            fontWeight="600"
            letterSpacing="2.4"
          >
            <textPath
              href="#canon-seal-arc-top"
              startOffset="50%"
              textAnchor="middle"
            >
              {`CANON SEALED · ${date} · WEWED`}
            </textPath>
          </text>

          {/* Curved bottom-arc text */}
          <text
            fill={ESPRESSO}
            fillOpacity="0.7"
            fontSize="5"
            fontFamily="var(--font-inter), sans-serif"
            fontWeight="500"
            letterSpacing="3"
          >
            <textPath
              href="#canon-seal-arc-bot"
              startOffset="50%"
              textAnchor="middle"
            >
              PRESERVED FOREVER
            </textPath>
          </text>

          {/* Center shield + monogram */}
          <g transform="translate(60, 60)">
            {/* Shield backdrop */}
            <path
              d="M 0 -16 L 12 -12 L 12 2 C 12 9, 6 14, 0 17 C -6 14, -12 9, -12 2 L -12 -12 Z"
              fill={ESPRESSO}
              fillOpacity="0.92"
              stroke={GOLD_LIGHT}
              strokeWidth="0.8"
            />
            {/* Star accent */}
            <path
              d="M 0 -9 L 1.2 -5.2 L 5.2 -5.2 L 2 2.6 L 0 -0.4 L -2 2.6 L -5.2 -5.2 L -1.2 -5.2 Z"
              fill={GOLD_LIGHT}
              opacity="0.95"
            />
            {/* Monogram */}
            <text
              y="11"
              textAnchor="middle"
              fill={GOLD_LIGHT}
              fontSize="7"
              fontFamily="var(--font-cormorant), serif"
              fontWeight="500"
              letterSpacing="0.5"
            >
              {monogram}
            </text>
          </g>

          {/* Gloss highlight (top half) */}
          <ellipse
            cx="60"
            cy="36"
            rx="40"
            ry="20"
            fill="url(#canon-seal-gloss)"
            opacity="0.5"
          />

          {/* Slow shimmer overlay (rotating) */}
          <motion.g
            style={{ transformOrigin: '60px 60px' }}
            animate={{ rotate: 360 }}
            transition={{
              duration: 9,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <circle
              cx="60"
              cy="60"
              r="58"
              fill="url(#canon-seal-shimmer)"
              opacity="0.7"
            />
          </motion.g>
        </svg>

        {/* ─── Subtle pulsing glow ────────────────────────── */}
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            boxShadow: '0 0 0 0 rgba(191,155,95,0.4)',
          }}
          animate={{
            boxShadow: [
              '0 0 0 0 rgba(191,155,95,0.35)',
              '0 0 0 8px rgba(191,155,95,0)',
              '0 0 0 0 rgba(191,155,95,0)',
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' }}
        />
      </motion.div>

      {/* ─── Optional caption + tagline ──────────────────── */}
      {showCaption && (
        <motion.div
          initial={reveal ? { opacity: 0, y: 6 } : false}
          whileInView={reveal ? { opacity: 1, y: 0 } : undefined}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-4 flex flex-col items-center text-center"
        >
          <div className="flex items-center gap-1.5">
            <Shield
              size={14}
              strokeWidth={2}
              className="text-gold"
              aria-hidden="true"
            />
            <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
              Canon Sealed
            </span>
            <Sparkles
              size={12}
              strokeWidth={2}
              className="text-gold-light"
              aria-hidden="true"
            />
          </div>
          {showTagline && (
            <p className="mt-1.5 max-w-[18rem] font-sans text-xs leading-relaxed text-espresso/65 dark:text-champagne/55">
              This wedding has been sealed in the wewed Canon —
              preserved forever as a digital heirloom.
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}

export default CanonSeal
