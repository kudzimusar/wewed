import { z } from 'zod'

export const CALENDAR_CATEGORIES = [
  'task',
  'budget',
  'payment',
  'engagement',
  'rsvp',
  'programme',
  'wedding',
  'contract',
  'appointment',
  'admin',
  'system',
] as const

export const calendarCategorySchema = z.enum(CALENDAR_CATEGORIES)
export type CalendarCategory = z.infer<typeof calendarCategorySchema>

export interface CalendarItem {
  id: string
  sourceType: string
  sourceId: string
  weddingId: string | null
  weddingTitle: string | null
  title: string
  description: string | null
  startAt: Date
  endAt: Date | null
  allDay: boolean
  category: CalendarCategory
  status: string | null
  priority: string | null
  deepLink: string | null
  metadata: Record<string, unknown> | null
}

export const calendarRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  weddingId: z.string().trim().min(1).optional(),
  categories: z.array(calendarCategorySchema).optional(),
  limit: z.number().int().min(1).max(1000).default(500),
})

export type CalendarRangeInput = z.input<typeof calendarRangeSchema>

export function isCalendarItemInRange(
  item: Pick<CalendarItem, 'startAt'>,
  from?: Date,
  to?: Date,
): boolean {
  const time = item.startAt.getTime()
  if (from && time < from.getTime()) return false
  if (to && time > to.getTime()) return false
  return true
}

export function combineWeddingDateAndProgrammeTime(weddingDate: Date, rawTime: string): {
  date: Date
  allDay: boolean
} {
  const value = rawTime.trim()
  const date = new Date(weddingDate)

  const twentyFourHour = value.match(/^(\d{1,2}):(\d{2})$/)
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1])
    const minute = Number(twentyFourHour[2])
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      date.setHours(hour, minute, 0, 0)
      return { date, allDay: false }
    }
  }

  const twelveHour = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
  if (twelveHour) {
    let hour = Number(twelveHour[1])
    const minute = Number(twelveHour[2] ?? 0)
    if (hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59) {
      const meridiem = twelveHour[3].toLowerCase()
      if (hour === 12) hour = 0
      if (meridiem === 'pm') hour += 12
      date.setHours(hour, minute, 0, 0)
      return { date, allDay: false }
    }
  }

  date.setHours(0, 0, 0, 0)
  return { date, allDay: true }
}
