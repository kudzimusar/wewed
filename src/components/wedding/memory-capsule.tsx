'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  Lock,
  Clock,
  Send,
  CheckCircle2,
  Sparkles,
  Play,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

/* ── Constants ── */

const RECORD_DURATION = 10 // seconds
const WEDDING_REVEAL_DATE = 'December 23, 2026'

/* ── Sample capsule contributors (teaser, blurred) ── */

const sampleContributors = [
  { name: 'Tendai M.', initials: 'TM' },
  { name: 'Rumbidzai C.', initials: 'RC' },
  { name: 'Takudzwa M.', initials: 'TM' },
  { name: 'Chiedza K.', initials: 'CK' },
  { name: 'Munashe M.', initials: 'MM' },
  { name: 'Nyasha D.', initials: 'ND' },
]

/* ── Recording progress ring ── */

function ProgressRing({ progress }: { progress: number }) {
  // progress: 0 → 1
  const size = 56
  const stroke = 3
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress)
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(191,155,95,0.2)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#BF9B5F"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.2s linear' }}
      />
    </svg>
  )
}

/* ── Main Memory Capsule ── */

type CapsuleState = 'idle' | 'recording' | 'preview' | 'sent'

export function MemoryCapsule() {
  const [state, setState] = useState<CapsuleState>('idle')
  const [seconds, setSeconds] = useState(0)
  const [collected, setCollected] = useState(47) // sample count
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup any running timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startRecording = () => {
    setState('recording')
    setSeconds(0)
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= RECORD_DURATION) {
          if (timerRef.current) clearInterval(timerRef.current)
          setState('preview')
          return RECORD_DURATION
        }
        return s + 1
      })
    }, 1000)
  }

  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setSeconds(0)
    setState('idle')
  }

  const sendToCapsule = () => {
    setState('sent')
    setCollected((c) => c + 1)
  }

  const reset = () => {
    setState('idle')
    setSeconds(0)
  }

  const progress = seconds / RECORD_DURATION
  const mmss = (n: number) =>
    `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

  return (
    <section id="capsule" className="wewed-section py-20 md:py-32">
      <div className="mx-auto max-w-3xl px-4">
        {/* Heading */}
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
        >
          <div className="mb-3 flex items-center justify-center gap-2">
            <Lock className="size-4 text-plum" />
            <span className="font-sans text-xs uppercase tracking-[0.25em] text-plum">
              Sealed Until {WEDDING_REVEAL_DATE}
            </span>
          </div>
          <h2 className="wewed-heading wewed-heading-accent text-4xl md:text-5xl text-espresso">
            Memory Time Capsule
          </h2>
          <p className="mt-4 font-sans text-sm md:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Leave a 10-second video message for Charity &amp; Kudzie. We&apos;ll play them at
            the reception and keep them forever.
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Card className="relative overflow-hidden border border-plum/30 bg-champagne shadow-md">
            {/* Plum accent gradient */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-plum/[0.04] via-transparent to-plum/[0.06]" />

            <CardContent className="relative p-6 md:p-10">
              <AnimatePresence mode="wait">
                {/* IDLE — record prompt */}
                {state === 'idle' && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex flex-col items-center gap-6 py-4"
                  >
                    {/* Record button */}
                    <motion.button
                      onClick={startRecording}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      className="group relative flex size-24 items-center justify-center rounded-full"
                      aria-label="Start recording your message"
                    >
                      <span className="absolute inset-0 rounded-full bg-gold/20" />
                      <span className="absolute inset-0 rounded-full bg-gold/30 blur-md" />
                      <span className="wewed-pulse-dot absolute inset-2 rounded-full border-2 border-gold/40" />
                      <span className="relative flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-muted shadow-lg">
                        <Mic className="size-7 text-espresso" />
                      </span>
                    </motion.button>

                    <div className="text-center">
                      <p className="wewed-heading text-xl text-espresso">
                        Tap to record your message
                      </p>
                      <p className="mt-1 font-sans text-xs text-muted-foreground">
                        You&apos;ll have {RECORD_DURATION} seconds. Speak from the heart.
                      </p>
                    </div>

                    {/* Timer preview */}
                    <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
                      <Clock className="size-3.5 text-gold" />
                      <span>00:00 / 00:{String(RECORD_DURATION).padStart(2, '0')}</span>
                    </div>

                    <SealedBadge />
                  </motion.div>
                )}

                {/* RECORDING — live indicator */}
                {state === 'recording' && (
                  <motion.div
                    key="recording"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex flex-col items-center gap-5 py-4"
                  >
                    {/* REC indicator */}
                    <div className="flex items-center gap-2">
                      <span className="wewed-pulse-dot inline-block size-2.5 rounded-full bg-clay" />
                      <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-clay">
                        Recording
                      </span>
                    </div>

                    {/* Progress ring + counter */}
                    <div className="relative flex items-center justify-center">
                      <ProgressRing progress={progress} />
                      <span className="absolute font-mono text-sm font-medium text-espresso">
                        {mmss(seconds)}
                      </span>
                    </div>

                    <p className="font-sans text-xs text-muted-foreground">
                      {RECORD_DURATION - seconds} second
                      {RECORD_DURATION - seconds === 1 ? '' : 's'} remaining
                    </p>

                    <Button
                      onClick={cancelRecording}
                      variant="outline"
                      className="border-plum/30 font-sans text-xs text-plum hover:bg-plum/10"
                    >
                      Cancel
                    </Button>
                  </motion.div>
                )}

                {/* PREVIEW — review & send */}
                {state === 'preview' && (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex flex-col items-center gap-5 py-4"
                  >
                    <div className="flex size-16 items-center justify-center rounded-full bg-plum/10">
                      <Play
                        className="size-7 translate-x-0.5 text-plum"
                        fill="currentColor"
                      />
                    </div>

                    <div className="text-center">
                      <p className="wewed-heading text-xl text-espresso">
                        Your message is ready
                      </p>
                      <p className="mt-1 font-sans text-xs text-muted-foreground">
                        {mmss(RECORD_DURATION)} captured. Send it to be sealed in the capsule.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button
                        onClick={reset}
                        variant="outline"
                        className="border-plum/30 font-sans text-xs text-plum hover:bg-plum/10"
                      >
                        <RefreshCw className="size-3.5" />
                        Re-record
                      </Button>
                      <Button
                        onClick={sendToCapsule}
                        className="bg-plum font-sans text-xs text-champagne hover:bg-plum-light"
                      >
                        <Send className="size-3.5" />
                        Send to Capsule
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* SENT — thank you */}
                {state === 'sent' && (
                  <motion.div
                    key="sent"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex flex-col items-center gap-5 py-4 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 14 }}
                      className="flex size-16 items-center justify-center rounded-full bg-plum/10"
                    >
                      <CheckCircle2 className="size-8 text-plum" />
                    </motion.div>

                    <div>
                      <p className="wewed-heading text-2xl text-espresso">
                        Sealed with love 🤍
                      </p>
                      <p className="mt-2 font-sans text-sm text-muted-foreground max-w-md leading-relaxed">
                        Your message will be revealed at the reception on{' '}
                        <span className="font-medium text-espresso">
                          {WEDDING_REVEAL_DATE}
                        </span>
                        . Thank you for adding your voice to our forever.
                      </p>
                    </div>

                    <Button
                      onClick={reset}
                      variant="outline"
                      className="border-plum/30 font-sans text-xs text-plum hover:bg-plum/10"
                    >
                      <Mic className="size-3.5" />
                      Record Another
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Capsule count + sample contributors */}
              <div className="mt-8 border-t border-plum/15 pt-6">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="size-4 text-gold" />
                    <p className="font-sans text-sm text-espresso">
                      <span className="wewed-heading text-lg text-plum">
                        {collected}
                      </span>{' '}
                      {collected === 1 ? 'message' : 'messages'} in the capsule
                    </p>
                  </div>

                  {/* Blurred avatars teaser */}
                  <div className="flex items-center -space-x-2">
                    {sampleContributors.slice(0, 5).map((c) => (
                      <Avatar
                        key={c.name}
                        className="size-7 border-2 border-champagne blur-[1.5px]"
                      >
                        <AvatarFallback className="bg-plum/10 font-sans text-[10px] text-plum">
                          {c.initials}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {collected > 5 && (
                      <div className="flex size-7 items-center justify-center rounded-full border-2 border-champagne bg-plum/10 font-sans text-[10px] text-plum">
                        +{collected - 5}
                      </div>
                    )}
                  </div>
                </div>

                <p className="mt-3 text-center font-sans text-[10px] text-muted-foreground sm:text-left">
                  Names shown blurred until the reveal. Don&apos;t worry — your message is
                  safe.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer monogram */}
        <motion.div
          className="mt-10 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="wewed-divider w-32 mx-auto" />
          <p className="mt-6 wewed-monogram text-xs tracking-widest">
            C&amp;K &middot; 23.12.26
          </p>
        </motion.div>
      </div>
    </section>
  )
}

/* ── Sealed badge ── */

function SealedBadge() {
  return (
    <Badge
      variant="outline"
      className="border-plum/30 bg-plum/5 font-sans text-[10px] text-plum"
    >
      <Lock className="mr-1 size-2.5" />
      Sealed until {WEDDING_REVEAL_DATE}
    </Badge>
  )
}
