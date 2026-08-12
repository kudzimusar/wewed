'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Radio, ArrowDown, Heart, Users } from 'lucide-react'
import { useWewedLive } from '@/lib/useWewedLive'
import { useWewedStore } from '@/lib/store'
import { Songbook } from '@/components/wedding/songbook'
import { SongbookLive } from '@/components/wedding/songbook-live'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'

export function SongbookEnhanced() {
  const { isConnected, songVotes } = useWewedLive()
  const { musicVotes } = useWewedStore()
  const ctx = useWeddingContextSafe()
  const venue = ctx?.wedding?.venue || 'the celebration'

  const localVoteCount = Object.values(musicVotes).filter((v) => v > 0).length
  const liveTotalVotes = songVotes.reduce((sum, s) => sum + s.votes, 0)
  const totalVotes = liveTotalVotes + localVoteCount
  const bannerRef = useRef<HTMLDivElement>(null)
  const inView = useInView(bannerRef, { once: true, margin: '-80px' })

  const scrollToLive = () => {
    if (typeof document === 'undefined') return
    document.getElementById('songbook-live')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="relative">
      <motion.div
        ref={bannerRef}
        initial={{ opacity: 0, y: -12 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="mx-auto mb-8 max-w-3xl px-4"
      >
        <div className={`relative flex flex-col items-stretch gap-3 overflow-hidden rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 ${isConnected ? 'border-gold/30 bg-gradient-to-r from-gold/[0.06] via-champagne/60 to-gold/[0.06]' : 'border-gold/15 bg-champagne/50'}`}>
          <span className={`absolute left-0 top-0 h-full w-[3px] ${isConnected ? 'bg-gradient-to-b from-gold via-clay to-gold' : 'bg-gradient-to-b from-gold/40 to-gold/10'}`} aria-hidden="true" />

          <div className="flex items-center gap-3">
            {isConnected ? (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold/15">
                <span className="relative flex size-2.5">
                  <span className="wewed-pulse-dot absolute inline-flex size-full rounded-full bg-clay/60" />
                  <span className="relative inline-flex size-2 rounded-full bg-clay" />
                </span>
              </span>
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold/10"><Radio className="size-4 text-gold-muted" /></span>
            )}
            <div>
              <p className="wewed-heading text-base leading-tight text-espresso sm:text-lg">{isConnected ? 'Live voting is OPEN' : 'Build the wedding soundtrack'}</p>
              <p className="font-sans text-xs text-muted-foreground">{isConnected ? 'Tap the heart on any song — your vote appears on the live list.' : 'Vote for favourites now; live rankings appear when the wedding voting service is connected.'}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-5">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1">
                  <Heart className={`size-3.5 ${totalVotes > 0 ? 'fill-clay text-clay' : 'text-muted-foreground/60'}`} />
                  <motion.span key={totalVotes} initial={{ scale: 1.2 }} animate={{ scale: 1 }} transition={{ duration: 0.35 }} className="wewed-heading text-lg leading-none">{totalVotes}</motion.span>
                </div>
                <span className="font-sans text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{totalVotes === 1 ? 'vote' : 'votes'}</span>
              </div>
              {isConnected && <div className="hidden h-8 w-px bg-gold/20 sm:block" />}
              {isConnected && (
                <div className="hidden flex-col items-center sm:flex">
                  <div className="flex items-center gap-1"><Users className="size-3.5 text-gold-muted" /><span className="wewed-heading text-lg leading-none text-espresso">{songVotes.length}</span></div>
                  <span className="font-sans text-[9px] uppercase tracking-[0.15em] text-muted-foreground">songs</span>
                </div>
              )}
            </div>
            <button onClick={scrollToLive} className="group/btn flex items-center gap-1.5 rounded-full border border-gold/40 bg-white/70 px-3 py-1.5 font-sans text-xs font-medium text-espresso transition-all hover:border-gold hover:bg-gold/10" aria-label="View live song rankings">
              Live Rankings <ArrowDown className="size-3 transition-transform group-hover/btn:translate-y-0.5" />
            </button>
          </div>
        </div>
      </motion.div>

      <Songbook />

      <motion.section
        id="songbook-live"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="mx-auto max-w-4xl scroll-mt-20 px-4 py-16 md:py-20"
        aria-label="Live song rankings"
      >
        <div className="mb-8 text-center">
          <p className="wewed-monogram mb-2 text-xs uppercase tracking-[0.2em] text-gold-muted">Real-time</p>
          <h3 className="wewed-heading text-3xl text-espresso md:text-4xl">What the floor is dancing to</h3>
          <p className="mt-2 font-sans text-sm text-muted-foreground">Live guest votes for {venue}, when real-time voting is active.</p>
        </div>
        <div className="mx-auto max-w-md"><SongbookLive /></div>
      </motion.section>
    </div>
  )
}

export default SongbookEnhanced
