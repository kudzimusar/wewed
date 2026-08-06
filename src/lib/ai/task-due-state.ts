const DAY_MS = 24 * 60 * 60 * 1_000

function utcDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
}

export function describeTaskDueState(
  dueDate: Date | null,
  status: string,
  now: Date,
): string {
  const normalizedStatus = status.trim().toLowerCase()
  if (['completed', 'done', 'cancelled', 'canceled'].includes(normalizedStatus)) {
    return normalizedStatus
  }
  if (!dueDate) return 'no_due_date'

  const dayDifference = Math.round((utcDay(dueDate) - utcDay(now)) / DAY_MS)
  if (dayDifference < 0) return `overdue_by_${Math.abs(dayDifference)}_days`
  if (dayDifference === 0) return 'due_today'
  if (dayDifference === 1) return 'due_tomorrow'
  return `due_in_${dayDifference}_days`
}
