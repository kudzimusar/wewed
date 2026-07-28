'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'qrcode'
import {
  QrCode,
  Scan,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  MessageSquare,
  Music,
  Camera,
  PartyPopper,
} from 'lucide-react'
import { useWewedStore } from '@/lib/store'
import { useWewedLive } from '@/lib/useWewedLive'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

/* ── Constants ── */

const WEDDING_DATE = new Date('2026-12-23T13:00:00+02:00') // 13:00 CAT, Harare
const CHECKIN_OPEN_DATE = new Date('2026-12-23T13:00:00+02:00')
const DEMO_TOKEN_URL = 'https://wewed.app/rsvp/charity-and-kudzie?token=ck-demo-2026'

/* ── Confetti burst (lightweight, no extra deps) ── */

function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 360,
        y: -(Math.random() * 320 + 80),
        rotate: (Math.random() - 0.5) * 540,
        delay: Math.random() * 0.15,
        color: ['#BF9B5F', '#C0633F', '#D8BC7E', '#6B2D3A', '#7C7A52'][i % 5],
        size: 6 + Math.random() * 6,
      })),
    []
  )
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center"
      aria-hidden
    >
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
          animate={{ opacity: 0, x: p.x, y: p.y, rotate: p.rotate }}
          transition={{ duration: 1.4, delay: p.delay, ease: 'easeOut' }}
          className="absolute top-1/3 size-2 rounded-[2px]"
          style={{ width: p.size, height: p.size * 0.6, background: p.color }}
        />
      ))}
    </div>
  )
}

/* ── Main QR Check-in ── */

type CheckinState = 'idle' | 'loading' | 'success'

export function QrCheckin() {
  const { lifecycle } = useWewedStore()
  const { isConnected, checkIn, checkedInCount } = useWewedLive()

  const [token, setToken] = useState('')
  const [guestName, setGuestName] = useState('')
  const [state, setState] = useState<CheckinState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [tableNumber, setTableNumber] = useState<number | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  // Time-based flags are computed client-side after mount to avoid
  // SSR/hydration mismatches when the visit is close to the wedding day.
  const [isAfterWedding, setIsAfterWedding] = useState(false)
  const [checkinOpen, setCheckinOpen] = useState(false)

  useEffect(() => {
    // Defer the time-based flag computation to avoid SSR/hydration mismatches
    // (Date.now() differs between server and client) and to keep the effect
    // body free of synchronous setState calls.
    const compute = () => {
      const now = Date.now()
      const after = now > WEDDING_DATE.getTime()
      const open =
        !after &&
        now >= CHECKIN_OPEN_DATE.getTime() &&
        now < CHECKIN_OPEN_DATE.getTime() + 36 * 3600 * 1000
      setIsAfterWedding(after)
      setCheckinOpen(open)
    }
    const id = setTimeout(compute, 0)
    return () => clearTimeout(id)
  }, [])

  // For the demo, treat socket connection as "active" signal for the OPEN pill.
  const showOpenPill = checkinOpen || isConnected

  // Generate a stylized demo QR for visual interest (uses the qrcode lib client-side)
  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(DEMO_TOKEN_URL, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 320,
      color: {
        dark: '#1A1410', // espresso
        light: '#FBF6EE00', // transparent
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        /* non-fatal: placeholder remains */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleCheckIn = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token.trim()) {
      setError('Please enter your RSVP token.')
      return
    }
    if (!guestName.trim()) {
      setError('Please enter your name so we can welcome you.')
      return
    }

    setState('loading')
    // Assign a friendly pseudo-random table for the demo
    const assignedTable = ((token.length + guestName.length) % 12) + 1
    checkIn(token.trim(), guestName.trim(), assignedTable)

    // Give the socket a brief moment to acknowledge before showing success
    setTimeout(() => {
      setTableNumber(assignedTable)
      setState('success')
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 1800)
    }, 700)
  }

  const resetCheckIn = () => {
    setState('idle')
    setToken('')
    setGuestName('')
    setError(null)
    setTableNumber(null)
    setShowConfetti(false)
  }

  return (
    <section id="checkin" className="wewed-section py-20 md:py-32">
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
            <QrCode className="size-4 text-gold" />
            <span className="font-sans text-xs uppercase tracking-[0.25em] text-gold-muted">
              Check-in at Imba Manor
            </span>
          </div>
          <h2 className="wewed-heading wewed-heading-accent text-4xl md:text-5xl text-espresso">
            Welcome to Imba Manor
          </h2>
          <p className="mt-4 font-sans text-sm md:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Scan your invitation QR code to check in and join the celebration live — unlock
            the photo wall, request songs, and send applause in real time.
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative"
        >
          {showConfetti && <ConfettiBurst />}

          <Card className="relative overflow-hidden border border-gold/40 bg-champagne shadow-md">
            {/* OPEN pill (only when check-in is active) */}
            {showOpenPill && !isAfterWedding && (
              <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-full border border-gold/40 bg-white/70 px-3 py-1 backdrop-blur-sm">
                <span className="wewed-pulse-dot inline-block size-2 rounded-full bg-clay" />
                <span className="font-sans text-[10px] font-semibold uppercase tracking-wider text-clay">
                  Open
                </span>
              </div>
            )}

            <CardContent className="p-6 md:p-10">
              {/* AFTER-WEDDING memory state */}
              {isAfterWedding || lifecycle === 'after' ? (
                <div className="flex flex-col items-center gap-5 py-6 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full bg-plum/10">
                    <PartyPopper className="size-7 text-plum" />
                  </div>
                  <div>
                    <h3 className="wewed-heading text-2xl md:text-3xl text-espresso">
                      Thank you for celebrating with us!
                    </h3>
                    <p className="mt-2 font-sans text-sm text-muted-foreground max-w-md">
                      The check-in is closed, but the memories live on. Visit the gallery,
                      guest wall, and keepsakes to relive every moment of December 23, 2026.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      asChild
                      className="bg-plum font-sans text-xs text-champagne hover:bg-plum-light"
                    >
                      <a href="#gallery">
                        <Camera className="size-3.5" />
                        Explore the Memories
                      </a>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="border-plum/30 font-sans text-xs text-plum hover:bg-plum/10"
                    >
                      <a href="#guestwall">
                        <MessageSquare className="size-3.5" />
                        Read the Guest Wall
                      </a>
                    </Button>
                  </div>
                </div>
              ) : state === 'success' ? (
                /* Success state */
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col items-center gap-5 py-4 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 14 }}
                    className="flex size-16 items-center justify-center rounded-full bg-gold/15"
                  >
                    <CheckCircle2 className="size-8 text-gold" />
                  </motion.div>

                  <div>
                    <h3 className="wewed-heading text-2xl md:text-3xl text-espresso">
                      Welcome, {guestName.split(' ')[0]}! 🎉
                    </h3>
                    <p className="mt-2 font-sans text-sm text-muted-foreground max-w-md leading-relaxed">
                      <span className="wewed-heading text-espresso">
                        Charity &amp; Kudzie
                      </span>{' '}
                      are so glad you&apos;re here. Find your seat, grab a drink, and let&apos;s
                      celebrate forever.
                    </p>
                  </div>

                  {tableNumber !== null && (
                    <div className="flex items-center gap-3 rounded-full border border-gold/30 bg-white/60 px-5 py-2">
                      <span className="font-sans text-xs text-muted-foreground">
                        Your table
                      </span>
                      <span className="wewed-heading text-2xl text-clay">
                        {tableNumber}
                      </span>
                    </div>
                  )}

                  <Separator className="my-2 bg-gold/20" />

                  {/* Quick links */}
                  <div className="w-full">
                    <p className="mb-3 font-sans text-xs uppercase tracking-wider text-muted-foreground">
                      Jump into the celebration
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <QuickLink
                        href="#livewall"
                        icon={<MessageSquare className="size-4" />}
                        label="View Live Wall"
                      />
                      <QuickLink
                        href="#songbook"
                        icon={<Music className="size-4" />}
                        label="Request a Song"
                      />
                      <QuickLink
                        href="#livewall"
                        icon={<Camera className="size-4" />}
                        label="Share a Photo"
                      />
                    </div>
                  </div>

                  <button
                    onClick={resetCheckIn}
                    className="mt-2 font-sans text-[11px] text-muted-foreground underline-offset-2 hover:text-espresso hover:underline"
                  >
                    Check in another guest
                  </button>
                </motion.div>
              ) : (
                /* Idle / form state */
                <div className="grid gap-8 md:grid-cols-2 md:items-center">
                  {/* QR code visual */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative rounded-xl border border-gold/30 bg-white/80 p-4 shadow-sm">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="Sample RSVP QR code"
                          className="size-44 md:size-52"
                        />
                      ) : (
                        <div className="flex size-44 items-center justify-center md:size-52">
                          <QrCode className="size-24 text-gold/40" />
                        </div>
                      )}
                      {/* Center monogram overlay */}
                      <div className="absolute left-1/2 top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border border-gold/40 bg-champagne">
                        <span className="wewed-monogram text-[10px]">C&amp;K</span>
                      </div>
                    </div>
                    <p className="flex items-center gap-1.5 font-sans text-[11px] text-muted-foreground">
                      <Scan className="size-3" />
                      Point your camera at the QR on your invitation
                    </p>
                  </div>

                  {/* Manual entry form */}
                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <Sparkles className="size-4 text-gold" />
                      <h3 className="wewed-heading text-xl text-espresso">
                        Check In
                      </h3>
                    </div>

                    {checkinOpen ? (
                      <p className="mb-4 font-sans text-xs text-sage">
                        Check-in is open at Imba Manor — {checkedInCount} guest
                        {checkedInCount === 1 ? '' : 's'} already here.
                      </p>
                    ) : (
                      <div className="mb-4 flex items-start gap-2 rounded-lg border border-gold/20 bg-white/50 p-3">
                        <Clock className="mt-0.5 size-3.5 shrink-0 text-gold" />
                        <p className="font-sans text-xs text-muted-foreground">
                          Check-in opens on{' '}
                          <span className="font-medium text-espresso">
                            December 23, 2026 at 13:00
                          </span>{' '}
                          (Harare time). You can preview the form below.
                        </p>
                      </div>
                    )}

                    <form onSubmit={handleCheckIn} className="space-y-3">
                      <div>
                        <label
                          htmlFor="checkin-name"
                          className="mb-1 block font-sans text-[11px] uppercase tracking-wider text-muted-foreground"
                        >
                          Your name
                        </label>
                        <Input
                          id="checkin-name"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder="e.g. Tendai Moyo"
                          className="border-gold/30 bg-white/80 font-sans text-sm placeholder:text-muted-foreground/60 focus:border-gold focus:ring-gold/20"
                          maxLength={60}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="checkin-token"
                          className="mb-1 block font-sans text-[11px] uppercase tracking-wider text-muted-foreground"
                        >
                          RSVP token
                        </label>
                        <Input
                          id="checkin-token"
                          value={token}
                          onChange={(e) => setToken(e.target.value)}
                          placeholder="e.g. ck-xxxx-xxxx"
                          className="border-gold/30 bg-white/80 font-sans text-sm font-mono placeholder:text-muted-foreground/60 focus:border-gold focus:ring-gold/20"
                          maxLength={80}
                        />
                      </div>

                      {error && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="font-sans text-xs text-clay"
                        >
                          {error}
                        </motion.p>
                      )}

                      <Button
                        type="submit"
                        disabled={state === 'loading'}
                        className="w-full bg-gold font-sans text-sm text-espresso hover:bg-gold-light"
                      >
                        {state === 'loading' ? (
                          <>
                            <span className="mr-1 inline-block size-3 animate-spin rounded-full border-2 border-espresso/40 border-t-espresso" />
                            Checking in…
                          </>
                        ) : (
                          <>
                            <QrCode className="size-4" />
                            Check In
                          </>
                        )}
                      </Button>
                    </form>

                    <p className="mt-3 text-center font-sans text-[10px] text-muted-foreground">
                      Lost your token? Ask the welcome desk at Imba Manor.
                    </p>
                  </div>
                </div>
              )}

              {/* Live connection hint */}
              {!isAfterWedding && lifecycle !== 'after' && state !== 'success' && (
                <div className="mt-6 flex items-center justify-center gap-2 border-t border-gold/15 pt-4">
                  <span
                    className={`inline-block size-1.5 rounded-full ${
                      isConnected ? 'bg-gold' : 'bg-muted-foreground/40'
                    }`}
                  />
                  <span className="font-sans text-[10px] text-muted-foreground">
                    {isConnected
                      ? 'Live celebration feed is connected'
                      : 'Connecting to the live feed…'}
                  </span>
                </div>
              )}
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

/* ── Quick Link Button ── */

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <a
      href={href}
      className="group flex items-center justify-between gap-2 rounded-lg border border-gold/20 bg-white/60 px-3 py-2.5 font-sans text-xs text-espresso transition-all hover:border-gold/40 hover:bg-white/90"
    >
      <span className="flex items-center gap-2">
        <span className="text-gold">{icon}</span>
        {label}
      </span>
      <ArrowRight className="size-3 text-gold-muted transition-transform group-hover:translate-x-0.5" />
    </a>
  )
}
