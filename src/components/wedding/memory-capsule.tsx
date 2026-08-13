'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'
import {
  compactWeddingDate,
  coupleNames,
  formatWeddingDate,
} from '@/lib/wedding-template-defaults'

const DEFAULT_RECORD_DURATION = 10

type CapsuleState = 'idle' | 'recording' | 'preview' | 'sent'

function initialsFor(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '♥'
}

function ProgressRing({ progress }: { progress: number }) {
  const size = 56
  const stroke = 3
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress)
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
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

export function MemoryCapsule() {
  const ctx = useWeddingContextSafe()
  const wedding = ctx?.wedding
  const names = coupleNames(wedding)
  const revealDate =
    ctx?.getContent('memory', 'revealDate', formatWeddingDate(wedding?.date)) ||
    formatWeddingDate(wedding?.date) ||
    'the celebration'
  const heading =
    ctx?.getContent('memory', 'heading', 'Memory Time Capsule') ??
    'Memory Time Capsule'
  const subtitle =
    ctx?.getContent(
      'memory',
      'subtitle',
      `Leave a 10-second video message for ${names}. We’ll keep it with this wedding’s memories.`,
    ) ?? `Leave a 10-second video message for ${names}. We’ll keep it with this wedding’s memories.`

  const configuredDuration = Number.parseInt(
    ctx?.getContent('memory', 'recordDuration', String(DEFAULT_RECORD_DURATION)) ??
      String(DEFAULT_RECORD_DURATION),
    10,
  )
  const recordDuration =
    Number.isFinite(configuredDuration) && configuredDuration > 0 && configuredDuration <= 60
      ? configuredDuration
      : DEFAULT_RECORD_DURATION

  const baseCount = Number.parseInt(
    ctx?.getContent('memory', 'messageCount', '0') ?? '0',
    10,
  )
  const initialCount = Number.isFinite(baseCount) && baseCount >= 0 ? baseCount : 0

  const partyProfiles = ctx?.getOrdered('guests', 'party-') ?? []
  const contributors = useMemo(
    () =>
      partyProfiles.slice(0, 6).map((profile) => ({
        name: profile.value,
        initials: initialsFor(profile.value),
      })),
    [partyProfiles],
  )

  const [state, setState] = useState<CapsuleState>('idle')
  const [seconds, setSeconds] = useState(0)
  const [collected, setCollected] = useState(initialCount)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setCollected(initialCount)
  }, [initialCount, ctx?.slug])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startRecording = () => {
    setState('recording')
    setSeconds(0)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setSeconds((value) => {
        if (value + 1 >= recordDuration) {
          if (timerRef.current) clearInterval(timerRef.current)
          setState('preview')
          return recordDuration
        }
        return value + 1
      })
    }, 1000)
  }

  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setSeconds(0)
    setState('idle')
  }

  const sendToCapsule = () => {
    // The original premium component is a staged capture experience. Preserve
    // that interaction without claiming a binary video upload was persisted;
    // durable guest media continues to use the wedding-scoped upload surface.
    setState('sent')
    setCollected((value) => value + 1)
  }

  const reset = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setState('idle')
    setSeconds(0)
  }

  const progress = seconds / recordDuration
  const mmss = (value: number) =>
    `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
  const footerMark = [wedding?.monogram || names, compactWeddingDate(wedding?.date)]
    .filter(Boolean)
    .join(' · ')

  return (
    <section
      id="capsule"
      data-classic-section="memory-capsule"
      className="wewed-section py-20 md:py-32"
    >
      <div className="mx-auto max-w-3xl px-4">
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
              Sealed Until {revealDate}
            </span>
          </div>
          <h2 className="wewed-heading wewed-heading-accent text-4xl text-espresso md:text-5xl">
            {heading}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground md:text-base">
            {subtitle}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Card className="relative overflow-hidden border border-plum/30 bg-champagne shadow-md">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-plum/[0.04] via-transparent to-plum/[0.06]" />

            <CardContent className="relative p-6 md:p-10">
              <AnimatePresence mode="wait">
                {state === 'idle' && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex flex-col items-center gap-6 py-4"
                  >
                    <motion.button
                      type="button"
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
                        You&apos;ll have {recordDuration} seconds. Speak from the heart.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
                      <Clock className="size-3.5 text-gold" />
                      <span>00:00 / {mmss(recordDuration)}</span>
                    </div>

                    <SealedBadge revealDate={revealDate} />
                  </motion.div>
                )}

                {state === 'recording' && (
                  <motion.div
                    key="recording"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex flex-col items-center gap-5 py-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="wewed-pulse-dot inline-block size-2.5 rounded-full bg-clay" />
                      <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-clay">
                        Recording
                      </span>
                    </div>

                    <div className="relative flex items-center justify-center">
                      <ProgressRing progress={progress} />
                      <span className="absolute font-mono text-sm font-medium text-espresso">
                        {mmss(seconds)}
                      </span>
                    </div>

                    <p className="font-sans text-xs text-muted-foreground">
                      {recordDuration - seconds} second
                      {recordDuration - seconds === 1 ? '' : 's'} remaining
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

                {state === 'preview' && (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex flex-col items-center gap-5 py-4"
                  >
                    <div className="flex size-16 items-center justify-center rounded-full bg-plum/10">
                      <Play className="size-7 translate-x-0.5 text-plum" fill="currentColor" />
                    </div>

                    <div className="text-center">
                      <p className="wewed-heading text-xl text-espresso">Your message is ready</p>
                      <p className="mt-1 font-sans text-xs text-muted-foreground">
                        {mmss(recordDuration)} captured. Send it to be sealed in the capsule.
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
                      <p className="wewed-heading text-2xl text-espresso">Sealed with love 🤍</p>
                      <p className="mt-2 max-w-md font-sans text-sm leading-relaxed text-muted-foreground">
                        Your message is ready for the {names} memory capsule, marked for{' '}
                        <span className="font-medium text-espresso">{revealDate}</span>.
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

              <div className="mt-8 border-t border-plum/15 pt-6">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="size-4 text-gold" />
                    <p className="font-sans text-sm text-espresso">
                      <span className="wewed-heading text-lg text-plum">{collected}</span>{' '}
                      {collected === 1 ? 'message' : 'messages'} in the capsule
                    </p>
                  </div>

                  {contributors.length > 0 && (
                    <div className="flex items-center -space-x-2">
                      {contributors.slice(0, 5).map((contributor) => (
                        <Avatar
                          key={contributor.name}
                          className="size-7 border-2 border-champagne blur-[1.5px]"
                        >
                          <AvatarFallback className="bg-plum/10 font-sans text-[10px] text-plum">
                            {contributor.initials}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {collected > 5 && (
                        <div className="flex size-7 items-center justify-center rounded-full border-2 border-champagne bg-plum/10 font-sans text-[10px] text-plum">
                          +{Math.max(0, collected - 5)}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p className="mt-3 text-center font-sans text-[10px] text-muted-foreground sm:text-left">
                  Contributor identities stay softened in this teaser until the couple chooses how to reveal them.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          className="mt-10 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="wewed-divider mx-auto w-32" />
          {footerMark && (
            <p className="mt-6 wewed-monogram text-xs tracking-widest">{footerMark}</p>
          )}
        </motion.div>
      </div>
    </section>
  )
}

function SealedBadge({ revealDate }: { revealDate: string }) {
  return (
    <Badge
      variant="outline"
      className="border-plum/30 bg-plum/5 font-sans text-[10px] text-plum"
    >
      <Lock className="mr-1 size-2.5" />
      Sealed until {revealDate}
    </Badge>
  )
}
