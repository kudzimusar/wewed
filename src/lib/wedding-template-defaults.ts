import type { WeddingInfo } from '@/lib/wedding-data'

export const WEDDING_SOCIAL_TEMPLATE_VERSION = 1

export interface StarterStoryMilestone {
  title: string
  body: string
  icon: string
}

export interface StarterProgrammeItem {
  time: string
  event: string
  description?: string
  highlight?: boolean
}

export interface StarterTravelCard {
  title: string
  description: string
  details: string
  type: 'hotel' | 'transport' | 'airport'
}

export const STARTER_STORY_MILESTONES: StarterStoryMilestone[] = [
  {
    title: 'How We Met',
    body: 'Example: We met through mutual friends and quickly discovered how much we enjoyed spending time together. Replace this with your own beginning.',
    icon: '✦',
  },
  {
    title: 'The Journey',
    body: 'Example: Share a short memory about the moments, places or people that helped your relationship grow.',
    icon: '✦',
  },
  {
    title: 'The Question',
    body: 'Example: Tell your guests how the proposal happened and what made the moment special to you.',
    icon: '✦',
  },
  {
    title: 'Our Next Chapter',
    body: 'Example: Add a few words about the life you are excited to build together after the wedding.',
    icon: '✦',
  },
]

export const STARTER_PROGRAMME: StarterProgrammeItem[] = [
  {
    time: '13:00',
    event: 'Guest Arrival',
    description: 'Example time — update this to match your confirmed programme.',
  },
  {
    time: '14:00',
    event: 'Ceremony',
    description: 'Add the ceremony start time and any arrival guidance.',
    highlight: true,
  },
  {
    time: '15:30',
    event: 'Celebration',
    description: 'Add cocktails, photographs, reception or other key moments.',
  },
  {
    time: '18:00',
    event: 'Dinner & Speeches',
    description: 'Replace this example with your reception schedule.',
  },
  {
    time: '20:00',
    event: 'Dancing',
    description: 'Add your evening entertainment and closing time.',
  },
]

export const STARTER_TRAVEL_CARDS: StarterTravelCard[] = [
  {
    type: 'hotel',
    title: 'Where to Stay',
    description: 'Add one or two nearby hotels or accommodation options for travelling guests.',
    details: 'Example guidance — include booking links, distance and any group rate.',
  },
  {
    type: 'transport',
    title: 'Getting Around',
    description: 'Add shuttle, taxi, parking or transport information that will help guests arrive easily.',
    details: 'Example guidance — include pickup points and timing when confirmed.',
  },
  {
    type: 'airport',
    title: 'Arriving from Out of Town',
    description: 'Add the nearest airport, border, station or long-distance travel advice.',
    details: 'Example guidance — include approximate travel time to the venue.',
  },
]

export const STARTER_VENUE_FEATURES = [
  'Add ceremony-space and guest-capacity information.',
  'Add reception, catering and accessibility details.',
  'Add parking, transport and arrival guidance.',
]

export const STARTER_VENUE_MOMENTS = [
  'Ceremony',
  'Celebration',
  'Reception',
  'Evening',
]

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
  return new Intl.DateTimeFormat(
    'en-GB',
    options ?? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  ).format(date)
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
