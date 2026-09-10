'use client'

import { ChevronDown } from 'lucide-react'
import type { DigitalInvitationCardData } from '@/components/wedding/digital-invitation-card'

type IvoryFloralGoldTriFoldProps = {
  data: DigitalInvitationCardData
  open: boolean
  reducedMotion: boolean
  onOpen: () => void
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
  if (pair.length >= 2) return { first: pair[0], second: pair.slice(1).join(' & ') }
  return { first: title, second: null }
}

function PaperGrain({ className = '' }: { className?: string }) {
  return (
    <div
      data-testid="ivory-paper-grain"
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 17% 23%, rgba(116,87,49,.06) 0 .7px, transparent .9px), radial-gradient(circle at 73% 61%, rgba(255,255,255,.86) 0 .8px, transparent 1px), repeating-linear-gradient(112deg, rgba(152,119,73,.018) 0 1px, transparent 1px 5px)',
        backgroundSize: '17px 17px, 19px 19px, auto',
        mixBlendMode: 'multiply',
        opacity: 0.52,
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
        background: 'linear-gradient(104deg, #fffdfa 0%, #f6efe4 58%, #fffdf8 100%)',
        boxShadow:
          side === 'left'
            ? 'inset -1px 0 0 rgba(181,138,72,.86), inset -10px 0 18px rgba(122,90,48,.07), 5px 0 12px rgba(67,49,31,.09)'
            : 'inset 1px 0 0 rgba(181,138,72,.86), inset 10px 0 18px rgba(122,90,48,.07), -5px 0 12px rgba(67,49,31,.09)',
      }}
    >
      <PaperGrain />
    </div>
  )
}

function OpenInvitationContent({ data }: { data: DigitalInvitationCardData }) {
  const names = splitCoupleNames(data.title)
  const location = [data.venueCity, data.venueCountry].filter(Boolean).join(', ')

  return (
    <div className="relative z-10 flex h-full flex-col items-center px-[12%] pb-[9%] pt-[11%] text-center text-[#493d32]">
      <div aria-hidden="true" className="mb-[5%] flex w-full items-center justify-center gap-3 text-[#b3833f]">
        <span className="h-px w-12 bg-current opacity-55" />
        <span className="text-xs">✦</span>
        <span className="h-px w-12 bg-current opacity-55" />
      </div>

      <p className="text-[7px] font-semibold uppercase tracking-[0.31em] sm:text-[9px]">
        Together with our families
      </p>

      {data.guestName && (
        <p className="mt-[4%] font-serif text-[9px] italic tracking-[0.04em] text-[#7d6854] sm:text-xs">
          Especially for {data.guestName}
        </p>
      )}

      <div className="mt-[5%] w-full">
        <p className="font-serif text-[clamp(1.4rem,5.4vw,2.5rem)] italic leading-[.95] tracking-[-0.045em] text-[#9a6d28]">
          {names.first}
        </p>
        {names.second && (
          <>
            <p className="my-[2%] font-serif text-[clamp(1.05rem,3.8vw,1.65rem)] italic text-[#9a6d28]">&amp;</p>
            <p className="font-serif text-[clamp(1.35rem,5vw,2.35rem)] italic leading-[.95] tracking-[-0.045em] text-[#9a6d28]">
              {names.second}
            </p>
          </>
        )}
      </div>

      <div className="my-[5%] flex w-full items-center justify-center gap-3 text-[#b3833f]">
        <span className="h-px w-12 bg-current opacity-55" />
        <span className="text-[8px]">◆</span>
        <span className="h-px w-12 bg-current opacity-55" />
      </div>

      <p className="max-w-[19rem] text-[7px] font-medium uppercase leading-[1.7] tracking-[0.16em] sm:text-[9px]">
        {data.message || 'Request the pleasure of your company as we celebrate our marriage.'}
      </p>

      <p className="mt-[5%] font-serif text-[10px] font-semibold uppercase tracking-[0.1em] sm:text-sm">
        {formatDate(data.date)}
      </p>

      <div className="my-[4%] h-px w-16 bg-[#b3833f]/45" />

      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] sm:text-xs">{data.venue}</p>
      {location && (
        <p className="mt-1 text-[7px] leading-relaxed text-[#756659] sm:text-[9px]">{location}</p>
      )}

      {data.rsvpDeadline && (
        <p
          data-testid="invitation-rsvp-deadline"
          className="mt-[4%] text-[7px] font-semibold uppercase tracking-[0.15em] text-[#7a6247] sm:text-[9px]"
        >
          RSVP by {formatDate(data.rsvpDeadline)}
        </p>
      )}

      <div aria-hidden="true" className="mt-auto pt-[4%] text-[#ad7d3b]">
        <span className="text-xs">♥</span>
      </div>
    </div>
  )
}

export function IvoryFloralGoldTriFold({
  data,
  open,
  reducedMotion,
  onOpen,
}: IvoryFloralGoldTriFoldProps) {
  const duration = reducedMotion ? '0ms' : '1450ms'
  const coverDuration = reducedMotion ? '0ms' : '520ms'
  const monogram = data.monogram || fallbackMonogram(data.title)

  return (
    <div
      data-testid="invitation-trifold"
      data-card-object="physical-stationery"
      className="relative mx-auto aspect-[0.655/1] w-full max-w-[460px] [perspective:1800px]"
    >
      <div
        className="absolute inset-[1.5%] overflow-visible rounded-[1.25rem] shadow-[0_30px_65px_rgba(27,18,10,.38),0_5px_16px_rgba(27,18,10,.22)] [transform-style:preserve-3d]"
        style={{
          background: 'linear-gradient(145deg,#fffdf8 0%,#f8f1e6 52%,#fffaf0 100%)',
        }}
      >
        <PaperGrain className="rounded-[1.25rem]" />

        <div
          aria-hidden="true"
          className="absolute inset-[1.8%] rounded-[1.05rem] border border-[#caa96d]/65"
          style={{ boxShadow: 'inset 0 0 28px rgba(181,138,72,.06)' }}
        />

        <section
          data-testid="invitation-panel-centre"
          aria-hidden={!open}
          className="absolute inset-[3.2%] overflow-hidden rounded-[.9rem] border border-[#d4bc8c]/55 bg-[#fbf5e9]"
          style={{
            transform: open ? 'translateZ(0)' : 'translateZ(-6px)',
            transition: `transform ${duration} cubic-bezier(.2,.75,.2,1)`,
            boxShadow: open ? '0 0 34px rgba(212,175,103,.18)' : 'none',
          }}
        >
          <PaperGrain />
          <div aria-hidden="true" className="absolute inset-x-[12%] top-[4%] h-px bg-[#c09a57]/50" />
          <div aria-hidden="true" className="absolute inset-x-[12%] bottom-[4%] h-px bg-[#c09a57]/40" />
          <OpenInvitationContent data={data} />
        </section>

        <section
          data-testid="invitation-panel-left"
          aria-label="Left floral fold"
          className="absolute inset-y-[1.7%] left-[1.7%] z-20 w-[51.5%] overflow-hidden rounded-l-[1rem] border-y border-l border-[#c9a768]/70 bg-[#fbf6ec] [backface-visibility:hidden] [transform-origin:100%_50%] [transform-style:preserve-3d]"
          style={{
            transform: open ? 'translateX(-30%) rotateY(-52deg)' : 'translateX(0) rotateY(0deg)',
            transition: `transform ${duration} cubic-bezier(.18,.82,.2,1), filter ${duration}`,
            filter: open ? 'brightness(.99)' : 'brightness(1.01)',
            boxShadow: open
              ? '12px 9px 24px rgba(60,42,25,.20), inset -1px 0 0 rgba(188,145,76,.75)'
              : '4px 0 15px rgba(64,43,24,.11), inset -1px 0 0 rgba(188,145,76,.7)',
          }}
        >
          <PaperGrain />
          <SculptedVeil side="left" />
          <FloralSpray side="left" className="bottom-[4%] left-[-13%] h-[62%] w-[76%] opacity-[.72]" />
          <FloralSpray side="right" className="right-[-25%] top-[5%] h-[46%] w-[60%] opacity-[.48]" />
          <div aria-hidden="true" className="absolute inset-y-[1%] right-0 w-px bg-gradient-to-b from-transparent via-[#b98a43] to-transparent opacity-75" />
        </section>

        <section
          data-testid="invitation-panel-right"
          aria-label="Right floral fold"
          className="absolute inset-y-[1.7%] right-[1.7%] z-20 w-[51.5%] overflow-hidden rounded-r-[1rem] border-y border-r border-[#c9a768]/70 bg-[#fbf6ec] [backface-visibility:hidden] [transform-origin:0%_50%] [transform-style:preserve-3d]"
          style={{
            transform: open ? 'translateX(30%) rotateY(52deg)' : 'translateX(0) rotateY(0deg)',
            transition: `transform ${duration} cubic-bezier(.18,.82,.2,1), filter ${duration}`,
            filter: open ? 'brightness(.99)' : 'brightness(1.01)',
            boxShadow: open
              ? '-12px 9px 24px rgba(60,42,25,.20), inset 1px 0 0 rgba(188,145,76,.75)'
              : '-4px 0 15px rgba(64,43,24,.11), inset 1px 0 0 rgba(188,145,76,.7)',
          }}
        >
          <PaperGrain />
          <SculptedVeil side="right" />
          <FloralSpray side="right" className="bottom-[4%] right-[-13%] h-[62%] w-[76%] opacity-[.72]" />
          <FloralSpray side="left" className="left-[-25%] top-[5%] h-[46%] w-[60%] opacity-[.48]" />
          <div aria-hidden="true" className="absolute inset-y-[1%] left-0 w-px bg-gradient-to-b from-transparent via-[#b98a43] to-transparent opacity-75" />
        </section>

        <div
          data-testid="invitation-closed-cover"
          className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center text-center text-[#8f672c]"
          style={{
            opacity: open ? 0 : 1,
            transform: open ? 'scale(.985)' : 'scale(1)',
            transition: `opacity ${coverDuration} ease, transform ${coverDuration} ease`,
          }}
          aria-hidden={open}
        >
          <div className="mb-[8%] flex size-[22%] items-center justify-center rounded-full border border-[#c4a265]/70 bg-[#fffaf0]/88 shadow-[inset_0_0_0_7px_rgba(255,255,255,.45)] backdrop-blur-[1px]">
            <span className="font-serif text-[clamp(1.7rem,7vw,3rem)] tracking-[0.04em]">{monogram}</span>
          </div>
          <p className="max-w-[55%] text-[8px] font-semibold uppercase leading-[1.8] tracking-[0.32em] text-[#70563a] sm:text-[10px]">
            A special invitation awaits
          </p>
        </div>

        {!open && (
          <button
            type="button"
            data-testid="invitation-open-button"
            onClick={onOpen}
            className="absolute bottom-[4.5%] left-1/2 z-40 flex min-h-12 -translate-x-1/2 flex-col items-center justify-center gap-1 rounded-full px-5 text-[#70563a] outline-none focus-visible:ring-2 focus-visible:ring-[#b3833f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf5e9]"
          >
            <span className="text-[9px] font-medium tracking-[.04em] sm:text-[10px]">Tap to open</span>
            <span className="flex size-8 items-center justify-center rounded-full border border-[#8f713f]/75 bg-[#fffaf1]/82 shadow-sm">
              <ChevronDown className="size-4" aria-hidden="true" />
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
