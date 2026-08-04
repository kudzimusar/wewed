export interface TimelineOrderable {
  time: string
  order?: number | null
  createdAt?: string | Date | null
  id?: string | null
}

/**
 * Convert a planner timeline clock value to minutes after midnight.
 * Supports the native 24-hour values produced by the time input and common
 * 12-hour spreadsheet values. Invalid values sort after valid clock times.
 */
export function timelineMinutes(value: unknown): number | null {
  const source = String(value ?? '').trim()
  if (!source) return null

  const twentyFourHour = source.match(/^(\d{1,2}):(\d{2})$/)
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1])
    const minute = Number(twentyFourHour[2])
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return hour * 60 + minute
    }
    return null
  }

  const twelveHour = source.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/i)
  if (!twelveHour) return null

  const hour = Number(twelveHour[1])
  const minute = Number(twelveHour[2] ?? 0)
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null

  const meridiem = twelveHour[3].toLowerCase()
  const normalizedHour = hour % 12 + (meridiem === 'p' ? 12 : 0)
  return normalizedHour * 60 + minute
}

function createdAtValue(value: string | Date | null | undefined): number {
  if (!value) return 0
  const parsed = value instanceof Date ? value : new Date(value)
  const time = parsed.getTime()
  return Number.isFinite(time) ? time : 0
}

/**
 * Timeline time is the primary order. The persisted order remains a stable
 * tie-breaker for simultaneous events, followed by creation time and ID.
 */
export function compareTimelineItems<T extends TimelineOrderable>(a: T, b: T): number {
  const aMinutes = timelineMinutes(a.time)
  const bMinutes = timelineMinutes(b.time)

  if (aMinutes !== null && bMinutes !== null && aMinutes !== bMinutes) {
    return aMinutes - bMinutes
  }
  if (aMinutes !== null && bMinutes === null) return -1
  if (aMinutes === null && bMinutes !== null) return 1

  const orderDifference = (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
  if (orderDifference !== 0) return orderDifference

  const creationDifference = createdAtValue(a.createdAt) - createdAtValue(b.createdAt)
  if (creationDifference !== 0) return creationDifference

  return String(a.id ?? '').localeCompare(String(b.id ?? ''))
}

export function sortTimelineItems<T extends TimelineOrderable>(items: readonly T[]): T[] {
  return [...items].sort(compareTimelineItems)
}

export function timelineTimesMatch(a: unknown, b: unknown): boolean {
  const aMinutes = timelineMinutes(a)
  const bMinutes = timelineMinutes(b)
  return aMinutes !== null && bMinutes !== null && aMinutes === bMinutes
}
