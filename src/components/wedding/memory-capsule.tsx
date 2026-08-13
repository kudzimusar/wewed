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
  Loader2,
  AlertCircle,
  Video,
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

function preferredMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export function MemoryCapsule({ canRecord = false }: { canRecord?: boolean }) {
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
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const cancellingRef = useRef(false)

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }

  const stopStream = () => {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop()
    streamRef.current = null
  }

  const revokePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl('')
  }

  useEffect(() => {
    setCollected(initialCount)
  }, [initialCount, ctx?.slug])

  useEffect(() => {
    return () => {
      clearTimer()
      if (recorderRef.current?.state === 'recording') {
        cancellingRef.current = true
        recorderRef.current.stop()
      }
      stopStream()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // previewUrl is intentionally included so the latest object URL is revoked.
  }, [previewUrl])

  const resetCapture = () => {
    clearTimer()
    stopStream()
    revokePreview()
    setRecordedBlob(null)
    setSeconds(0)
    setError(null)
    setState('idle')
  }

  const startRecording = async () => {
    if (!canRecord) {
      setError('Open a verified wedding invitation or authorised wedding account to record a capsule message.')
      return
    }
    if (!ctx?.slug) {
      setError('Wedding context is unavailable. Refresh this wedding page and try again.')
      return
    }
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setError('This browser does not support in-page video recording. You can still use the wedding photo/video upload section.')
      return
    }

    clearTimer()
    stopStream()
    revokePreview()
    setRecordedBlob(null)
    setError(null)
    setSeconds(0)
    chunksRef.current = []
    cancellingRef.current = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      })
      streamRef.current = stream
      const mimeType = preferredMimeType()
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 1_500_000,
        audioBitsPerSecond: 96_000,
      })
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        clearTimer()
        stopStream()
        setError('Recording stopped unexpectedly. Please try again or use the wedding upload section.')
        setState('idle')
      }
      recorder.onstop = () => {
        clearTimer()
        stopStream()
        recorderRef.current = null
        if (cancellingRef.current) {
          cancellingRef.current = false
          chunksRef.current = []
          return
        }
        const type = recorder.mimeType || mimeType || 'video/webm'
        const blob = new Blob(chunksRef.current, { type })
        chunksRef.current = []
        if (blob.size === 0) {
          setError('No video data was captured. Please try recording again.')
          setState('idle')
          return
        }
        setRecordedBlob(blob)
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        setState('preview')
      }

      recorder.start(250)
      setState('recording')
      timerRef.current = setInterval(() => {
        setSeconds((value) => {
          const next = value + 1
          if (next >= recordDuration) {
            clearTimer()
            if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
            return recordDuration
          }
          return next
        })
      }, 1000)
    } catch (caught) {
      clearTimer()
      stopStream()
      const name = caught instanceof DOMException ? caught.name : ''
      setError(
        name === 'NotAllowedError'
          ? 'Camera and microphone permission was not granted. Allow access to record, or use the wedding upload section instead.'
          : caught instanceof Error
            ? caught.message
            : 'Camera or microphone access is unavailable.',
      )
      setState('idle')
    }
  }

  const cancelRecording = () => {
    clearTimer()
    cancellingRef.current = true
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    else stopStream()
    setSeconds(0)
    setState('idle')
  }

  const sendToCapsule = async () => {
    if (!canRecord || !ctx?.slug || !recordedBlob) return
    setSending(true)
    setError(null)
    try {
      const extension = recordedBlob.type.includes('webm') ? 'webm' : 'webm'
      const file = new File(
        [recordedBlob],
        `memory-capsule-${Date.now()}.${extension}`,
        { type: recordedBlob.type || 'video/webm' },
      )
      const form = new FormData()
      form.append('slug', ctx.slug)
      form.append('file', file)
      form.append('caption', `Memory capsule message for ${names}`)
      form.append('moment', 'candid')

      const response = await fetch('/api/media', { method: 'POST', body: form })
      const body = (await response.json().catch(() => null)) as {
        success?: boolean
        error?: string
      } | null
      if (!response.ok || !body?.success) {
        throw new Error(body?.error || 'The capsule video could not be submitted.')
      }

      setState('sent')
      setCollected((value) => value + 1)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The capsule video could not be submitted.')
    } finally {
      setSending(false)
    }
  }

  const progress = seconds / recordDuration
  const mmss = (value: number) =>
    `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
  const footerMark = [wedding?.monogram || names, compactWeddingDate(wedding?.date)]
    .filter(Boolean)
    .join(' · ')

  return (
    <section id="capsule" data-classic-section="memory-capsule" className="wewed-section py-20 md:py-32">
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
              {!canRecord && (
                <div
                  data-testid="memory-capsule-locked-notice"
                  className="mb-6 flex items-center gap-2 rounded-xl border border-plum/20 bg-plum/5 px-4 py-3 font-sans text-xs leading-5 text-plum"
                >
                  <Lock className="size-4 shrink-0" />
                  The capsule stays visible as part of the wedding story. Recording requires a verified invitation or authorised wedding account.
                </div>
              )}

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
                      onClick={() => void startRecording()}
                      disabled={!canRecord}
                      whileHover={canRecord ? { scale: 1.04 } : undefined}
                      whileTap={canRecord ? { scale: 0.96 } : undefined}
                      className="group relative flex size-24 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-75"
                      aria-label={canRecord ? 'Start recording your message' : 'Recording requires verified wedding access'}
                      data-testid="memory-capsule-record"
                    >
                      <span className="absolute inset-0 rounded-full bg-gold/20" />
                      <span className="absolute inset-0 rounded-full bg-gold/30 blur-md" />
                      <span className="wewed-pulse-dot absolute inset-2 rounded-full border-2 border-gold/40" />
                      <span className="relative flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold-muted shadow-lg">
                        {canRecord ? <Mic className="size-7 text-espresso" /> : <Lock className="size-7 text-espresso" />}
                      </span>
                    </motion.button>

                    <div className="text-center">
                      <p className="wewed-heading text-xl text-espresso">
                        {canRecord ? 'Tap to record your message' : 'The capsule is ready for invited guests'}
                      </p>
                      <p className="mt-1 font-sans text-xs text-muted-foreground">
                        {canRecord
                          ? `You’ll have ${recordDuration} seconds. Camera and microphone permission is requested only when you tap record.`
                          : 'Open your personal invitation to add your own video message.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
                      <Clock className="size-3.5 text-gold" />
                      <span>00:00 / {mmss(recordDuration)}</span>
                    </div>

                    <Badge variant="outline" className="border-plum/30 bg-plum/5 font-sans text-[10px] text-plum">
                      <Lock className="mr-1 size-2.5" />
                      Sealed until {revealDate}
                    </Badge>
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
                      <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-clay">Recording</span>
                    </div>
                    <div className="relative flex items-center justify-center">
                      <ProgressRing progress={progress} />
                      <span className="absolute font-mono text-sm font-medium text-espresso">{mmss(seconds)}</span>
                    </div>
                    <p className="font-sans text-xs text-muted-foreground">
                      {Math.max(0, recordDuration - seconds)} second{recordDuration - seconds === 1 ? '' : 's'} remaining
                    </p>
                    <Button onClick={cancelRecording} variant="outline" className="border-plum/30 font-sans text-xs text-plum hover:bg-plum/10">
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
                    data-testid="memory-capsule-preview"
                  >
                    {previewUrl ? (
                      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-plum/20 bg-espresso shadow-lg">
                        <video src={previewUrl} controls playsInline className="aspect-video w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex size-16 items-center justify-center rounded-full bg-plum/10">
                        <Play className="size-7 translate-x-0.5 text-plum" fill="currentColor" />
                      </div>
                    )}
                    <div className="text-center">
                      <p className="wewed-heading text-xl text-espresso">Your message is ready</p>
                      <p className="mt-1 font-sans text-xs text-muted-foreground">
                        Review the real recording, then submit it to this wedding&apos;s media pipeline.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button onClick={resetCapture} disabled={sending} variant="outline" className="border-plum/30 font-sans text-xs text-plum hover:bg-plum/10">
                        <RefreshCw className="size-3.5" /> Re-record
                      </Button>
                      <Button onClick={() => void sendToCapsule()} disabled={sending || !recordedBlob} className="bg-plum font-sans text-xs text-champagne hover:bg-plum-light">
                        {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                        {sending ? 'Submitting…' : 'Send to Capsule'}
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
                        Your recorded video was accepted by {names}&apos; wedding media service and is marked for the memory capsule around{' '}
                        <span className="font-medium text-espresso">{revealDate}</span>.
                      </p>
                    </div>
                    <Button onClick={resetCapture} variant="outline" className="border-plum/30 font-sans text-xs text-plum hover:bg-plum/10">
                      <Mic className="size-3.5" /> Record Another
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-clay/20 bg-clay/5 px-4 py-3 font-sans text-xs leading-5 text-clay">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

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
                        <Avatar key={contributor.name} className="size-7 border-2 border-champagne blur-[1.5px]">
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
          {footerMark && <p className="mt-6 wewed-monogram text-xs tracking-widest">{footerMark}</p>}
          <p className="mt-3 inline-flex items-center gap-1.5 font-sans text-[10px] text-muted-foreground">
            <Video className="size-3" /> Browser video capture · wedding-scoped submission
          </p>
        </motion.div>
      </div>
    </section>
  )
}
