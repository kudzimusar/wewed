'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  CalendarDays,
  ChevronDown,
  Gift,
  Heart,
  Mail,
  MapPin,
  RotateCcw,
  X,
} from 'lucide-react'
import type { DigitalInvitationCardData } from '@/components/wedding/digital-invitation-card'

type IvoryInvitationView = 'closed' | 'opening' | 'open' | 'details'

type IvoryFloralGoldCardData = DigitalInvitationCardData & {
  venueAddress?: string | null
  venueMapUrl?: string | null
}

type IvoryFloralGoldTriFoldProps = {
  data: IvoryFloralGoldCardData
  open: boolean
  reducedMotion: boolean
  onOpen: () => void
  previewMode?: boolean
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

function fallbackMonogram(title: string): string {
  return title
    .split(/\s+&\s+|\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'W'
}

function splitCoupleNames(title: string): { first: string; second: string | null } {
  const pair = title.split(/\s+&\s+/).map((part) => part.trim()).filter(Boolean)
  if (pair.length < 2) return { first: title, second: null }

  const first = pair[0].split(/\s+/)[0] || pair[0]
  const canonicalSecond = pair.slice(1).join(' & ')
  const second = /shadreck|kudzanai|musarurwa/i.test(canonicalSecond)
    ? 'Kudzie'
    : canonicalSecond.split(/\s+/)[0] || canonicalSecond

  return { first, second }
}

function PaperGrain({ className = '' }: { className?: string }) {
  return (
    <div
      data-testid="ivory-paper-grain"
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 17% 23%, rgba(116,87,49,.06) 0 .7px, transparent .9px), radial-gradient(circle at 73% 61%, rgba(255,255,255,.86) 0 .8px, transparent 1px), repeating-linear-gradient(112deg, rgba(152,119,73,.022) 0 1px, transparent 1px 5px)',
        backgroundSize: '17px 17px, 19px 19px, auto',
        mixBlendMode: 'multiply',
        opacity: 0.58,
      }}
    />
  )
}

function FloralSpray({
  side,
  className = '',
}: {
  side: 'left' | 'right'
  className?: string
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 220 520"
      fill="none"
      className={`pointer-events-none absolute ${side === 'right' ? '-scale-x-100' : ''} ${className}`}
    >
      <g stroke="#b58a48" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 506C56 430 80 362 86 286C94 194 126 113 202 20" strokeWidth="1.35" />
        <path d="M49 438C72 410 95 394 123 390M65 389C39 371 25 349 19 320M82 321C115 304 143 279 158 245M87 278C61 258 47 236 43 210M111 205C139 191 159 170 172 143M132 151C111 130 101 108 102 84M165 87C179 71 190 52 197 31" strokeWidth="1.05" />
        <path d="M124 390c-22-3-38 4-49 22 23 5 40-2 49-22ZM19 320c20 2 34 11 42 28-21 2-35-8-42-28ZM158 245c-24 1-41 11-51 31 24 2 42-8 51-31ZM43 210c19 4 32 15 37 34-20 0-33-11-37-34ZM172 143c-20 2-34 11-42 29 21 2 35-8 42-29ZM102 84c17 7 27 19 29 36-18-3-28-15-29-36Z" strokeWidth="1" />
        <g strokeWidth="1.05">
          <path d="M111 338c-26-5-43-24-41-50 25 5 42 24 41 50Z" />
          <path d="M111 338c5-26 24-43 50-41-5 25-24 42-50 41Z" />
          <path d="M111 338c-4 26-22 44-48 44 3-26 22-44 48-44Z" />
          <path d="M111 338c24 8 39 29 34 55-24-8-39-29-34-55Z" />
          <circle cx="111" cy="338" r="8" />
          <circle cx="107" cy="334" r="1.5" fill="#b58a48" stroke="none" />
          <circle cx="115" cy="335" r="1.5" fill="#b58a48" stroke="none" />
          <circle cx="112" cy="342" r="1.5" fill="#b58a48" stroke="none" />
        </g>
        <g strokeWidth="1.05">
          <path d="M141 175c-19-5-31-20-29-39 19 4 31 19 29 39Z" />
          <path d="M141 175c5-19 20-31 39-29-4 19-19 31-39 29Z" />
          <path d="M141 175c-4 19-18 32-37 32 3-19 18-32 37-32Z" />
          <path d="M141 175c18 6 29 22 25 41-18-6-29-22-25-41Z" />
          <circle cx="141" cy="175" r="6" />
        </g>
        <g strokeWidth="1">
          <path d="M51 449c-14-4-23-15-21-30 14 3 23 15 21 30Z" />
          <path d="M51 449c4-14 15-23 30-21-3 14-15 23-30 21Z" />
          <path d="M51 449c-3 14-14 24-28 24 2-15 13-24 28-24Z" />
          <circle cx="51" cy="449" r="4.5" />
        </g>
      </g>
    </svg>
  )
}

function SculptedVeil({ side }: { side: 'left' | 'right' }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-y-0 w-[72%] overflow-hidden ${side === 'left' ? 'right-0' : 'left-0'}`}
      style={{
        borderRadius: side === 'left' ? '0 86% 64% 0 / 0 30% 70% 0' : '86% 0 0 64% / 30% 0 0 70%',
        background: 'linear-gradient(104deg,#fffefa 0%,#f6efe4 58%,#fffdf8 100%)',
        boxShadow:
          side === 'left'
            ? 'inset -1px 0 0 rgba(181,138,72,.92), inset -12px 0 20px rgba(122,90,48,.08), 7px 0 14px rgba(67,49,31,.1)'
            : 'inset 1px 0 0 rgba(181,138,72,.92), inset 12px 0 20px rgba(122,90,48,.08), -7px 0 14px rgba(67,49,31,.1)',
      }}
    >
      <PaperGrain />
    </div>
  )
}

function Ornament() {
  return (
    <div aria-hidden="true" className="flex items-center justify-center gap-2 text-[#aa7a38]">
      <span className="h-px w-11 bg-current opacity-55" />
      <span className="text-[9px]">◆</span>
      <span className="h-px w-11 bg-current opacity-55" />
    </div>
  )
}

function FullInvitation({ data, onDetails }: { data: IvoryFloralGoldCardData; onDetails: () => void }) {
  const names = splitCoupleNames(data.title)
  const location = [data.venueCity, data.venueCountry].filter(Boolean).join(', ')

  return (
    <div
      data-testid="invitation-panel-centre"
      className="relative z-10 flex h-full flex-col items-center overflow-hidden px-[11%] pb-[5%] pt-[7%] text-center text-[#493d32]"
    >
      <FloralSpray side="left" className="-left-[13%] -top-[8%] h-[41%] w-[50%] opacity-[.38]" />
      <FloralSpray side="right" className="-right-[13%] -top-[8%] h-[41%] w-[50%] opacity-[.38]" />
      <FloralSpray side="left" className="-bottom-[12%] -left-[15%] h-[43%] w-[52%] rotate-180 opacity-[.34]" />
      <FloralSpray side="right" className="-bottom-[12%] -right-[15%] h-[43%] w-[52%] rotate-180 opacity-[.34]" />

      <div className="relative z-10 flex h-full w-full flex-col items-center">
        <Ornament />
        <p className="mt-[4%] text-[8px] font-semibold uppercase tracking-[0.31em] sm:text-[9px]">
          Together with our families
        </p>

        {data.guestName && (
          <p className="mt-[3%] font-serif text-[9px] italic tracking-[0.03em] text-[#7d6854] sm:text-xs">
            Especially for {data.guestName}
          </p>
        )}

        <div className="mt-[5%] w-full text-[#986a2b]">
          <p className="font-serif text-[clamp(2.15rem,10vw,3.9rem)] italic leading-[.88] tracking-[-0.055em]">
            {names.first}
          </p>
          {names.second && (
            <>
              <p className="my-[2%] font-serif text-[clamp(1.3rem,5vw,2rem)] italic">&amp;</p>
              <p className="font-serif text-[clamp(2.05rem,9vw,3.7rem)] italic leading-[.88] tracking-[-0.055em]">
                {names.second}
              </p>
            </>
          )}
        </div>

        <div className="my-[5%]"><Ornament /></div>

        <p className="max-w-[19rem] text-[8px] font-medium uppercase leading-[1.72] tracking-[0.15em] sm:text-[9px]">
          {data.message || 'Request the pleasure of your company as we celebrate our marriage.'}
        </p>

        <p className="mt-[5%] font-serif text-[11px] font-semibold uppercase tracking-[0.12em] sm:text-sm">
          {formatDate(data.date)}
        </p>

        <div className="my-[3.5%]"><Ornament /></div>

        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] sm:text-xs">{data.venue}</p>
        {data.venueAddress && (
          <p className="mt-[1.5%] text-[8px] leading-relaxed text-[#6f5e4f] sm:text-[9px]">{data.venueAddress}</p>
        )}
        {location && (
          <p className="mt-0.5 text-[8px] leading-relaxed text-[#6f5e4f] sm:text-[9px]">{location}</p>
        )}

        {data.rsvpDeadline && (
          <p
            data-testid="invitation-rsvp-deadline"
            className="mt-[3%] text-[7px] font-semibold uppercase tracking-[0.15em] text-[#7a6247] sm:text-[9px]"
          >
            RSVP by {formatDate(data.rsvpDeadline)}
          </p>
        )}

        <div className="mt-auto flex w-full flex-col items-center pt-[3%]">
          <span aria-hidden="true" className="text-lg text-[#a87937]">♥</span>
          <button
            type="button"
            data-testid="invitation-details-button"
            onClick={onDetails}
            className="mt-2 flex min-h-11 items-center gap-2 rounded-full border border-[#b88d50]/45 bg-[#fffaf2]/78 px-5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#70563a] shadow-[0_8px_20px_rgba(93,67,37,.08)] outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-[#b3833f]"
          >
            Wedding details
            <ArrowDown className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

function buildCalendarFile(data: IvoryFloralGoldCardData) {
  const date = asDate(data.date)
  if (!date || typeof window === 'undefined') return
  const start = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`
  const endDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1))
  const end = `${endDate.getUTCFullYear()}${String(endDate.getUTCMonth() + 1).padStart(2, '0')}${String(endDate.getUTCDate()).padStart(2, '0')}`
  const location = [data.venueAddress, data.venue, data.venueCity, data.venueCountry].filter(Boolean).join(', ')
  const safe = (value: string) => value.replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wewed//Wedding Invitation//EN',
    'BEGIN:VEVENT',
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${safe(data.title)} Wedding`,
    `LOCATION:${safe(location)}`,
    'DESCRIPTION:Wedding invitation saved from Wewed.',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'wewed-wedding.ics'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function ActionRow({
  icon,
  title,
  description,
  onClick,
  href,
  testId,
}: {
  icon: React.ReactNode
  title: string
  description: string
  onClick?: () => void
  href?: string
  testId: string
}) {
  const className = 'group flex min-h-[68px] w-full items-center gap-3 rounded-[1.1rem] border border-[#b88d50]/38 bg-[#fffaf2]/78 px-4 py-3 text-left text-[#493d32] shadow-[0_9px_22px_rgba(82,57,31,.08),inset_0_1px_0_rgba(255,255,255,.78)] outline-none transition hover:-translate-y-0.5 hover:bg-white focus-visible:ring-2 focus-visible:ring-[#b3833f]'
  const content = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#b88d50]/45 bg-[#fffdf7] text-[#9c6d2d]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-serif text-[15px] leading-tight">{title}</span>
        <span className="mt-0.5 block text-[9px] leading-4 text-[#796959]">{description}</span>
      </span>
      <ChevronDown className="size-4 -rotate-90 text-[#a2753b] transition group-hover:translate-x-0.5" aria-hidden="true" />
    </>
  )

  if (href) {
    return <a data-testid={testId} className={className} href={href} target="_blank" rel="noopener noreferrer">{content}</a>
  }
  return <button data-testid={testId} type="button" className={className} onClick={onClick}>{content}</button>
}

function InteractiveDetails({
  data,
  onBack,
  previewMode,
}: {
  data: IvoryFloralGoldCardData
  onBack: () => void
  previewMode: boolean
}) {
  const [noteOpen, setNoteOpen] = useState(false)
  const location = [data.venueAddress, data.venue, data.venueCity, data.venueCountry].filter(Boolean).join(', ')
  const mapUrl = data.venueMapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
  const note = data.tagline || data.message || 'Your presence will make our day complete.'
  const registryAvailable = previewMode || (typeof document !== 'undefined' && Boolean(document.getElementById('registry')))

  function openRsvp() {
    if (previewMode && !document.querySelector('[data-personal-invitation="1"]')) {
      window.alert('In a personal guest invitation this opens the secure Wewed RSVP form for that guest.')
      return
    }
    window.dispatchEvent(new CustomEvent('wewed:open-premium-rsvp'))
  }

  function openRegistry() {
    const registry = document.getElementById('registry')
    registry?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function continueToWedding() {
    document.getElementById('wedding-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div data-testid="invitation-interactive-details" className="relative z-10 flex h-full flex-col overflow-hidden px-[8%] pb-[5%] pt-[6%] text-[#493d32]">
      <FloralSpray side="left" className="-left-[13%] -top-[9%] h-[38%] w-[47%] opacity-[.34]" />
      <FloralSpray side="right" className="-right-[13%] -top-[9%] h-[38%] w-[47%] opacity-[.34]" />
      <FloralSpray side="left" className="-bottom-[12%] -left-[15%] h-[40%] w-[48%] rotate-180 opacity-[.28]" />
      <FloralSpray side="right" className="-bottom-[12%] -right-[15%] h-[40%] w-[48%] rotate-180 opacity-[.28]" />

      <div className="relative z-10 flex h-full flex-col">
        <div className="text-center">
          <p className="text-[8px] font-semibold uppercase tracking-[0.34em]">{splitCoupleNames(data.title).first} &amp; {splitCoupleNames(data.title).second}</p>
          <Ornament />
          <p className="mt-2 font-serif text-[clamp(1.65rem,7vw,2.7rem)] italic leading-tight text-[#986a2b]">You&apos;re invited</p>
          <p className="mx-auto mt-2 max-w-[16rem] font-serif text-[10px] italic leading-4 text-[#755c43]">{note}</p>
        </div>

        <div className="mt-[5%] grid gap-2.5">
          <ActionRow testId="invitation-cta-rsvp" icon={<Mail className="size-4" />} title="RSVP" description="Let us know you're coming" onClick={openRsvp} />
          <ActionRow testId="invitation-cta-calendar" icon={<CalendarDays className="size-4" />} title="Add to Calendar" description="Save the wedding date" onClick={() => buildCalendarFile(data)} />
          <ActionRow testId="invitation-cta-venue" icon={<MapPin className="size-4" />} title="Venue Location" description={data.venue} href={mapUrl} />
          {registryAvailable && (
            <ActionRow testId="invitation-cta-registry" icon={<Gift className="size-4" />} title="Gift / Contributions" description="View the couple's configured details" onClick={openRegistry} />
          )}
          <ActionRow testId="invitation-cta-note" icon={<Heart className="size-4" />} title="A Note from Us" description="A personal message from the couple" onClick={() => setNoteOpen(true)} />
        </div>

        <div className="mt-auto flex items-center justify-center gap-3 pt-3">
          <button type="button" onClick={onBack} className="min-h-10 rounded-full px-3 text-[9px] font-semibold uppercase tracking-[0.13em] text-[#755c43] underline decoration-[#b88d50]/45 underline-offset-4">View invitation</button>
          {!previewMode && (
            <button type="button" onClick={continueToWedding} className="min-h-10 rounded-full border border-[#b88d50]/38 bg-[#fffaf2]/78 px-4 text-[9px] font-semibold uppercase tracking-[0.13em] text-[#755c43]">Explore wedding site</button>
          )}
        </div>
      </div>

      {noteOpen && (
        <div className="absolute inset-[8%] z-30 flex items-center justify-center rounded-[1.4rem] border border-[#b88d50]/42 bg-[#fffaf2]/96 p-7 text-center shadow-[0_22px_55px_rgba(66,45,25,.22)] backdrop-blur-sm">
          <button type="button" aria-label="Close note" onClick={() => setNoteOpen(false)} className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full border border-[#b88d50]/35 bg-white/70 text-[#74583b]"><X className="size-4" /></button>
          <div>
            <Heart className="mx-auto size-6 text-[#a87937]" />
            <p className="mt-4 font-serif text-2xl italic text-[#986a2b]">A note from us</p>
            <p className="mt-4 font-serif text-sm italic leading-6 text-[#665442]">{note}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export function IvoryFloralGoldTriFold({
  data,
  open,
  reducedMotion,
  onOpen,
  previewMode = false,
}: IvoryFloralGoldTriFoldProps) {
  const [view, setView] = useState<IvoryInvitationView>('closed')
  const openingDuration = reducedMotion ? 0 : 1_650
  const monogram = data.monogram || fallbackMonogram(data.title)

  useEffect(() => {
    if (!open) {
      setView('closed')
      return
    }
    if (reducedMotion) {
      setView('open')
      return
    }
    setView((current) => current === 'details' ? current : 'opening')
    const timer = window.setTimeout(() => {
      setView((current) => current === 'details' ? current : 'open')
    }, openingDuration)
    return () => window.clearTimeout(timer)
  }, [open, reducedMotion, openingDuration])

  const panelTransition = reducedMotion
    ? 'none'
    : 'transform 1650ms cubic-bezier(.16,.82,.18,1), opacity 1450ms cubic-bezier(.2,.7,.2,1), filter 1650ms ease, box-shadow 1650ms ease'
  const isClosed = view === 'closed'
  const isOpening = view === 'opening'
  const isOpen = view === 'open' || view === 'details'

  const leftTransform = isClosed ? 'translateX(0) rotateY(0deg)' : 'translateX(-112%) rotateY(-82deg)'
  const rightTransform = isClosed ? 'translateX(0) rotateY(0deg)' : 'translateX(112%) rotateY(82deg)'
  const panelOpacity = isClosed ? 1 : isOpening ? 0.18 : 0

  const cardStyle = useMemo(() => ({
    width: 'min(94vw, 430px)',
    aspectRatio: '9 / 19.5',
  }), [])

  return (
    <div
      data-testid="invitation-trifold"
      data-card-object="physical-stationery"
      data-invitation-view={view}
      className="relative mx-auto [perspective:1900px]"
      style={cardStyle}
    >
      <div
        className="absolute inset-[1.2%] overflow-visible rounded-[1.55rem] shadow-[0_30px_65px_rgba(27,18,10,.34),0_5px_16px_rgba(27,18,10,.20)] [transform-style:preserve-3d]"
        style={{ background: 'linear-gradient(145deg,#fffdf8 0%,#f8f1e6 52%,#fffaf0 100%)' }}
      >
        <PaperGrain className="rounded-[1.55rem]" />
        <div aria-hidden="true" className="absolute inset-[1.2%] rounded-[1.35rem] border border-[#caa96d]/65" style={{ boxShadow: 'inset 0 0 34px rgba(181,138,72,.065)' }} />

        <section
          aria-hidden={isClosed}
          className="absolute inset-[2.2%] overflow-hidden rounded-[1.2rem] border border-[#d4bc8c]/55 bg-[#fbf5e9]"
          style={{
            opacity: isClosed ? 0 : 1,
            transform: isClosed ? 'translateZ(-10px) scale(.955)' : 'translateZ(0) scale(1)',
            transition: reducedMotion ? 'none' : 'opacity 520ms ease, transform 1650ms cubic-bezier(.16,.82,.18,1)',
            boxShadow: isClosed ? 'none' : '0 0 42px rgba(212,175,103,.19)',
          }}
        >
          <PaperGrain />
          {view === 'details' ? (
            <InteractiveDetails data={data} onBack={() => setView('open')} previewMode={previewMode} />
          ) : (
            <FullInvitation data={data} onDetails={() => setView('details')} />
          )}
        </section>

        <section
          data-testid="invitation-panel-left"
          aria-label="Left floral fold"
          className="absolute inset-y-[1.4%] left-[1.4%] z-20 w-[51.8%] overflow-hidden rounded-l-[1.35rem] border-y border-l border-[#c9a768]/75 bg-[#fbf6ec] [backface-visibility:hidden] [transform-origin:100%_50%] [transform-style:preserve-3d]"
          style={{
            transform: leftTransform,
            transition: panelTransition,
            opacity: panelOpacity,
            filter: isOpening ? 'brightness(.96) saturate(.96)' : 'brightness(1.01)',
            boxShadow: isClosed
              ? '5px 0 16px rgba(64,43,24,.12), inset -1px 0 0 rgba(188,145,76,.78)'
              : '18px 10px 34px rgba(60,42,25,.25), inset -1px 0 0 rgba(188,145,76,.88)',
            pointerEvents: isOpen ? 'none' : 'auto',
          }}
        >
          <PaperGrain />
          <SculptedVeil side="left" />
          <FloralSpray side="left" className="bottom-[1%] left-[-18%] h-[65%] w-[82%] opacity-[.88]" />
          <FloralSpray side="right" className="right-[-26%] top-[2%] h-[49%] w-[67%] opacity-[.62]" />
          <div aria-hidden="true" className="absolute inset-y-[1%] right-0 w-px bg-gradient-to-b from-transparent via-[#b98a43] to-transparent opacity-90" />
        </section>

        <section
          data-testid="invitation-panel-right"
          aria-label="Right floral fold"
          className="absolute inset-y-[1.4%] right-[1.4%] z-20 w-[51.8%] overflow-hidden rounded-r-[1.35rem] border-y border-r border-[#c9a768]/75 bg-[#fbf6ec] [backface-visibility:hidden] [transform-origin:0%_50%] [transform-style:preserve-3d]"
          style={{
            transform: rightTransform,
            transition: panelTransition,
            opacity: panelOpacity,
            filter: isOpening ? 'brightness(.96) saturate(.96)' : 'brightness(1.01)',
            boxShadow: isClosed
              ? '-5px 0 16px rgba(64,43,24,.12), inset 1px 0 0 rgba(188,145,76,.78)'
              : '-18px 10px 34px rgba(60,42,25,.25), inset 1px 0 0 rgba(188,145,76,.88)',
            pointerEvents: isOpen ? 'none' : 'auto',
          }}
        >
          <PaperGrain />
          <SculptedVeil side="right" />
          <FloralSpray side="right" className="bottom-[1%] right-[-18%] h-[65%] w-[82%] opacity-[.88]" />
          <FloralSpray side="left" className="left-[-26%] top-[2%] h-[49%] w-[67%] opacity-[.62]" />
          <div aria-hidden="true" className="absolute inset-y-[1%] left-0 w-px bg-gradient-to-b from-transparent via-[#b98a43] to-transparent opacity-90" />
        </section>

        <div
          data-testid="invitation-closed-cover"
          className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center text-center text-[#8f672c]"
          style={{
            opacity: isClosed ? 1 : 0,
            transform: isClosed ? 'scale(1)' : 'scale(.985)',
            transition: reducedMotion ? 'none' : 'opacity 440ms ease, transform 520ms ease',
          }}
          aria-hidden={!isClosed}
        >
          <div className="mb-[7%] flex size-[23%] items-center justify-center rounded-full border border-[#c4a265]/75 bg-[#fffaf0]/90 shadow-[inset_0_0_0_7px_rgba(255,255,255,.48),0_10px_30px_rgba(98,69,35,.08)] backdrop-blur-[1px]">
            <span className="font-serif text-[clamp(1.7rem,8vw,3rem)] tracking-[0.04em]">{monogram}</span>
          </div>
          <p className="max-w-[55%] text-[9px] font-semibold uppercase leading-[1.85] tracking-[0.32em] text-[#70563a]">
            A special invitation awaits
          </p>
        </div>

        {isClosed && (
          <button
            type="button"
            data-testid="invitation-open-button"
            onClick={onOpen}
            className="absolute bottom-[4.2%] left-1/2 z-40 flex min-h-12 -translate-x-1/2 flex-col items-center justify-center gap-1 rounded-full px-5 text-[#70563a] outline-none focus-visible:ring-2 focus-visible:ring-[#b3833f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf5e9]"
          >
            <span className="text-[10px] font-medium tracking-[.04em]">Tap to open</span>
            <span className="flex size-8 items-center justify-center rounded-full border border-[#8f713f]/75 bg-[#fffaf1]/88 shadow-sm">
              <ChevronDown className="size-4" aria-hidden="true" />
            </span>
          </button>
        )}

        {isOpening && (
          <div className="pointer-events-none absolute inset-x-0 top-[3.8%] z-40 text-center">
            <p role="status" className="font-serif text-[13px] italic tracking-[.025em] text-[#8d632d]">Opening your invitation…</p>
            <div className="mx-auto mt-2 h-px w-28 bg-gradient-to-r from-transparent via-[#b3833f]/75 to-transparent" />
          </div>
        )}

        {previewMode && isOpen && (
          <button
            type="button"
            data-testid="invitation-replay-button"
            onClick={() => {
              setView('closed')
              window.setTimeout(() => onOpen(), 30)
            }}
            className="absolute right-[4%] top-[2.6%] z-50 flex size-9 items-center justify-center rounded-full border border-[#b88d50]/35 bg-[#fffaf2]/86 text-[#805f37] shadow-sm"
            aria-label="Replay invitation opening"
          >
            <RotateCcw className="size-4" />
          </button>
        )}
      </div>

      <style jsx global>{`
        [data-invitation-style='ivory-floral-gold'] [data-testid='invitation-continue-button'] {
          display: none !important;
        }
      `}</style>
    </div>
  )
}
