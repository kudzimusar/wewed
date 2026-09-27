import type { WeddingInfo } from '@/lib/wedding-data'

export const WEDDING_SOCIAL_TEMPLATE_VERSION = 1

export function coupleNames(wedding: WeddingInfo | null | undefined): string {
  if (!wedding) return 'Our Wedding'
  return [wedding.couple.partner1, wedding.couple.partner2].filter(Boolean).join(' & ')
}

export function formatWeddingDate(
  value: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  if (options) return new Intl.DateTimeFormat('en-GB', options).format(date)
  // ICU versions differ in punctuation. Build the default label from explicit
  // parts so SSR and the guest's browser hydrate the same wedding date.
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).formatToParts(date)
  return ['weekday', 'day', 'month', 'year']
    .map((type) => parts.find((part) => part.type === type)?.value ?? '')
    .join(' ')

}

export function compactWeddingDate(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date)
  return parts.replaceAll('/', ' · ')
}

export function weddingVenueLine(wedding: WeddingInfo | null | undefined): string {
  if (!wedding) return 'Add your venue and location'
  return [wedding.venue, wedding.venueCity, wedding.venueCountry]
    .filter(Boolean)
    .join(' · ')
}

export function weddingLocation(wedding: WeddingInfo | null | undefined): string {
  if (!wedding) return ''
  return [wedding.venue, wedding.venueCity, wedding.venueCountry]
    .filter(Boolean)
    .join(', ')
}

export function weddingCalendarTitle(wedding: WeddingInfo | null | undefined): string {
  return `${coupleNames(wedding)} — Wedding Celebration`
}

export function googleCalendarUrl(wedding: WeddingInfo | null | undefined): string {
  if (!wedding?.date) return '#theday'
  const start = new Date(wedding.date)
  if (Number.isNaN(start.getTime())) return '#theday'
  const end = new Date(start.getTime() + 8 * 60 * 60 * 1000)
  const calendarStamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const names = coupleNames(wedding)
  const location = weddingLocation(wedding)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: weddingCalendarTitle(wedding),
    dates: `${calendarStamp(start)}/${calendarStamp(end)}`,
    location,
    details: `Join us to celebrate ${names}${location ? ` at ${location}` : ''}.`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function weddingIcsContent(wedding: WeddingInfo): string {
  const start = new Date(wedding.date)
  const end = new Date(start.getTime() + 8 * 60 * 60 * 1000)
  const calendarStamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const names = coupleNames(wedding)
  const location = weddingLocation(wedding).replaceAll(',', '\\,')
  const description = `Join us to celebrate ${names}.`.replaceAll(',', '\\,')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//wewed//Wedding Social Site//EN',
    'BEGIN:VEVENT',
    `DTSTART:${calendarStamp(start)}`,
    `DTEND:${calendarStamp(end)}`,
    `SUMMARY:${weddingCalendarTitle(wedding)}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function weddingIcsFilename(wedding: WeddingInfo): string {
  const safeSlug = wedding.slug.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '')
  return `${safeSlug || 'wewed-wedding'}.ics`
}
