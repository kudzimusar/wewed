'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, RotateCcw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DigitalInvitationCardData } from '@/components/wedding/digital-invitation-card'
import { IvoryFloralGoldTriFold } from '@/components/wedding/invitation-experience/ivory-floral-gold-trifold'
import {
  getInvitationCardStyleDefinition,
  type InvitationCardStyle,
  type InvitationMotionPreset,
} from '@/lib/digital-invitation-card'

type MotionState = 'closed' | 'opening' | 'open'

interface GuestSessionPayload {
  success?: boolean
  wedding?: {
    title: string
    monogram: string | null
    tagline: string | null
    date: string
    venue: string
    venueCity: string
    venueCountry: string
    primaryColor: string
    accentColor: string
    backgroundColor: string
    invitationCardMessage: string | null
    rsvpDeadline: string | null
  }
  guest?: { name: string }
}

export interface PremiumInvitationExperienceProps {
  slug?: string
  data: DigitalInvitationCardData
  style: InvitationCardStyle
  previewMode?: boolean
  previewDevice?: 'mobile' | 'desktop' | 'auto'
  reducedMotionOverride?: boolean
  personalizeFromGuestSession?: boolean
  onContinue?: () => void
}

function asDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value: string | Date): string {
  const date = asDate(value)
  if (!date) return String(value)
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatShortDate(value: string | Date): string {
  const date = asDate(value)
  if (!date) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date)
}

function fallbackMonogram(title: string): string {
  return title
    .split(/\s+&\s+|\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'W'
}

function atmosphereClass(atmosphere: string, open: boolean) {
  if (!open) return 'opacity-0'
  if (atmosphere === 'stars') return 'opacity-70'
  if (atmosphere === 'petals' || atmosphere === 'watercolour-bloom') return 'opacity-55'
  if (atmosphere === 'minimal') return 'opacity-15'
  return 'opacity-45'
}

function Atmosphere({
  atmosphere,
  primary,
  accent,
  open,
}: {
  atmosphere: string
  primary: string
  accent: string
  open: boolean
}) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-1000 ${atmosphereClass(atmosphere, open)}`}>
      <div
        className="absolute left-[12%] top-[16%] size-28 rounded-full blur-3xl sm:size-44"
        style={{ background: `${primary}55` }}
      />
      <div
        className="absolute bottom-[12%] right-[10%] size-36 rounded-full blur-3xl sm:size-56"
        style={{ background: `${accent}44` }}
      />
      {atmosphere === 'stars' && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(255,255,255,.7)_0_1px,transparent_1.5px),radial-gradient(circle_at_75%_18%,rgba(255,255,255,.5)_0_1px,transparent_1.5px),radial-gradient(circle_at_62%_72%,rgba(255,255,255,.55)_0_1px,transparent_1.5px),radial-gradient(circle_at_30%_80%,rgba(255,255,255,.4)_0_1px,transparent_1.5px)]" />
      )}
      {(atmosphere === 'petals' || atmosphere === 'watercolour-bloom') && (
        <>
          <span className="absolute left-[17%] top-[22%] h-7 w-4 rotate-[28deg] rounded-[100%_0_100%_0]" style={{ background: `${primary}77` }} />
          <span className="absolute right-[18%] top-[31%] h-6 w-3 -rotate-[34deg] rounded-[100%_0_100%_0]" style={{ background: `${accent}77` }} />
          <span className="absolute bottom-[20%] left-[27%] h-5 w-3 rotate-[48deg] rounded-[100%_0_100%_0]" style={{ background: `${primary}66` }} />
        </>
      )}
    </div>
  )
}

function CornerBotanical({ color, side }: { color: string; side: 'left' | 'right' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      className={`pointer-events-none absolute top-0 h-28 w-28 opacity-55 ${side === 'left' ? 'left-0' : 'right-0 -scale-x-100'}`}
      fill="none"
    >
      <path d="M4 116C26 73 45 42 105 8" stroke={color} strokeWidth="1.25" />
      <path d="M27 78c-10-1-18-7-21-18 12-1 20 5 21 18ZM45 56c-3-11 0-21 10-28 5 11 1 21-10 28ZM65 39c4-10 12-16 24-16-2 12-10 18-24 16ZM25 86c9-6 19-7 29-1-7 9-17 10-29 1Z" stroke={color} strokeWidth="1" />
      <circle cx="102" cy="10" r="4" stroke={color} />
    </svg>
  )
}

function CentreInvitation({
  data,
  compact = false,
  showGuest = true,
}: {
  data: DigitalInvitationCardData
  compact?: boolean
  showGuest?: boolean
}) {
  const location = [data.venueCity, data.venueCountry].filter(Boolean).join(', ')
  return (
    <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 py-7 text-center sm:px-7">
      <p className={`${compact ? 'text-[7px]' : 'text-[9px] sm:text-[10px]'} font-semibold uppercase tracking-[0.26em] opacity-75`}>
        Together with our families
      </p>
      <p className={`${compact ? 'mt-3 text-sm' : 'mt-5 text-lg sm:text-xl'} font-serif tracking-[0.14em]`}>
        {data.monogram || fallbackMonogram(data.title)}
      </p>
      {showGuest && data.guestName && (
        <p className={`${compact ? 'mt-4 text-[9px]' : 'mt-7 text-xs sm:text-sm'} italic opacity-70`}>
          Especially for {data.guestName}
        </p>
      )}
      <h2 className={`${compact ? 'mt-2 text-2xl' : 'mt-3 text-3xl sm:text-5xl'} font-serif leading-[0.95] tracking-[-0.035em]`}>
        {data.title}
      </h2>
      <p className={`${compact ? 'mt-3 text-[9px]' : 'mt-5 max-w-md text-xs leading-5 sm:text-sm'} opacity-80`}>
        {data.message || 'Request the pleasure of your company as we celebrate our marriage.'}
      </p>
      <p className={`${compact ? 'mt-4 text-xs' : 'mt-7 text-base sm:text-xl'} font-serif`}>{formatDate(data.date)}</p>
      <div className={`${compact ? 'my-2 w-10' : 'my-3 w-16'} h-px bg-current opacity-25`} />
      <p className={`${compact ? 'text-[9px]' : 'text-xs sm:text-sm'} font-semibold uppercase tracking-[0.18em]`}>{data.venue}</p>
      {location && <p className={`${compact ? 'mt-1 text-[8px]' : 'mt-2 text-xs'} opacity-60`}>{location}</p>}
      {data.rsvpDeadline && (
        <p data-testid="invitation-rsvp-deadline" className={`${compact ? 'mt-2 text-[8px]' : 'mt-3 text-xs'} font-semibold uppercase tracking-[0.14em] opacity-75`}>
          RSVP by {formatDate(data.rsvpDeadline)}
        </p>
      )}
    </div>
  )
}

function GenericMotionCard({
  data,
  motion,
  open,
  reducedMotion,
  paper,
  ink,
  primary,
  accent,
}: {
  data: DigitalInvitationCardData
  motion: InvitationMotionPreset
  open: boolean
  reducedMotion: boolean
  paper: string
  ink: string
  primary: string
  accent: string
}) {
  const duration = reducedMotion ? '0ms' : '1100ms'
  const baseCard = (
    <article className="relative mx-auto aspect-[4/5] w-full max-w-[430px] overflow-hidden rounded-[1.6rem] border p-3 shadow-2xl sm:p-5" style={{ background: paper, color: ink, borderColor: `${primary}88` }}>
      <CornerBotanical color={primary} side="left" />
      <CornerBotanical color={accent} side="right" />
      <CentreInvitation data={data} />
    </article>
  )

  if (motion === 'gate-fold') {
    return (
      <div className="relative mx-auto aspect-[4/5] w-full max-w-[430px] [perspective:1500px]">
        <div className="absolute inset-0">{baseCard}</div>
        <div aria-hidden="true" className="absolute inset-y-0 left-0 z-20 w-1/2 rounded-l-[1.6rem] border [transform-origin:0%_50%]" style={{ background: paper, borderColor: `${primary}88`, transform: open ? 'rotateY(-118deg)' : 'rotateY(0deg)', transition: `transform ${duration} cubic-bezier(.2,.75,.2,1)` }} />
        <div aria-hidden="true" className="absolute inset-y-0 right-0 z-20 w-1/2 rounded-r-[1.6rem] border [transform-origin:100%_50%]" style={{ background: paper, borderColor: `${primary}88`, transform: open ? 'rotateY(118deg)' : 'rotateY(0deg)', transition: `transform ${duration} cubic-bezier(.2,.75,.2,1)` }} />
      </div>
    )
  }

  if (motion === 'envelope-letter') {
    return (
      <div className="relative mx-auto h-[31rem] w-full max-w-[430px] overflow-hidden sm:h-[36rem]">
        <div aria-hidden="true" className="absolute bottom-0 left-1/2 h-[55%] w-[96%] -translate-x-1/2 rounded-3xl border shadow-2xl" style={{ background: primary, borderColor: `${accent}99` }} />
        <div className="absolute inset-x-0 bottom-4" style={{ transform: open ? 'translateY(-21%)' : 'translateY(38%) scale(.93)', transition: `transform ${duration} cubic-bezier(.2,.8,.2,1)` }}>{baseCard}</div>
        <div aria-hidden="true" className="absolute bottom-0 left-[2%] z-20 h-[31%] w-[96%] rounded-b-3xl" style={{ background: primary, clipPath: 'polygon(0 0,50% 68%,100% 0,100% 100%,0 100%)' }} />
      </div>
    )
  }

  if (motion === 'book-open') {
    return (
      <div className="relative mx-auto aspect-[8/5] w-full max-w-[760px] [perspective:1600px]">
        <div className="absolute inset-0 flex overflow-hidden rounded-[1.5rem] shadow-2xl" style={{ background: paper, color: ink }}>
          <div className="flex w-1/2 items-center justify-center border-r p-5" style={{ borderColor: `${primary}45` }}><p className="font-serif text-xl opacity-65 sm:text-3xl">{data.monogram || fallbackMonogram(data.title)}</p></div>
          <div className="w-1/2"><CentreInvitation data={data} compact /></div>
        </div>
        <div aria-hidden="true" className="absolute inset-y-0 left-1/2 z-20 w-1/2 rounded-r-[1.5rem] border [transform-origin:0%_50%]" style={{ background: paper, borderColor: `${primary}66`, transform: open ? 'rotateY(-165deg)' : 'rotateY(0deg)', transition: `transform ${duration} cubic-bezier(.2,.75,.2,1)` }} />
      </div>
    )
  }

  if (motion === 'sleeve-pull') {
    return (
      <div className="relative mx-auto h-[34rem] w-full max-w-[430px] overflow-hidden">
        <div style={{ transform: open ? 'translateY(-3%)' : 'translateY(18%)', transition: `transform ${duration}` }}>{baseCard}</div>
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 z-20 h-[58%] rounded-[1.6rem] border shadow-xl" style={{ background: primary, borderColor: `${accent}88`, transform: open ? 'translateY(78%)' : 'translateY(0)', transition: `transform ${duration} cubic-bezier(.2,.8,.2,1)` }} />
      </div>
    )
  }

  return (
    <div style={{ transform: open ? 'translateY(0) scale(1) rotateX(0deg)' : motion === 'single-card-lift' ? 'translateY(28px) scale(.94) rotateX(8deg)' : 'translateY(12px) scale(.92)', opacity: open ? 1 : .78, filter: open ? 'blur(0)' : motion === 'floral-reveal' ? 'blur(1.5px)' : 'none', transition: `transform ${duration} cubic-bezier(.2,.75,.2,1), opacity ${duration}, filter ${duration}` }}>
      {baseCard}
    </div>
  )
}

export function PremiumInvitationExperience({
  slug,
  data,
  style,
  previewMode = false,
  previewDevice = 'auto',
  reducedMotionOverride,
  personalizeFromGuestSession = false,
  onContinue,
}: PremiumInvitationExperienceProps) {
  const definition = getInvitationCardStyleDefinition(style)
  const [motionState, setMotionState] = useState<MotionState>('closed')
  const [reducedMotion, setReducedMotion] = useState(Boolean(reducedMotionOverride))
  const [resolvedData, setResolvedData] = useState(data)
  const openButtonRef = useRef<HTMLButtonElement | null>(null)
  const continueButtonRef = useRef<HTMLButtonElement | null>(null)
  const isOpen = motionState === 'open'
  const isIvoryBenchmark = style === 'ivory-floral-gold'

  useEffect(() => {
    setResolvedData(data)
  }, [data])

  useEffect(() => {
    if (typeof reducedMotionOverride === 'boolean') {
      setReducedMotion(reducedMotionOverride)
      return
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [reducedMotionOverride])

  useEffect(() => {
    if (!personalizeFromGuestSession || !slug) return
    const controller = new AbortController()
    void fetch(`/api/weddings/${encodeURIComponent(slug)}/guest-session`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) return null
        return (await response.json()) as GuestSessionPayload
      })
      .then((payload) => {
        if (!payload?.success || !payload.wedding || !payload.guest) return
        setResolvedData((current) => ({
          ...current,
          title: payload.wedding!.title,
          monogram: payload.wedding!.monogram,
          tagline: payload.wedding!.tagline,
          date: payload.wedding!.date,
          venue: payload.wedding!.venue,
          venueCity: payload.wedding!.venueCity,
          venueCountry: payload.wedding!.venueCountry,
          guestName: payload.guest!.name,
          message: payload.wedding!.invitationCardMessage,
          rsvpDeadline: payload.wedding!.rsvpDeadline,
          primaryColor: payload.wedding!.primaryColor,
          accentColor: payload.wedding!.accentColor,
          backgroundColor: payload.wedding!.backgroundColor,
        }))
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [personalizeFromGuestSession, slug])

  useEffect(() => {
    if (!isOpen) return
    const id = window.setTimeout(() => continueButtonRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [isOpen])

  const sceneMaxWidth = isIvoryBenchmark
    ? previewDevice === 'mobile' ? '390px' : '520px'
    : previewDevice === 'mobile' ? '390px' : previewDevice === 'desktop' ? '1040px' : '1040px'
  const palette = definition.palette

  const stageStyle = useMemo(
    () => ({
      background: isIvoryBenchmark
        ? 'radial-gradient(circle at 50% 30%, #fffaf1 0%, #ede0ce 52%, #d7c4aa 100%)'
        : `radial-gradient(circle at 50% 35%, ${palette.primary}24, transparent 38%), ${palette.stage}`,
      color: palette.ink,
    }),
    [isIvoryBenchmark, palette],
  )

  function openInvitation() {
    if (motionState !== 'closed') return
    if (reducedMotion) {
      setMotionState('open')
      return
    }
    setMotionState('opening')
    window.setTimeout(() => setMotionState('open'), definition.motion === 'tri-fold' ? 1500 : 1150)
  }

  function replay() {
    setMotionState('closed')
    window.setTimeout(() => {
      if (openButtonRef.current) {
        openButtonRef.current.focus()
        return
      }
      const invitationButton = document.querySelector<HTMLButtonElement>('[data-testid="invitation-open-button"]')
      invitationButton?.focus()
    }, 30)
  }

  function continueToDetails() {
    if (onContinue) {
      onContinue()
      return
    }
    document.getElementById('wedding-details')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <section
      data-testid="premium-invitation-experience"
      data-invitation-style={style}
      data-motion={definition.motion}
      data-motion-state={motionState}
      className="relative isolate flex min-h-[min(900px,96svh)] w-full items-center justify-center overflow-hidden px-3 py-6 sm:px-6 sm:py-10"
      style={stageStyle}
      aria-label={`${definition.name} digital wedding invitation`}
    >
      <Atmosphere atmosphere={definition.atmosphere} primary={palette.primary} accent={palette.accent} open={motionState !== 'closed'} />
      <div className="relative z-10 mx-auto w-full" style={{ maxWidth: sceneMaxWidth }}>
        {!isIvoryBenchmark && (
          <div className="mb-5 text-center text-[9px] font-semibold uppercase tracking-[0.28em] text-white/60 sm:text-[10px]">
            Wewed · Private wedding invitation
          </div>
        )}

        <div className="relative mx-auto w-full" style={{ color: palette.ink }}>
          {isIvoryBenchmark ? (
            <IvoryFloralGoldTriFold
              data={resolvedData}
              open={motionState !== 'closed'}
              reducedMotion={reducedMotion}
              onOpen={openInvitation}
            />
          ) : (
            <GenericMotionCard
              data={resolvedData}
              motion={definition.motion}
              open={motionState !== 'closed'}
              reducedMotion={reducedMotion}
              paper={palette.paper}
              ink={palette.ink}
              primary={palette.primary}
              accent={palette.accent}
            />
          )}

          {!isIvoryBenchmark && motionState !== 'open' && (
            <div className={`absolute inset-0 z-40 flex items-end justify-center pb-8 sm:pb-10 ${motionState === 'opening' ? 'sr-only' : ''}`}>
              <Button
                ref={openButtonRef}
                type="button"
                data-testid="invitation-open-button"
                onClick={openInvitation}
                aria-disabled={motionState === 'opening'}
                className="min-h-12 rounded-full border px-6 text-sm font-semibold shadow-2xl backdrop-blur"
                style={{ background: palette.primary, color: palette.paper, borderColor: palette.accent }}
              >
                <Sparkles className="size-4" aria-hidden="true" />
                Open invitation
              </Button>
            </div>
          )}

          {motionState === 'opening' && (
            <p role="status" className="sr-only">Opening invitation</p>
          )}
        </div>

        {isOpen && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-center">
            <Button
              ref={continueButtonRef}
              type="button"
              data-testid="invitation-continue-button"
              onClick={continueToDetails}
              className="min-h-11 rounded-full border border-[#b38a49]/55 bg-[#9a6d28] px-6 text-[#fffaf0] shadow-lg hover:bg-[#80591f]"
            >
              Continue to wedding details
              <ChevronDown className="size-4" aria-hidden="true" />
            </Button>
            {previewMode && (
              <Button
                type="button"
                variant="outline"
                onClick={replay}
                className={isIvoryBenchmark
                  ? 'min-h-11 rounded-full border-[#8d714f]/35 bg-white/55 px-5 text-[#624b36] hover:bg-white/75 hover:text-[#493627]'
                  : 'min-h-11 rounded-full border-white/30 bg-white/10 px-5 text-white hover:bg-white/20 hover:text-white'}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Replay opening
              </Button>
            )}
          </div>
        )}

        <div className={`mt-4 text-center text-[10px] ${isIvoryBenchmark ? 'text-[#69543f]/70' : 'text-white/50'}`}>
          {reducedMotion ? 'Reduced motion preview · invitation opens without 3D movement' : `${definition.name} · ${formatShortDate(resolvedData.date)}`}
        </div>
      </div>
    </section>
  )
}
