export const EVENT_ISSUE_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
export const TIMELINE_OPERATION_STATUSES = ['pending', 'in_progress', 'complete', 'held'] as const

export type EventIssueSeverity = (typeof EVENT_ISSUE_SEVERITIES)[number]
export type TimelineOperationStatus = (typeof TIMELINE_OPERATION_STATUSES)[number]

export interface PartyRsvp {
  attending: boolean | null
  plusOne: boolean
  kidsAttending: boolean
  kidsCount: number
  checkedIn: boolean
}

export interface EventIssueValue {
  title: string
  notes: string
  severity: EventIssueSeverity
  owner: string
  createdAt: string
  resolvedAt: string | null
  resolvedBy: string | null
}

export interface TimelineStatusValue {
  status: TimelineOperationStatus
  updatedAt: string
  updatedBy: string | null
}

export function partyHeadcount(rsvp: PartyRsvp | null | undefined): number {
  if (!rsvp || rsvp.attending === false) return 0
  return 1 + (rsvp.plusOne ? 1 : 0) + (rsvp.kidsAttending ? Math.max(0, rsvp.kidsCount) : 0)
}

export function checkedInHeadcount(rsvp: PartyRsvp | null | undefined): number {
  if (!rsvp?.checkedIn) return 0
  const party = partyHeadcount(rsvp)
  return party > 0 ? party : 1
}

export function normaliseIssueSeverity(value: unknown): EventIssueSeverity {
  return EVENT_ISSUE_SEVERITIES.includes(value as EventIssueSeverity)
    ? (value as EventIssueSeverity)
    : 'medium'
}

export function normaliseTimelineStatus(value: unknown): TimelineOperationStatus {
  return TIMELINE_OPERATION_STATUSES.includes(value as TimelineOperationStatus)
    ? (value as TimelineOperationStatus)
    : 'pending'
}

export function parseJsonObject<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? (parsed as T) : fallback
  } catch {
    return fallback
  }
}

export function parseTimelineMinutes(value: string): number | null {
  const input = value.trim().toLowerCase()
  const twelveHour = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/.exec(input)
  if (twelveHour) {
    let hours = Number(twelveHour[1]) % 12
    const minutes = Number(twelveHour[2] ?? 0)
    if (minutes > 59) return null
    if (twelveHour[3] === 'pm') hours += 12
    return hours * 60 + minutes
  }

  const twentyFourHour = /^(\d{1,2}):(\d{2})$/.exec(input)
  if (!twentyFourHour) return null
  const hours = Number(twentyFourHour[1])
  const minutes = Number(twentyFourHour[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function csvRows(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function eventReadiness(input: {
  expectedHeads: number
  checkedInHeads: number
  unseatedHeads: number
  openCriticalIssues: number
  incompleteTimelineItems: number
}): number {
  const arrivalScore = input.expectedHeads > 0
    ? Math.min(1, input.checkedInHeads / input.expectedHeads) * 35
    : 35
  const seatingPenalty = Math.min(25, input.unseatedHeads * 3)
  const issuePenalty = Math.min(25, input.openCriticalIssues * 10)
  const timelinePenalty = Math.min(15, input.incompleteTimelineItems * 2)
  return Math.max(0, Math.round(100 - seatingPenalty - issuePenalty - timelinePenalty - (35 - arrivalScore)))
}
