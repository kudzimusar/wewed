import type { ReactNode } from 'react'
import {
  getInvitationCardStyleDefinition,
  type InvitationCardStyle,
} from '@/lib/digital-invitation-card'

export interface DigitalInvitationCardData {
  title: string
  monogram?: string | null
  tagline?: string | null
  date: string | Date
  venue: string
  venueMapUrl?: string | null
  venueAddress?: string | null
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

function ThemeMotif({ style, primary, accent }: { style: InvitationCardStyle; primary: string; accent: string }) {
  if (style === 'editorial') {
    return (
      <div aria-hidden="true" className="absolute inset-x-4 top-4 flex items-center gap-2 opacity-45">
        <span className="h-[3px] flex-1" style={{ background: primary }} />
        <span className="size-2 rounded-full" style={{ background: accent }} />
      </div>
    )
  }
  if (style === 'midnight' || style === 'celestial') {
    return (
      <div aria-hidden="true" className="absolute inset-0 opacity-45 bg-[radial-gradient(circle_at_18%_20%,currentColor_0_1px,transparent_1.5px),radial-gradient(circle_at_75%_16%,currentColor_0_1px,transparent_1.5px),radial-gradient(circle_at_82%_70%,currentColor_0_1px,transparent_1.5px),radial-gradient(circle_at_27%_82%,currentColor_0_1px,transparent_1.5px)]" style={{ color: accent }} />
    )
  }
  if (style === 'african-luxe') {
    return (
      <div aria-hidden="true" className="absolute inset-x-3 top-3 h-5 opacity-40" style={{ background: `repeating-linear-gradient(90deg, ${primary} 0 5px, transparent 5px 10px, ${accent} 10px 13px, transparent 13px 18px)` }} />
    )
  }
  if (style === 'watercolour-garden' || style === 'botanical' || style === 'blush-romance') {
    return (
      <>
        <div aria-hidden="true" className="absolute -left-8 -top-9 size-28 rounded-full blur-xl opacity-20" style={{ background: primary }} />
        <div aria-hidden="true" className="absolute -bottom-8 -right-8 size-32 rounded-full blur-xl opacity-20" style={{ background: accent }} />
      </>
    )
  }
  return (
    <>
      <div aria-hidden="true" className="absolute -left-12 -top-12 size-28 rounded-full border-[10px] opacity-15" style={{ borderColor: primary }} />
      <div aria-hidden="true" className="absolute -bottom-12 -right-10 size-32 rounded-full border-[12px] opacity-15" style={{ borderColor: accent }} />
    </>
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
  const definition = getInvitationCardStyleDefinition(style)
  const deadline = formatDeadline(data.rsvpDeadline)
  const location = locationLine(data)
  const palette = definition.palette
  const isEditorial = style === 'editorial'

  return (
    <article
      data-testid={`digital-invitation-card-${style}`}
      aria-label={`${definition.name} digital wedding invitation for ${data.guestName || 'guest'}`}
      className={`relative isolate mx-auto w-full overflow-hidden border shadow-xl ${compact ? 'aspect-[4/5] rounded-[1.25rem] p-3' : 'min-h-[34rem] max-w-2xl rounded-[2rem] p-7 sm:min-h-[40rem] sm:p-10'}`}
      style={{ background: palette.paper, borderColor: `${palette.primary}88`, color: palette.ink }}
    >
      <ThemeMotif style={style} primary={palette.primary} accent={palette.accent} />
      <div className={`relative z-10 flex h-full min-h-[inherit] flex-col ${isEditorial ? 'items-start text-left' : 'items-center text-center'}`}>
        <div className={`w-full ${isEditorial ? 'flex items-center justify-between border-b pb-3' : ''}`} style={isEditorial ? { borderColor: `${palette.ink}22` } : undefined}>
          <p className={`${compact ? 'text-[6px]' : 'text-[9px]'} font-semibold uppercase tracking-[0.25em]`} style={{ color: palette.primary }}>
            Together with our families
          </p>
          <p className={`${compact ? 'mt-2 text-[10px]' : 'mt-5 text-xl'} font-serif tracking-[0.13em]`} style={{ color: palette.primary }}>
            {data.monogram || fallbackMonogram(data.title)}
          </p>
        </div>

        <div className={`${compact ? 'my-auto py-3' : 'my-auto py-8'} w-full`}>
          {data.guestName && (
            <p className={`${compact ? 'mb-2 text-[7px]' : 'mb-5 text-sm'} italic`} style={{ color: palette.muted }}>
              Especially for {data.guestName}
            </p>
          )}
          <h2 className={`${compact ? 'text-lg leading-[.95]' : 'text-4xl leading-[.95] sm:text-6xl'} font-serif tracking-[-0.04em]`}>
            {data.title}
          </h2>
          {!compact && (
            <p className="mx-auto mt-6 max-w-md text-sm leading-6" style={{ color: palette.muted }}>
              {data.message || data.tagline || 'Request the pleasure of your company as we celebrate our marriage.'}
            </p>
          )}
        </div>

        <div className={`w-full ${isEditorial ? 'border-t pt-4' : ''}`} style={isEditorial ? { borderColor: `${palette.ink}22` } : undefined}>
          <p className={`${compact ? 'text-[8px]' : 'font-serif text-lg sm:text-xl'}`}>{formatDate(data.date)}</p>
          {!compact && <div className="mx-auto my-3 h-px w-16 opacity-30" style={{ background: palette.primary }} />}
          <p className={`${compact ? 'mt-2 text-[7px]' : 'text-xs'} font-semibold uppercase tracking-[0.18em]`}>{data.venue}</p>
          {location && <p className={`${compact ? 'mt-1 text-[6px]' : 'mt-2 text-xs'} opacity-60`}>{location}</p>}
          {!compact && deadline && <p className="mt-4 text-xs font-medium" style={{ color: palette.muted }}>Kindly RSVP by {deadline}</p>}
        </div>

        {footer && <div className={`${compact ? 'mt-2' : 'mt-7'} w-full`}>{footer}</div>}
      </div>
    </article>
  )
}
