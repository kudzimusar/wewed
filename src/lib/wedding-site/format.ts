import type { WeddingInfo } from '@/lib/wedding-data'

/**
 * QRO07-SHIP01 — presentation helpers over the canonical wedding facts. Pure functions: no
 * example data, no fallbacks that could be mistaken for real wedding details.
 *
 * Wedding.date is stored as a UTC instant and every label is rendered in UTC so the server
 * render and the guest's browser hydrate the same calendar day.
 */

export function coupleDisplayNames(wedding: WeddingInfo): string {
  return [wedding.couple.partner1, wedding.couple.partner2].filter(Boolean).join(' & ')
}

export function longWeddingDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(date)
  return ['weekday', 'day', 'month', 'year']
    .map((type) => parts.find((part) => part.type === type)?.value ?? '')
    .join(' ')
}

export function shortWeddingDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(date)
  return ['day', 'month', 'year']
    .map((type) => parts.find((part) => part.type === type)?.value ?? '')
    .join(' ')
}

export function venueLocality(wedding: WeddingInfo): string {
  return [wedding.venueCity, wedding.venueCountry].filter(Boolean).join(', ')
}

export function venueFullLine(wedding: WeddingInfo): string {
  return [wedding.venue, wedding.venueCity, wedding.venueCountry].filter(Boolean).join(', ')
}

export function venueDirectionsUrl(wedding: WeddingInfo): string | null {
  if (wedding.venueMapUrl) {
    try {
      const url = new URL(wedding.venueMapUrl)
      if (url.protocol === 'https:') return url.toString()
    } catch {
      // fall through to a search URL built from the canonical venue line
    }
  }
  const line = venueFullLine(wedding)
  return line
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(line)}`
    : null
}

function calendarStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export function googleCalendarLink(wedding: WeddingInfo): string | null {
  const start = new Date(wedding.date)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start.getTime() + 8 * 60 * 60 * 1000)
  const names = coupleDisplayNames(wedding)
  const location = venueFullLine(wedding)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${names} — Wedding`,
    dates: `${calendarStamp(start)}/${calendarStamp(end)}`,
    location,
    details: `Celebrating ${names}${location ? ` at ${location}` : ''}.`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function icsEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function weddingIcs(wedding: WeddingInfo): string {
  const start = new Date(wedding.date)
  const end = new Date(start.getTime() + 8 * 60 * 60 * 1000)
  const names = coupleDisplayNames(wedding)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//wewed//Wedding Website//EN',
    'BEGIN:VEVENT',
    `UID:${wedding.id}@wewed.pro`,
    `DTSTAMP:${calendarStamp(new Date())}`,
    `DTSTART:${calendarStamp(start)}`,
    `DTEND:${calendarStamp(end)}`,
    `SUMMARY:${icsEscape(`${names} — Wedding`)}`,
    `LOCATION:${icsEscape(venueFullLine(wedding))}`,
    `DESCRIPTION:${icsEscape(`Celebrating ${names}.`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function weddingIcsName(wedding: WeddingInfo): string {
  const safe = wedding.slug.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '')
  return `${safe || 'wedding'}.ics`
}
