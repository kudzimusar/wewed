import type { ReactNode } from 'react'
import type { InvitationCardStyle } from '@/lib/digital-invitation-card'

export interface DigitalInvitationCardData {
  title: string
  monogram?: string | null
  tagline?: string | null
  date: string | Date
  venue: string
  venueCity?: string | null
  venueCountry?: string | null
  guestName?: string | null
  message?: string | null
  rsvpDeadline?: string | Date | null
  primaryColor?: string | null
  accentColor?: string | null
  backgroundColor?: string | null
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
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatDeadline(value: string | Date | null | undefined): string | null {
  const date = asDate(value)
  if (!date) return null
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    day: 'numeric',
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

function locationLine(data: DigitalInvitationCardData): string {
  return [data.venueCity, data.venueCountry].filter(Boolean).join(', ')
}

interface CardLayoutProps {
  data: DigitalInvitationCardData
  compact: boolean
  footer?: ReactNode
}

function BotanicalCard({ data, compact, footer }: CardLayoutProps) {
  const deadline = formatDeadline(data.rsvpDeadline)
  return (
    <article
      data-testid="digital-invitation-card-botanical"
      aria-label={`Botanical digital wedding invitation for ${data.guestName || 'guest'}`}
      className={`relative isolate overflow-hidden rounded-[2rem] border shadow-xl ${compact ? 'min-h-[28rem] p-6' : 'min-h-[40rem] p-8 sm:p-12'}`}
      style={{
        background: data.backgroundColor || '#fbf6ee',
        borderColor: `${data.primaryColor || '#8a9a76'}66`,
        color: '#2c3328',
      }}
    >
      <div className="pointer-events-none absolute -left-14 -top-14 size-44 rounded-full border-[18px] border-[#879b78]/25" />
      <div className="pointer-events-none absolute -bottom-16 -right-12 size-52 rounded-full border-[22px] border-[#879b78]/20" />
      <div className="relative flex min-h-[inherit] flex-col items-center justify-between text-center">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#68795d]">Together with their families</p>
          <p className="mx-auto mt-6 flex size-16 items-center justify-center rounded-full border border-[#68795d]/35 font-serif text-2xl tracking-[0.12em]">
            {data.monogram || fallbackMonogram(data.title)}
          </p>
        </div>
        <div className="my-8">
          {data.guestName && <p className="mb-5 text-sm italic text-[#68795d]">Especially for {data.guestName}</p>}
          <h2 className={`${compact ? 'text-4xl' : 'text-5xl sm:text-6xl'} font-serif leading-[0.98]`}>{data.title}</h2>
          <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-[#4c5847]">{data.message || data.tagline || 'Request the pleasure of your company as they celebrate their wedding.'}</p>
        </div>
        <div className="space-y-3">
          <p className="font-serif text-xl">{formatDate(data.date)}</p>
          <div className="mx-auto h-px w-20 bg-[#68795d]/45" />
          <p className="text-sm font-semibold uppercase tracking-[0.18em]">{data.venue}</p>
          {locationLine(data) && <p className="text-xs text-[#68795d]">{locationLine(data)}</p>}
          {deadline && <p className="pt-3 text-xs font-medium">Kindly RSVP by {deadline}</p>}
        </div>
        {footer && <div className="mt-7 w-full">{footer}</div>}
      </div>
    </article>
  )
}

function EditorialCard({ data, compact, footer }: CardLayoutProps) {
  const deadline = formatDeadline(data.rsvpDeadline)
  return (
    <article
      data-testid="digital-invitation-card-editorial"
      aria-label={`Editorial digital wedding invitation for ${data.guestName || 'guest'}`}
      className={`overflow-hidden rounded-[1.5rem] border border-black/15 bg-[#f3efe7] shadow-xl ${compact ? 'min-h-[28rem] p-6' : 'min-h-[40rem] p-8 sm:p-12'}`}
    >
      <div className="flex min-h-[inherit] flex-col justify-between">
        <div className="flex items-start justify-between gap-6 border-b border-black/25 pb-5 text-[10px] font-semibold uppercase tracking-[0.22em]">
          <span>Wedding invitation</span>
          <span>{data.monogram || fallbackMonogram(data.title)}</span>
        </div>
        <div className="py-9">
          {data.guestName && <p className="mb-5 text-sm font-medium uppercase tracking-[0.16em]">For {data.guestName}</p>}
          <h2 className={`${compact ? 'text-5xl' : 'text-6xl sm:text-7xl'} max-w-2xl font-serif leading-[0.88] tracking-[-0.05em]`}>{data.title}</h2>
          <p className="mt-7 max-w-lg border-l-4 border-black pl-4 text-sm leading-6">{data.message || data.tagline || 'Join us for a day of ceremony, dinner and celebration.'}</p>
        </div>
        <div className="grid gap-5 border-t border-black/25 pt-5 sm:grid-cols-2">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em]">Date</p><p className="mt-2 font-serif text-xl">{formatDate(data.date)}</p></div>
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em]">Location</p><p className="mt-2 font-serif text-xl">{data.venue}</p>{locationLine(data) && <p className="mt-1 text-xs">{locationLine(data)}</p>}</div>
        </div>
        {deadline && <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em]">RSVP by {deadline}</p>}
        {footer && <div className="mt-7">{footer}</div>}
      </div>
    </article>
  )
}

function MidnightCard({ data, compact, footer }: CardLayoutProps) {
  const deadline = formatDeadline(data.rsvpDeadline)
  const gold = data.primaryColor || '#d4af67'
  return (
    <article
      data-testid="digital-invitation-card-midnight"
      aria-label={`Midnight digital wedding invitation for ${data.guestName || 'guest'}`}
      className={`relative isolate overflow-hidden rounded-[2rem] border shadow-2xl ${compact ? 'min-h-[28rem] p-6' : 'min-h-[40rem] p-8 sm:p-12'}`}
      style={{ background: '#111827', borderColor: `${gold}88`, color: '#fff8e8' }}
    >
      <div className="pointer-events-none absolute inset-4 rounded-[1.5rem] border" style={{ borderColor: `${gold}44` }} />
      <div className="pointer-events-none absolute left-1/2 top-10 h-px w-24 -translate-x-1/2" style={{ background: gold }} />
      <div className="relative flex min-h-[inherit] flex-col items-center justify-between text-center">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.34em]" style={{ color: gold }}>An evening celebration</p>
          <p className="mt-7 font-serif text-3xl tracking-[0.18em]" style={{ color: gold }}>{data.monogram || fallbackMonogram(data.title)}</p>
        </div>
        <div className="my-8">
          {data.guestName && <p className="mb-5 text-sm italic text-[#e5cf9d]">Reserved for {data.guestName}</p>}
          <h2 className={`${compact ? 'text-4xl' : 'text-5xl sm:text-6xl'} font-serif leading-none`}>{data.title}</h2>
          <p className="mx-auto mt-6 max-w-md text-sm leading-6 text-[#d6d9e0]">{data.message || data.tagline || 'Celebrate with us beneath the evening sky.'}</p>
        </div>
        <div className="space-y-3">
          <p className="font-serif text-xl" style={{ color: gold }}>{formatDate(data.date)}</p>
          <p className="text-sm font-semibold uppercase tracking-[0.18em]">{data.venue}</p>
          {locationLine(data) && <p className="text-xs text-[#b7bdc9]">{locationLine(data)}</p>}
          {deadline && <p className="pt-3 text-xs text-[#e5cf9d]">Please RSVP by {deadline}</p>}
        </div>
        {footer && <div className="mt-7 w-full">{footer}</div>}
      </div>
    </article>
  )
}

export function DigitalInvitationCard({
  data,
  style,
  compact = false,
  footer,
}: {
  data: DigitalInvitationCardData
  style: InvitationCardStyle
  compact?: boolean
  footer?: ReactNode
}) {
  const props = { data, compact, footer }
  if (style === 'editorial') return <EditorialCard {...props} />
  if (style === 'midnight') return <MidnightCard {...props} />
  return <BotanicalCard {...props} />
}
