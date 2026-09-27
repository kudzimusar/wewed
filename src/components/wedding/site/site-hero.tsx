'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useWeddingContext } from '@/components/wedding/wedding-data-provider'
import { displayableImageSrc, usePublishedCopy } from '@/components/wedding/site/primitives'
import { longWeddingDate, venueFullLine } from '@/lib/wedding-site/format'

const EASE = [0.22, 1, 0.36, 1] as const

type Remaining = { days: number; hours: number; minutes: number; past: boolean; today: boolean }

function remainingUntil(iso: string, now: number): Remaining | null {
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return null
  const diff = target - now
  const sameUtcDay = new Date(target).toISOString().slice(0, 10) === new Date(now).toISOString().slice(0, 10)
  const abs = Math.abs(diff)
  return {
    days: Math.floor(abs / 86_400_000),
    hours: Math.floor((abs / 3_600_000) % 24),
    minutes: Math.floor((abs / 60_000) % 60),
    past: diff <= 0 && !sameUtcDay,
    today: sameUtcDay,
  }
}

/**
 * The countdown renders nothing until the browser clock is known, so a future wedding can never
 * flash a "married"/after state during hydration.
 */
function HeroCountdown({ iso }: { iso: string }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const first = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, 30_000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [])
  if (now === null) return <div className="h-[5.5rem]" aria-hidden="true" />
  const left = remainingUntil(iso, now)
  if (!left) return null
  if (left.today) {
    return (
      <p className="font-serif text-xl italic text-gold sm:text-2xl" data-testid="hero-countdown">
        Today is the day
      </p>
    )
  }
  if (left.past) {
    return (
      <p className="font-serif text-lg italic text-champagne/80" data-testid="hero-countdown">
        Married {left.days} day{left.days === 1 ? '' : 's'} ago
      </p>
    )
  }
  const units: Array<[number, string]> = [
    [left.days, left.days === 1 ? 'Day' : 'Days'],
    [left.hours, left.hours === 1 ? 'Hour' : 'Hours'],
    [left.minutes, left.minutes === 1 ? 'Minute' : 'Minutes'],
  ]
  return (
    <div data-testid="hero-countdown" className="flex items-end justify-center gap-6 sm:gap-10" role="timer" aria-live="off"
      aria-label={`${left.days} days, ${left.hours} hours and ${left.minutes} minutes to go`}>
      {units.map(([value, label]) => (
        <div key={label} className="flex flex-col items-center">
          <span className="wewed-heading text-4xl font-light tabular-nums text-champagne sm:text-5xl">
            {String(value).padStart(2, '0')}
          </span>
          <span className="mt-2 font-sans text-[10px] uppercase tracking-[0.3em] text-gold/80">{label}</span>
        </div>
      ))}
    </div>
  )
}

export function SiteHero() {
  const { wedding } = useWeddingContext()
  const reduce = useReducedMotion()
  const imageUrl = usePublishedCopy('hero', 'imageUrl')
  if (!wedding) return null

  const dateLabel = longWeddingDate(wedding.date)
  const venueLine = venueFullLine(wedding)
  const heroImage = displayableImageSrc(imageUrl)

  const item = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.9, delay, ease: EASE },
        }

  return (
    <section
      id="home"
      aria-labelledby="home-heading"
      className="wewed-section relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-espresso px-5 pb-16 pt-28 text-center"
    >
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        {heroImage ? (
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            sizes="100vw"
            unoptimized={heroImage.startsWith('http')}
            className={`object-cover ${reduce ? '' : 'wewed-ken-burns'}`}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-espresso via-plum to-clay" />
        )}
        <div className="absolute inset-0 bg-espresso/65" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(191,155,95,0.16)_0%,_transparent_70%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-espresso/90 to-transparent" />
      </div>

      {wedding.monogram ? (
        <motion.p {...item(0.1)} className="wewed-monogram mb-8 text-sm tracking-[0.5em] text-gold" aria-hidden="true">
          {wedding.monogram}
        </motion.p>
      ) : null}

      <motion.h1
        {...item(0.35)}
        id="home-heading"
        className="wewed-heading text-balance text-5xl font-light leading-[1.05] text-champagne sm:text-7xl md:text-8xl"
      >
        <span className="block">{wedding.couple.partner1}</span>
        <span className="my-2 block font-serif text-3xl italic text-gold sm:text-4xl" aria-label="and">&amp;</span>
        <span className="block">{wedding.couple.partner2}</span>
      </motion.h1>

      <motion.div {...item(0.55)} className="mt-10 flex items-center gap-4" aria-hidden="true">
        <span className="h-px w-12 bg-gold/50 sm:w-20" />
        <span className="text-[10px] text-gold">&#9670;</span>
        <span className="h-px w-12 bg-gold/50 sm:w-20" />
      </motion.div>

      {dateLabel ? (
        <motion.p {...item(0.65)} className="mt-8 font-serif text-xl tracking-wide text-champagne sm:text-2xl">
          <time dateTime={wedding.date}>{dateLabel}</time>
        </motion.p>
      ) : null}
      {venueLine ? (
        <motion.p {...item(0.75)} className="mt-3 font-sans text-sm uppercase tracking-[0.22em] text-champagne/75">
          {venueLine}
        </motion.p>
      ) : null}
      {wedding.tagline ? (
        <motion.p {...item(0.85)} className="mx-auto mt-6 max-w-xl text-pretty font-serif text-lg italic text-gold/90">
          {wedding.tagline}
        </motion.p>
      ) : null}

      <motion.div {...item(1)} className="mt-12">
        <HeroCountdown iso={wedding.date} />
      </motion.div>

      <a
        href="#venue"
        className="absolute bottom-8 left-1/2 inline-flex min-h-11 min-w-11 -translate-x-1/2 items-center justify-center rounded-full text-champagne/60 transition-colors hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
        aria-label="Scroll to the wedding details"
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2v12m0 0L2 8m6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    </section>
  )
}
